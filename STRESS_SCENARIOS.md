# Business Health — 20 Stress‑Test Scenarios

Realistic Indian‑SME scenarios that probe the engine across **manufacturing, trading, services, seasonal, startups, and loss‑making** businesses. Each is designed to hit a specific behavior in `kpi.build_metrics` / `pillars.py` / the risk‑opportunity‑priority chain. Use them as a QA matrix and (later) as seeded fixtures.

**Verdict key:** ✅ handled correctly today · ⚠️ partial / misleading · ❌ known defect (see finding ref → `REVIEW_REPORT.md`).

| # | Sector | Primary thing it stresses | Verdict |
|---|---|---|---|
| 1 | Manufacturing | Runway vs term‑loan cash | ⚠️ L4 |
| 2 | Manufacturing | Working capital locked in stock | ⚠️ A5 |
| 3 | Manufacturing | Margin‑leak sum over many SKUs | ✅ / P3 perf |
| 4 | Manufacturing | Job‑work: no finished‑goods sales | ✅ |
| 5 | Trading | Supplier concentration (unmeasured) | ⚠️ A4 |
| 6 | Trading | Cash sales, "(No Ledger)" concentration | ❌ M4 |
| 7 | Trading | Growth up, collections deteriorating | ✅ |
| 8 | Trading | Single mega‑contract, lumpy | ⚠️ M1/L4 |
| 9 | Services | Project‑lumpy revenue, no inventory | ✅ |
| 10 | Services | Client advances (credit balances) | ⚠️ |
| 11 | Services | No output GST (composition/exempt) | ❌ M3 |
| 12 | Services | Steady, healthy (control case) | ✅ |
| 13 | Seasonal | 3 contiguous active months | ⚠️ run‑rate |
| 14 | Seasonal | Two seasons, mid‑year lull | ❌ M2 |
| 15 | Seasonal | Snapshot off‑season vs peak | ⚠️ |
| 16 | Startup | Pre‑revenue, funded, accelerating burn | ⚠️ A3 |
| 17 | Startup | First FY, one customer = 100% | ⚠️ |
| 18 | Startup | Sparse data / near‑dormant | ⚠️ robustness |
| 19 | Loss‑making | Large loss buries small wins | ❌ M1 |
| 20 | Loss‑making | Turnaround: improving but still negative | ⚠️ |

---

## Manufacturing

### 1 — Auto‑components manufacturer, term‑loan financed
**Profile:** ₹8 Cr turnover, 9% net margin, ₹3 Cr term loan drawn this year for a new line. Operating cash is negative (inventory build‑up + capex), but a ₹1.5 Cr loan drawdown makes total cash flow net positive.
**Stresses:** runway numerator uses *all‑in* cash‑flow net (incl. financing).
**Correct behavior:** flag that *operating* cash is burning despite a positive all‑in balance.
**Today:** ⚠️ `runwayMonths` reads healthy/`None` because the loan inflow offsets the operating burn (**L4 → A2**). Liquidity pillar overstates health.

### 2 — Textile mill, heavy WIP & finished‑goods stock
**Profile:** ₹12 Cr turnover, 30% gross / 4% net margin, ₹4 Cr tied up in WIP and finished goods, slow‑moving lines.
**Stresses:** gross‑vs‑net margin split; working capital sunk in inventory.
**Correct behavior:** collections/liquidity should reflect cash trapped in stock; opportunity to release it.
**Today:** ⚠️ margins compute correctly, but stock‑locked working capital isn't a scored driver — only zero/negative stock is flagged (**A5**). The biggest liquidity lever is invisible.

### 3 — Pharma manufacturer, hundreds of SKUs, some sold below cost
**Profile:** OPC pharma, 400+ SKUs, a tail of loss‑making items (promotional / near‑expiry dumping).
**Stresses:** `opportunity._margin_leak` summing negative gross profit over many items via `performance_list` (limit=0 → full scan).
**Correct behavior:** surface the ₹ leak and count of loss SKUs.
**Today:** ✅ correct output; ⚠️ `performance_list` is a heavy full aggregation run **on every `/overview` and `/score`** load (**P3**) — the perf hit scales with SKU count.

### 4 — Job‑work manufacturer, revenue = labour charges
**Profile:** No finished‑goods sales; income is job‑work/labour, minimal `inventoryEntries`.
**Stresses:** margin‑leak finds nothing; item‑based drivers empty.
**Correct behavior:** score on P&L/cash/collections; no false inventory opportunities.
**Today:** ✅ empty‑inventory paths degrade cleanly; margin‑leak returns none.

---

## Trading

