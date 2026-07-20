"""Business Health configuration — tunable knobs in exactly one place.

Layered like ``app.aman.ai_cfo.config``: importing ``app.aman.config`` guarantees
the shared ``.env`` is already loaded, then we read Business-Health-only settings
on top. Domain constants (pillar weights, band thresholds, priority weights) live
here as class attributes so the whole scoring model is auditable at a glance and
never scattered across engines. Anything an operator might retune is env-backed.

Nothing here is company-specific — no hardcoded company id or name (house rule).
"""
import os

# Importing the shared aman settings ensures .env is loaded exactly once and lets
# us reuse the single cache switch/TTL rather than inventing a second one.
from app.aman.config import aman_settings


def _flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


class BusinessHealthSettings:
    # ─── Identity ───
    FEATURE_NAME: str = "Business Health"
    VERSION: str = "1.0.1-alpha"          # v1 (Decision Engine) + pre-prod remediation
    ROUTE_PREFIX: str = "/business-health"

    # ─── Mongo collections (live inside each tenant's sf_tenant_<id> database) ───
    DECISIONS_COLLECTION: str = "aman_decisions"
    SNAPSHOTS_COLLECTION: str = "aman_health_snapshots"

    # ─── Scope (APPROVED: company-scoped) ───
    # All decisions/risks/opportunities belong to the currently selected company.
    # Because they are stored in that company's tenant database, company isolation
    # is automatic and free — we do NOT filter by user. The acting user is recorded
    # on a decision purely for audit ("who marked this done"), never for visibility.
    DECISION_SCOPE: str = "company"

    # ─── Health Score pillars ───
    # Weights sum to 100. The fifth pillar is Book Hygiene (APPROVED), replacing a
    # "Compliance filings" pillar we cannot source honestly from the sync.
    PILLAR_WEIGHTS: dict[str, int] = {
        "profitability": 25,   # net & gross margin, margin trend, expense-to-revenue
        "liquidity": 25,       # cash/bank sign, net cash-flow direction, runway
        "collections": 20,     # receivables run-rate, receivables-vs-payables, concentration
        "growth": 15,          # sales YoY, trend slope, repeat-customer share
        "hygiene": 15,         # cancelled-voucher rate, period gaps, GSTR-1 vs 3B consistency
    }
    PILLAR_LABELS: dict[str, str] = {
        "profitability": "Profitability & Margin",
        "liquidity": "Liquidity & Cash",
        "collections": "Collections & Working Capital",
        "growth": "Growth & Revenue Quality",
        "hygiene": "Book Hygiene",
    }
    # Overall-score letter grades: (min_score, grade, label), highest first.
    GRADE_BANDS: list[tuple[int, str, str]] = [
        (85, "A", "Excellent"), (70, "B", "Healthy"), (55, "C", "Fair"),
        (40, "D", "At risk"), (0, "E", "Critical"),
    ]

    # ─── Vital-sign bands (deterministic thresholds; retune in engines/kpi as data warrants) ───
    RUNWAY_MONTHS_GOOD: float = 6.0        # >= good, < WATCH = critical
    RUNWAY_MONTHS_WATCH: float = 3.0
    NET_MARGIN_GOOD: float = 10.0          # %
    NET_MARGIN_WATCH: float = 3.0
    CONCENTRATION_TOP1_WATCH: float = 25.0     # % of sales from the single top customer
    CONCENTRATION_TOP1_CRITICAL: float = 40.0
    COLLECTIONS_MONTHS_GOOD: float = 1.5       # receivables ÷ avg monthly sales
    COLLECTIONS_MONTHS_WATCH: float = 3.0
    # How many trailing active months feed the run-rate used by runway/collections.
    RUNRATE_MONTHS: int = int(os.getenv("BH_RUNRATE_MONTHS", "3"))

    # ─── Priority engine ───
    # priorityScore = normalize(rupeeImpact) × confidenceWeight ÷ effortWeight × urgencyBoost
    CONFIDENCE_WEIGHT: dict[str, float] = {"high": 1.0, "med": 0.7, "low": 0.4}
    EFFORT_WEIGHT: dict[str, float] = {"low": 1.0, "med": 1.5, "high": 2.5}
    URGENCY_BOOST: float = 1.6             # applied to liquidity / negative-cash risks
    TOP_DECISIONS: int = 3                 # "Do this week" count on the Command Center

    # ─── Decisions ───
    SNOOZE_DEFAULT_DAYS: int = int(os.getenv("BH_SNOOZE_DAYS", "7"))
    # A dismissed decision does not resurrect within the same FY unless its ₹ impact
    # moves by at least this fraction (material change).
    DISMISS_REVIVE_MATERIALITY: float = float(os.getenv("BH_REVIVE_MATERIALITY", "0.25"))

    # ─── Snapshots (weekly memory; no scheduler in v1) ───
    # A "last week" snapshot must be at least this old to be used as the diff baseline.
    SNAPSHOT_MIN_AGE_DAYS: int = int(os.getenv("BH_SNAPSHOT_MIN_AGE_DAYS", "6"))

    # ─── Weekly AI briefing ───
    # OFF by default (R-SEC-1): the briefing sends grounded company aggregates to a
    # third-party LLM. Enabling it is an explicit, informed opt-in that accepts that
    # egress. When off, /briefing returns a deterministic, local-only summary — no
    # data leaves the server. Only aggregates are ever sent (no party names).
    BRIEFING_AI_ENABLED: bool = _flag("BH_BRIEFING_AI_ENABLED", "false")

    # ─── Caching (reuse the single aman cache switch/TTL) ───
    CACHE_ENABLED: bool = aman_settings.CACHE_ENABLED
    CACHE_TTL_SECONDS: int = aman_settings.CACHE_TTL_SECONDS
    BRIEFING_CACHE_TTL: int = int(os.getenv("BH_BRIEFING_TTL", "300"))   # AI prose: 5 min

    @property
    def pillar_keys(self) -> list[str]:
        return list(self.PILLAR_WEIGHTS.keys())

    @property
    def weights_valid(self) -> bool:
        """Guardrail: pillar weights must sum to 100 (kept honest in one place)."""
        return sum(self.PILLAR_WEIGHTS.values()) == 100


bh_settings = BusinessHealthSettings()
