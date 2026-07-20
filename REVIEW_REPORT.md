# Business Health v1 — Principal Engineer Pre-Production Review

**Scope:** `Backend/app/aman/business_health/**`, its wiring into `app/aman/routes/routes.py`, and the LiveTally frontend under `livetally/src/pages/BusinessHealth/**`.
**Method:** static read of the implementation + a live run against tenant `natraj` (FY 2024‑25) + the 13‑case unit suite. **No code was modified.**
**Verdict:** **Conditional pass.** The architecture is sound and every figure reconciles by construction. Ship is gated on a small number of **correctness‑under‑concurrency** and **robustness** fixes (§Findings C1–C4) and two **operational** decisions (multi‑worker deployment, third‑party data egress — see `PRODUCTION_RISKS.md`).

---

## 1. Scorecard

| Dimension | Grade | One‑line |
|---|---|---|
| Correctness (single request) | A– | Reconciles to the rupee; verified live. |
| Correctness (concurrent / multi‑worker) | **C** | No unique constraints → duplicate decisions & snapshots races. |
| Robustness | **C+** | One failing report service 500s the whole module (no per‑section degrade). |
| Performance | B– | Hot paths rebuild heavy metrics uncached; briefing has no request coalescing. |
| Scalability | **C+** | In‑process cache + per‑process guards; does not survive horizontal scaling. |
| Security / Privacy | **C** | Auto‑egress of financials to a third‑party free LLM; no per‑company authz (inherited). |
| Company isolation | B+ | Collections + cache are tenant‑scoped; one inherited authz gap. |
| Maintainability | B | Clean layering; the untyped "god metrics" dict is the main debt. |

---

## 2. What's genuinely good (keep it)

- **Reconciliation by construction.** The module *consumes* `dashboard_service` / `pl_service` / `outstanding_service` / `inventory_service` / `gst_service` — it never re‑does accounting. Live run confirmed BH receivables/margin/cash equal the Receivables/P&L/Dashboard endpoints exactly.
- **Deterministic core, thin AI layer.** Scores, ₹ values and ranking are pure Python and reproducible (`pillars.py`, `engines/*`); the LLM only writes prose and degrades gracefully.
- **Honesty surfaced, not hidden.** Per‑pillar `coverage`, proxy `confidence` flags, and `null`‑means‑not‑computable are threaded end‑to‑end.
- **Isolation of state.** `aman_decisions` / `aman_health_snapshots` live in the tenant DB; the report cache is keyed by tenant.
- **Idempotency *intent*** via stable `sourceId` — the right design; it just needs a DB constraint to be safe under concurrency.

---

## 3. Findings (by severity)

Severity = Critical (block prod) · High (fix before wide rollout) · Medium · Low.

### Critical

**C1 — Duplicate decisions under concurrent generation.**
`service.generate_decisions` does *read‑then‑insert* (`repo.get_decision_by_source` → `insert_decision`) with only a **non‑unique** index on `(fy, sourceId)` (`repository.ensure_indexes`). `/overview` calls `generate_decisions` on **every** request, so two concurrent Command‑Center loads (or two browser tabs) can both miss the existing row and insert duplicates for the same `sourceId`.
*Impact:* duplicate "Do this week" cards; the ledger's core promise (one live decision per source) breaks.
*Fix:* make the index `unique=True` on `(fy, sourceId)` and switch generation to an `update_one(..., upsert=True)` keyed on `(fy, sourceId)`; catch `DuplicateKeyError` as a no‑op.

**C2 — Duplicate weekly snapshots under concurrency / multi‑worker.**
`snapshots.maybe_write_weekly` reads the latest snapshot, compares `period`, then inserts — no unique constraint on `(fy, period)`. Two simultaneous `/overview` or `/score` calls in the same ISO week both pass the check and insert two rows.
*Impact:* trend series and "what changed" double‑count a week; `trend7d` can read the wrong baseline.
*Fix:* unique index on `(fy, period)`; insert‑and‑ignore‑duplicate, or `update_one(upsert=True)`.

### High