### 5 — FMCG distributor, one principal supplier + one anchor retailer
**Profile:** 2% net margin, high turnover; 70% of purchases from one principal, 40% of sales to one supermarket chain.
**Stresses:** concentration risk on **both** sides.
**Correct behavior:** flag customer *and* supplier dependency.
**Today:** ⚠️ customer concentration flags correctly; **supplier concentration is not measured** despite `top_vendors` being available (**A4**). Half the continuity risk is missed.

### 6 — Cash‑and‑carry wholesaler, mostly counter sales
**Profile:** Minimal receivables; most sales are cash with no party ledger → a large `"(No Ledger)"` bucket in `top_customers`.
**Stresses:** concentration on a non‑customer bucket; zero‑receivables collections path.
**Correct behavior:** concentration should ignore the cash bucket; collections pillar healthy (no receivables).
**Today:** ❌ `concentrationTop1` can report `"(No Ledger)"` as the dominant "customer" and raise a false concentration risk (**M4**). ✅ the zero‑receivables collections special‑case (score 90) works.

### 7 — Electronics dealer, sales doubled, receivables ballooning
**Profile:** Sales +110% YoY, but receivables grew +180%; DSO stretching.
**Stresses:** simultaneous strong‑growth + deteriorating‑collections signals.
**Correct behavior:** Growth pillar high **and** a collections/receivables risk raised.
**Today:** ✅ both fire; a good multi‑signal case (growth 100, `receivables‑high` risk, collections band worsens).

### 8 — Commodity trader, single ₹5 Cr contract for the year
**Profile:** One large deal booked in one month; otherwise quiet.
**Stresses:** concentration = 100%, one‑spike momentum, run‑rate from a single active month.
**Correct behavior:** flag extreme concentration; treat the run‑rate as low‑confidence.
**Today:** ⚠️ concentration flags; but the mega‑contract's ₹ dominates `priority` normalization and the lumpy run‑rate distorts runway/collections (**M1 / L4**).

---

## Services

### 9 — IT consulting, project‑based lumpy revenue
**Profile:** High margin, no inventory, revenue in irregular chunks (milestone billing).
**Stresses:** momentum slope on a spiky series; inventory‑empty; runway from lumpy cash.
**Correct behavior:** no inventory opportunities; momentum/runway marked appropriately confident.
**Today:** ✅ handles empty inventory; ⚠️ momentum slope and runway are noisy on lumpy series (inherent; mitigate via A3 confidence bands).

### 10 — Marketing agency, large client advances
**Profile:** Clients pay 50% upfront → some Sundry Debtors carry **credit** balances (advances received).
**Stresses:** outstanding classification (advances vs receivables).
**Correct behavior:** advances shouldn't inflate receivables; ideally surfaced as a liquidity positive.
**Today:** ⚠️ `outstanding_service` counts only debit‑balance parties (`outstanding > 0`), so advances are excluded from receivables (correct) but never surfaced as available cash context. Net working‑capital read is incomplete, not wrong.

### 11 — CA / law firm, composition or exempt, no output‑GST ledger
**Profile:** Professional services with no CGST/SGST output ledgers (composition or exempt supply).
**Stresses:** `gstConsistent = not (sales>0 and gstOutputTax==0)`.
**Correct behavior:** absence of output GST is *legitimate*, not a hygiene defect.
**Today:** ❌ hygiene docks 15 points for "GST capture: check" (**M3**). A visibly unfair red that erodes trust.

### 12 — Facility‑management, steady and healthy (control case)
**Profile:** Predictable monthly revenue, 12% net margin, positive cash flow, diversified clients, clean books.
**Stresses:** the "everything is fine" baseline.
**Correct behavior:** high score, all pillars green, few/no risks, opportunities modest.
**Today:** ✅ sanity control — should score B/A with 100% coverage.

---

## Seasonal

### 13 — Firecracker trader, active 3 contiguous months
**Profile:** ~90% of sales in Sep–Nov; idle otherwise. Months are **contiguous**.
**Stresses:** `nActiveMonths=3`; run‑rate annualization; runway if viewed in the off‑season.
**Correct behavior:** run‑rates understood as seasonal, not annualized naïvely.
**Today:** ⚠️ contiguous season → `monthGaps=0` (no false hygiene hit, good), but `avgMonthlySales` over 3 months makes `collectionsMonths` and runway seasonally skewed depending on when the page is viewed (**A6**).

### 14 — AC / cooler dealer, two seasons with a mid‑year lull
**Profile:** Sells in peak summer (Apr–Jun) and festive (Oct–Dec); genuinely idle Jul–Sep and Jan–Mar.
**Stresses:** `_month_gaps` counts the Jul–Sep zero months *between* active periods.
**Correct behavior:** off‑season ≠ missing bookkeeping.
**Today:** ❌ hygiene penalized for legitimate off‑season gaps (**M2**). Classic seasonal false‑positive.

