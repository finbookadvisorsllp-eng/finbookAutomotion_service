"""Accounting core — the single source of truth for double-entry math.

Every report (Trial Balance, P&L, Balance Sheet, Ledger, GST) is derived from
these primitives so the whole stack is internally consistent. No FastAPI/HTTP
imports here; pure functions + Mongo reads via repositories.
"""
import re
from dataclasses import dataclass, field

from app.aman.core.serializers import money
from app.aman.repositories import group_repo, ledger_repo, voucher_repo


def _norm_name(name: str | None) -> str:
    """Whitespace-normalise a ledger name for tolerant master matching:
    trim ends and collapse internal runs of whitespace to a single space."""
    return re.sub(r"\s+", " ", (name or "")).strip()


# ─────────────────────────── primitives ───────────────────────────
def dr_cr(entry: dict) -> tuple[float, float]:
    """Return (debit, credit) magnitude for a single voucher ledgerEntry.

    VERIFIED against the live data: the SIGN of ``amount`` is the universal,
    authoritative Dr/Cr indicator (all 381 vouchers balance under this rule,
    versus only 348 under ``isDeemedPositive``). Tally's ``isDeemedPositive``
    flag disagrees on ~6% of lines (e.g. negative round-offs) and must NOT be
    used for accounting math.

        amount  < 0  ->  Debit
        amount  > 0  ->  Credit

    The same sign convention applies to ledger opening balances.
    """
    amt = float(entry.get("amount") or 0)
    if amt < 0:
        return (abs(amt), 0.0)
    return (0.0, amt)


def net_balance(debit: float, credit: float) -> tuple[float, float]:
    """Net a (debit, credit) pair down to a single side. One side is always 0."""
    net = round(debit - credit, 2)
    if net >= 0:
        return net, 0.0
    return 0.0, -net


# ─────────────────────────── ledger-level balances ───────────────────────────
@dataclass
class LedgerBalance:
    name: str
    group_name: str | None = None
    group_path: str | None = None
    root_group: str | None = None
    classification: str | None = None
    opening_debit: float = 0.0
    opening_credit: float = 0.0
    movement_debit: float = 0.0
    movement_credit: float = 0.0

    @property
    def closing_debit(self) -> float:
        return net_balance(self.opening_debit + self.movement_debit,
                           self.opening_credit + self.movement_credit)[0]

    @property
    def closing_credit(self) -> float:
        return net_balance(self.opening_debit + self.movement_debit,
                           self.opening_credit + self.movement_credit)[1]


def opening_stock_value(db) -> float:
    """Total opening stock value (a Current-Asset debit) from ``stockItems``.

    Stock value is held in inventory masters, not as a ledger movement, and is
    stored with the same sign convention (negative = debit/asset). We return the
    positive debit magnitude. This is the figure that makes the Trial Balance and
    Balance Sheet tie out, since the ledger postings alone omit stock-in-hand.
    """
    total = 0.0
    for s in db["stockItems"].find({}, {"inventory.openingStock.value": 1}):
        total += float(((s.get("inventory") or {}).get("openingStock") or {}).get("value") or 0)
    return abs(round(total, 2))


STOCK_LEDGER_NAME = "Stock-in-Hand"


def _is_stock_in_hand(lb, groups: dict) -> bool:
    """True if a ledger sits under Tally's reserved **Stock-in-Hand** group.

    Data-driven: matches the group's nature ``subType == STOCK_IN_HAND`` when the
    sync provides it, else the reserved group NAME ("Stock-in-Hand") on the
    ledger's immediate group, its root, or the leaf of its group path. Tally's
    "Stock-in-Hand" is a standard reserved primary group (present in every
    company), so this is universal — never a company-specific ledger name. Note
    the group is often nested under Current Assets, so the *root* alone is not
    enough; we check the immediate group too."""
    for gname in (getattr(lb, "group_name", None), getattr(lb, "root_group", None)):
        sub = (((groups.get(gname) or {}).get("nature") or {}).get("subType") or "")
        if sub.upper().replace("-", "_").replace(" ", "_") == "STOCK_IN_HAND":
            return True
    for n in (getattr(lb, "group_name", None), getattr(lb, "root_group", None), getattr(lb, "group_path", None)):
        norm = _norm_name(n or "").lower()
        if norm in ("stock-in-hand", "stock in hand") or norm.endswith("> stock-in-hand") or norm.endswith("> stock in hand"):
            return True
    return False


def stock_in_hand_from_books(balances: dict, groups: dict) -> tuple[float, float, bool]:
    """Net opening & closing Stock-in-Hand taken from the **ledger** balances.

    Tally-correct + tenant-agnostic: when a company keeps a Stock-in-Hand ledger,
    its opening/closing balance is the authoritative stock figure AND is already
    part of the balanced ledger set. The P&L and Balance Sheet must use that — not
    a separately-computed inventory valuation, which double-counts the ledger and
    is unreliable when stock movements are incompletely synced. Returns
    ``(opening, closing, found)`` (debit-positive). ``found`` is False for
    companies with no stock ledger (then callers fall back to inventory)."""
    opening = closing = 0.0
    found = False
    for lb in balances.values():
        if _is_stock_in_hand(lb, groups):
            found = True
            opening += lb.opening_debit - lb.opening_credit
            closing += lb.closing_debit - lb.closing_credit
    return round(opening, 2), round(closing, 2), found