**C3 — No per‑section degradation in `kpi.build_metrics`.**
Unlike the AI‑CFO `context_builder` (which wraps every loader in `_safe`), `build_metrics` calls `build_profit_loss`, `ds.kpis`, `ds.monthly_trend`, `ds.cash_flow`, `top_customers`, `receivables`, `payables` **unguarded**. A single failing report on one odd tenant 500s the *entire* Business Health surface (score, KPIs, decisions, overview).
*Impact:* one bad tenant → total module outage for that company.
*Fix:* wrap each source call defensively; on failure set the affected metrics to `None` and let coverage/`null` reflect the gap (the module already tolerates `None` everywhere).

**C4 — Writes on GET + non‑atomic side effects on hot paths.**
`/overview` and `/decisions` (GET) trigger DB writes via `list_decisions` (`_reopen_elapsed_snoozes`, `_evaluate_outcome`) and, for `/overview`, `generate_decisions` + snapshot write. GETs should be safe/idempotent; here they mutate, and the mutations are read‑then‑write races (compounds C1/C2).
*Impact:* surprising side effects, wasted writes under refetch/concurrency, harder caching/observability.
*Fix:* move generation/snapshotting to an explicit idempotent step (or a `POST`/background tick) and make outcome/snooze updates upsert‑safe; at minimum guard with the unique constraints from C1/C2.

**P1 — `/simulate` rebuilds the full heavy metrics on every (debounced) slider move.**
The route calls `service.metrics(db, use_fy, overrides=…)` = a fresh, **uncached** `build_metrics` (multiple aggregations) per call, even though overrides only patch a handful of already‑computed values via `kpi._apply_overrides`.
*Impact:* a user dragging a slider fires repeated multi‑aggregation rebuilds; needless DB load.
*Fix:* reuse the cached base metrics: `base = _metrics(db, tenant, fy); sim = kpi._apply_overrides(base, overrides)`. (And/or ship the client‑side deterministic mirror that was in the original plan.)

**P2 — `act()` rebuilds full metrics on a user click.**
`service.act` calls `kpi.build_metrics(db, fy)` uncached just to stamp `baselineValue`.
*Impact:* every "I did this" incurs a full metrics rebuild (~1–3 s on a large tenant).
*Fix:* accept the baseline from the caller (route already has cached metrics), or read the single `metricKey` cheaply.

**P3 — `/overview` computes risks + opportunities twice and runs uncached inventory aggregations each call.**
`build_overview` calls `_risks_and_opps` inside `generate_decisions` **and** again for the verdict; `opportunity.evaluate` runs `inventory_service.performance_list` + `stock_alerts` (heavy) every time, and `/overview` is uncached (side effects).
*Impact:* the landing endpoint is the most expensive one and does redundant work.
*Fix:* compute risks/opportunities once and thread them through; cache the derived risk/opp lists (already done for `/risks`, `/opportunities`) and reuse inside overview.

**S1 — Automatic egress of financials to a third‑party free LLM.** (see `PRODUCTION_RISKS.md` → R‑SEC‑1)
`briefing._facts` sends sales, net profit, cash, receivables, payables, **top‑customer name**, and decision titles to OpenRouter (a free NVIDIA model) automatically on Command‑Center load. Free tiers may log/retain/train on inputs.

**S2 — No per‑company authorization (inherited platform gap).** (see `PRODUCTION_RISKS.md` → R‑SEC‑2)
`require_aman_subscription` checks `app == "aman"` + active sub, but **not** that `x-company-id` is in the token's `companies` claim. Any authenticated aman user can read/mutate any company's Business Health by changing the header. Pre‑existing for all `/api/v3`, but BH raises the stakes (derived intelligence + a writable ledger).

### Medium

**M1 — Priority normalization buries small opportunities behind large risks.**
`priority._score` normalizes by the **max ₹** in the set. A ₹1.2 Cr net‑loss risk (observed live on `natraj`) makes a genuine ₹50 k collect‑overdue opportunity score ≈ 0.0004, so it never reaches the top‑3.
*Fix:* normalize opportunities and risks on **separate** scales, or use a log/however‑bounded transform, and guarantee at least one opportunity in the weekly top‑N.