### 15 — Fertilizer seller, page opened off‑season vs peak
**Profile:** Kharif/Rabi cycle; a snapshot lands in a lull, the next in peak.
**Stresses:** week‑over‑week `whatChanged` and `trend7d` across a seasonal boundary.
**Correct behavior:** compare like‑to‑like periods.
**Today:** ⚠️ "what changed" shows huge, misleading swings driven by seasonality, not performance (**A6**). Trend arrow can mislead.

---

## Startups

### 16 — Pre‑revenue SaaS, 2 months of data, well‑funded
**Profile:** ₹5 Cr seed in the bank, negligible revenue, spend ramping month‑on‑month.
**Stresses:** `salesYoY=None`, `nActiveMonths≤2`, linear regression on <2 real points, runway from a huge cash balance vs a *rising* burn.
**Correct behavior:** low coverage, low confidence, and a runway that accounts for accelerating spend.
**Today:** ⚠️ growth pillar → coverage 50 (good); but runway uses *average* burn and can read comfortably long while spend is doubling (**A3**). Thin‑data confidence is signalled but the headline number can reassure falsely.

### 17 — D2C startup, first FY, one customer = 100% of sales
**Profile:** Single marketplace/anchor buyer; no prior‑year baseline.
**Stresses:** concentration = 100%, `salesYoY=None`, everything single‑period.
**Correct behavior:** extreme concentration danger; growth scored from within‑year trend at low coverage.
**Today:** ⚠️ concentration danger fires correctly; growth falls back to slope at coverage 50 (reasonable). Watch the `"(No Ledger)"` interaction if the buyer isn't a proper ledger (**M4**).

### 18 — Bootstrapped micro‑services startup, a handful of vouchers
**Profile:** ₹2–3 L annual, few dozen vouchers, some months truly empty.
**Stresses:** division‑by‑zero guards (`avgMonthlySales=0` → `collectionsMonths=None`, runway `None`), several pillars `None`, overall from 1–2 pillars.
**Correct behavior:** no crashes; low coverage; overall clearly caveated.
**Today:** ⚠️ math is guarded (no crash), but an overall computed from 1–2 available pillars can look deceptively confident despite low `coverage`. Also the whole surface depends on `build_metrics` not throwing on sparse/odd data (**C3 robustness** — the key thing to fixture‑test here).

---

## Loss‑making

### 19 — Loss‑making manufacturer (the live `natraj` case)
**Profile:** ₹1.58 Cr sales, **₹1.21 Cr net loss**, ₹1.1 L cash, ~1.2‑month runway.
**Stresses:** net‑loss risk with `rupeesAtRisk ≈ ₹1.21 Cr` dominating `priority` normalization; liquidity crushed.
**Correct behavior:** headline the loss/cash crisis **and** still surface the small, doable win (collect overdue, fix a leaking SKU).
**Today:** ❌ the ₹1.21 Cr loss normalizes every smaller opportunity toward zero, so the weekly top‑3 becomes big‑number risks the owner already knows; the actionable ₹ items get buried (**M1**). Verified live. Liquidity pillar → ~0 (correct).

### 20 — Turnaround retailer, still loss‑making but improving
**Profile:** Net loss narrowed from ₹40 L to ₹12 L YoY; margin still negative but rising; cash stabilizing.
**Stresses:** negative absolute result **with** a positive trend; interplay of `net‑loss` (danger) vs `margin‑compression` (only fires on decline).
**Correct behavior:** acknowledge the loss *and* credit the improvement; verdict tone should reflect momentum.
**Today:** ⚠️ `net‑loss` danger fires (correct); `margin‑compression` correctly does **not** (it's improving); a `profit‑growth` positive insight fires if change ≥ +10%. But the **verdict** template leads with the danger and doesn't convey "improving," so a recovering business reads as pure crisis. Tone/nuance gap.

---

## Cross‑cutting edge cases (fold into fixtures)

- **Negative / returns‑heavy period:** heavy credit notes can drive net sales toward zero → `revenue≈0` makes `netMargin`/`grossMargin` `None` (guarded) and several pillars drop out. Verify graceful `None` handling, not `0`‑as‑real.
- **Negative closing stock:** already flagged by inventory; ensure it doesn't corrupt margin‑leak sums.
- **Multi‑company rapid switching:** switch across 4 tenants quickly — confirm the tenant‑scoped `report_cache` key and the company‑scoped query keys prevent any cross‑company bleed (isolation regression test).
- **Serialization:** decisions/snapshots carry `datetime`/`ObjectId`; confirm every client‑facing payload passes through `serialize_docs` (spot‑checked; keep a test).
- **Concurrency:** two simultaneous `/overview` loads — the canary for C1/C2 duplicate decisions/snapshots (add once unique constraints land).