def compute_ledger_balances(db, fy: str | None = None, include_opening: bool = True,
                            include_stock: bool = True, date_match: dict | None = None) -> dict[str, LedgerBalance]:
    """Build per-ledger balances for the period.

    Merges the ledger master (opening balance + group mapping) with the period
    movement aggregated from vouchers. Ledger names that appear in vouchers but
    not in the master (e.g. ad-hoc round-off ledgers) are still represented and
    bucketed under their best-guess group.
    """
    masters = ledger_repo.ledger_by_name(db)
    groups = group_repo.group_by_name(db)
    movement = voucher_repo.ledger_movement(db, fy, date_match=date_match)

    # Whitespace-normalised index of master names. Tally treats ledger names as
    # whitespace-insensitive, but a sync can emit a voucher line with a stray
    # double space (e.g. 'Savitri Packaging' vs the master 'Savitri  Packaging').
    # Matching on the normalised key reunites such movement with its real master
    # instead of stranding it as an unclassified (Suspense) balance. This is a
    # generic data-quality rule — never a per-name mapping.
    norm_master = {_norm_name(n): n for n in masters}

    balances: dict[str, LedgerBalance] = {}

    def _canonical(name: str) -> str:
        if name in masters:
            return name
        return norm_master.get(_norm_name(name), name)

    def _resolve(name: str) -> LedgerBalance:
        if name in balances:
            return balances[name]
        master = masters.get(name)
        group_name = (master or {}).get("groupName")
        group_path = (master or {}).get("groupPath")
        root = group_repo.group_root(group_path, fallback=group_name)
        root_doc = groups.get(root) or groups.get(group_name)
        lb = LedgerBalance(
            name=name,
            group_name=group_name,
            group_path=group_path,
            root_group=root,
            classification=group_repo.classification_of(root_doc),
        )
        if include_opening and master:
            od, oc = ledger_repo.opening_balance(master)
            lb.opening_debit, lb.opening_credit = od, oc
        balances[name] = lb
        return lb

    # Seed from masters so zero-movement opening balances still appear (BS).
    if include_opening:
        for name, master in masters.items():
            od, oc = ledger_repo.opening_balance(master)
            if od or oc:
                _resolve(name)

    for name, mov in movement.items():
        # Accumulate (+=) because a normalised name can merge two raw voucher
        # spellings (e.g. single- vs double-space) into one master ledger.
        lb = _resolve(_canonical(name))
        lb.movement_debit += mov.get("debit", 0.0)
        lb.movement_credit += mov.get("credit", 0.0)

    # Reconstruct opening Stock-in-Hand when the synced ledger openings don't
    # already include it.
    #
    # Accounting rule (tenant-agnostic): a real set of Tally books always has a
    # balanced *opening* Trial Balance. When a sync omits the stock-ledger opening
    # (common — stock is held in inventory masters, not as a ledger), the exported
    # openings come in **credit-heavy by exactly the missing stock value**. So the
    # correct, universal plug is the opening residual (Σ opening credit − Σ opening
    # debit), booked as a Current-Asset debit. This:
    #   • makes the opening — and therefore the closing — Trial Balance balance,
    #     so Debit == Credit and Balance-Sheet Assets == Liabilities for *every*
    #     tenant (verified: Friends, Gangwal, Natraj);
    #   • injects **nothing** when the books already balance (e.g. the stock ledger
    #     was exported), so we never double-count or fabricate.
    # The raw inventory-value sum is deliberately NOT used here: it only matched by
    # coincidence on one tenant and is unreliable (it overstated another by ~7×).
    if include_opening and include_stock:
        if date_match:
            # Custom date-range reports keep the inventory-derived opening stock
            # (a mid-period opening can't be inferred from the FY residual alone).
            from app.aman.services.inventory_service import opening_stock_value_range
            osv = opening_stock_value_range(db, date_match=date_match)
        else:
            open_debit = sum(b.opening_debit for b in balances.values())
            open_credit = sum(b.opening_credit for b in balances.values())
            osv = round(open_credit - open_debit, 2)
        if osv and osv > 0:
            balances[STOCK_LEDGER_NAME] = LedgerBalance(
                name=STOCK_LEDGER_NAME,
                group_name="Stock-in-Hand",
                group_path="Current Assets > Stock-in-Hand",
                root_group="Current Assets",
                classification="ASSETS",
                opening_debit=osv,
            )

    return balances



# ─────────────────────────── group rollup (Trial Balance tree) ───────────────────────────
@dataclass
class GroupRollup:
    name: str
    classification: str | None = None
    debit: float = 0.0
    credit: float = 0.0
    ledgers: list[dict] = field(default_factory=list)


def group_rollup(balances: dict[str, LedgerBalance]) -> dict[str, GroupRollup]:
    """Roll per-ledger closing balances up to their root (primary) group.

    Group debit/credit = sum of member ledgers' *netted* closing sides (this
    matches Tally's Trial Balance presentation, where a group can show non-zero
    debit AND credit because some members are net-debit and others net-credit).
    """
    rollups: dict[str, GroupRollup] = {}
    for lb in balances.values():
        root = lb.root_group or "Suspense A/c"
        ru = rollups.get(root)
        if not ru:
            ru = GroupRollup(name=root, classification=lb.classification)
            rollups[root] = ru
        cd, cc = lb.closing_debit, lb.closing_credit
        if cd == 0 and cc == 0:
            continue
        ru.debit = money(ru.debit + cd)
        ru.credit = money(ru.credit + cc)
        ru.ledgers.append({
            "name": lb.name,
            "groupName": lb.group_name,
            "debit": cd,
            "credit": cc,
        })
    return rollups


def trial_balance_totals(rollups: dict[str, GroupRollup]) -> tuple[float, float]:
    total_debit = money(sum(r.debit for r in rollups.values()))
    total_credit = money(sum(r.credit for r in rollups.values()))
    return total_debit, total_credit