**M2 — Hygiene `monthGaps` false‑positives on seasonal / intermittent businesses.**
`kpi._month_gaps` penalizes zero‑activity months *between* active months. A two‑season business (e.g. active Apr–Jun and Oct–Dec) is docked for a legitimate off‑season, conflating "no bookkeeping" with "no business." (Contiguous seasons and mid‑year onboarding are fine.)
*Fix:* gate the penalty on evidence of *missing* postings (e.g. a gap surrounded by activity **and** open bills/stock movement), or make it configurable / advisory rather than scored.

**M3 — Hygiene GST check false‑positives on composition / exempt / unregistered dealers.**
`gstConsistent = not (sales>0 and gstOutputTax==0)` flags any seller with no output‑GST ledger — but composition dealers, exempt supplies, and unregistered businesses legitimately have none, and lose 15 hygiene points.
*Fix:* detect the registration/scheme (or the presence of any GST ledgers at all) before applying the penalty; otherwise mark it "not applicable," not a deduction.

**M4 — Customer concentration counts the "(No Ledger)" bucket.**
`top_customers` can return `"(No Ledger)"` (cash sales without a party) as the top row; `concentrationTop1` then reports a non‑customer as the dominant "customer."
*Fix:* exclude the no‑ledger / cash bucket from concentration, or label it distinctly.

**P4 — Briefing has no request coalescing (thundering herd) and holds a sync worker 60–180 s.**
`cached_report` populates only *after* the first build finishes, so N concurrent `/briefing` calls each invoke the LLM; each call blocks a threadpool worker for up to `REQUEST_TIMEOUT` (180 s).
*Fix:* single‑flight lock around the briefing build; consider streaming (SSE) like the AI‑CFO chat, and a shorter timeout with graceful degrade.

### Low

- **L1 — `report_cache` is unbounded (TTL‑only).** Grows with tenants × FYs × BH keys; fine for a handful of tenants, memory‑unbounded at scale (see Scalability, `PRODUCTION_RISKS.md`).
- **L2 — `verdict` string slicing** (`title[0].lower()+title[1:]`) assumes non‑empty titles; safe today (constants) but fragile.
- **L3 — `rupeeImpact` overloaded for risks** (stores "at risk" amount). Works, but the field name lies for `kind == "risk"`.
- **L4 — Runway basis mismatch.** Numerator uses full cash‑flow net (incl. financing/investing); denominator uses P&L‑active months. Directionally fine, but a term‑loan inflow can mask operating burn (see scenarios #2, #10).
- **L5 — Frontend `keepPreviousData: true`** is the TanStack Query v4 spelling; v5 wants `placeholderData: keepPreviousData`. Likely a no‑op/deprecation warning.
- **L6 — `/decisions` (no status filter) is unpaginated** and returns all‑time rows; acted/dismissed accumulate over years. Bounded enough for v1, revisit later.
- **L7 — `cancelledRate` denominator includes non‑accounting vouchers** (orders/delivery notes), diluting the rate slightly.

---

## 4. Test‑coverage assessment

Strong on pure determinism/idempotency/lifecycle (13 cases, all green) and one live reconciliation. **Gaps:** concurrency (C1/C2 are exactly what the fake‑DB tests can't catch), `build_metrics` robustness on partial data (C3), multi‑worker guards, and the seasonal/composition/no‑ledger false‑positives (M2–M4). See `STRESS_SCENARIOS.md` for a 20‑case matrix that targets these.

---

## 5. Recommended gate before production

1. **Must fix:** C1, C2 (unique constraints + upsert), C3 (defensive metrics), C4 (stop writing on GET / make side effects safe).
2. **Decide (ops):** multi‑worker strategy (Redis or single‑flight guards) and the LLM data‑egress policy (R‑SEC‑1), per‑company authz (R‑SEC‑2).
3. **Should fix before wide rollout:** P1, P2, P3, M1–M4.
4. Everything else → `FUTURE_IMPROVEMENTS.md`.
