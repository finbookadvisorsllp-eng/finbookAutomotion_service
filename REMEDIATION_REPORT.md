# Business Health v1 — Remediation Report

Follow‑up to `REVIEW_REPORT.md` / `PRODUCTION_RISKS.md`. All P0/P1/P2 items were addressed under the stated rules (preserve API + frontend contracts, minimal changes, no new infrastructure, deterministic over heuristics, isolation preserved, partial‑failure resilient). **No code committed.**

**Re‑verification:** `19/19` unit tests pass (13 original + 6 new); live reconciliation on tenant `natraj` (FY 2024‑25) still ties BH figures to the Receivables / P&L / Dashboard endpoints exactly; briefing now defaults to **no third‑party egress**.

---

## 1. What changed, by finding

### P0

**C1 — duplicate decisions (concurrency).**
`repository.ensure_indexes` now creates a **unique** compound index on `aman_decisions (fy, sourceId)`; `service.generate_decisions` inserts inside a `try/except DuplicateKeyError` and, on a lost race, falls through to the "refresh if open" branch. Generation is now race‑safe and multi‑worker‑safe.
*Files:* `repository.py`, `service.py`.

**C2 — duplicate weekly snapshots (concurrency).**
Unique compound index on `aman_health_snapshots (fy, period)`; `snapshots.maybe_write_weekly` catches `DuplicateKeyError` and returns `None`. At most one snapshot per ISO week per company, regardless of concurrency/workers.
*Files:* `repository.py`, `snapshots.py`.

**C3 — one failing report took down the whole module.**
`kpi.build_metrics` now wraps every source call (`build_profit_loss`, `ds.kpis`, `ds.monthly_trend`, `ds.cash_flow`, `top_customers`, `receivables`, `payables`) in a `_safe(...)` shim; a failed source degrades its section to `None` (the pillars/coverage already treat `None` as "not computable"), so a single bad report no longer 500s Business Health. Cash / receivables / payables now become `None` (not a misleading `0`) on failure, so the affected pillar drops out and coverage reflects the gap.
*Files:* `engines/kpi.py`.

**C4 — writes on GET / non‑atomic side effects.**
The self‑maintaining behaviour (approved) is retained but made safe: the snooze sweep is now a single atomic `update_many` (`repository.reopen_elapsed_snoozes`) instead of an N‑write read‑then‑write loop; `build_overview` computes risks/opportunities **once** and threads them into both the decision generator and the verdict (was computed twice); and the generation/snapshot writes are now race‑safe via C1/C2. Outcome‑evaluation writes remain idempotent (only on verdict change).
*Files:* `service.py`, `repository.py`.

**R‑SEC‑2 — no per‑company authorization.**
New reusable dependency `require_company_access` (in `core/dependencies.py`) enforces that `x-company-id` ∈ the token's `companies` claim, applied at the Business Health **router** level. Deterministic rule: `["*"]` (admin/dev) allowed; a concrete allowlist must contain the ref (else `403`); a token with no `companies` claim is allowed for backward compatibility (documented residual — flip to deny once all IAM tokens carry the claim). Contract‑preserving: only adds a `403`, already in the error contract; the frontend is unaffected (it always sends the user's own company).
*Files:* `core/dependencies.py`, `routes.py`.

### P1

**M1 — priority buried small opportunities behind large losses.**
`priority._score` now normalizes opportunities and risks on **separate** scales (each ₹ against the max within its own kind), so a ₹1.2 Cr loss no longer shrinks a ₹50 k opportunity to ≈0. `priority.top` additionally **guarantees at least one opportunity** in the weekly top‑N when any exist. Verified: the small opportunity's `priorityScore` stays > 0.3 alongside a ₹1.2 Cr risk, and appears in `top(cands, 1)`.
*Files:* `engines/priority.py`.

**M2 — seasonal businesses docked for off‑season "book gaps".**
The `monthGaps` deduction was removed from the hygiene **score**; idle months are now an **advisory driver** only. We cannot deterministically distinguish "missing bookkeeping" from a legitimate seasonal lull, and false‑penalising seasonal businesses erodes trust — so the deterministic choice is to not score it.
*Files:* `pillars.py`.

**M3 — composition/exempt/unregistered dealers docked for missing output GST.**
New pure helper `kpi._gst_consistent(sales, output, itc)` returns `(applicable, consistent)`: a business "operates under GST" only if it books output tax **or** claims ITC. A dealer with neither is `applicable=False` → no penalty. A registered dealer that claims ITC but books no output tax on sales is a genuine anomaly (`consistent=False`) and is still flagged. The hygiene driver shows `n/a` for non‑GST businesses.
*Files:* `engines/kpi.py`, `pillars.py`.

**M4 — cash / "(No Ledger)" bucket reported as the top "customer".**
New pure helper `kpi._concentration(top, sales)` excludes the `"(No Ledger)"` / empty bucket before computing top‑1/3/5 share and the top‑customer name (loader now pulls 6 rows so 5 real customers survive the filter). Cash‑heavy businesses no longer get a false concentration flag.
*Files:* `engines/kpi.py`.

### P2

**R‑SEC‑1 — automatic egress of financials to a third‑party LLM.**
New flag `BH_BRIEFING_AI_ENABLED` (`config.BRIEFING_AI_ENABLED`, **default `false`**). With it off, `/briefing` returns a deterministic, **local‑only** grounded summary (`degraded: true, aiDisabled: true`) — no company data leaves the server. Enabling it is an explicit, informed opt‑in. The payload was already aggregates‑only (no party names). Contract‑preserving: `aiDisabled` is an additive field; the frontend already renders `text` + the degraded state. Bonus: the default path is now instant (no 60–180 s model wait).
*Files:* `config.py`, `briefing.py`.

**R‑DEPLOY‑1 — multi‑worker correctness.**
Addressed by C1/C2: correctness no longer depends on a single process — the unique indexes make decision generation and snapshotting safe across workers/replicas. The in‑process cache remains per‑worker (a **performance‑only** concern, not correctness); Redis is deferred to `FUTURE_IMPROVEMENTS.md` (no new infra introduced now).

---

## 2. New / changed tests (19 pass)

| Test | Locks |
|---|---|
| `test_priority_separate_scales_and_guaranteed_opportunity` | M1 — small opp survives a ₹1.2Cr risk & appears in top‑N |
| `test_hygiene_month_gaps_are_advisory` | M2 — gaps=0 and gaps=6 score identically |
| `test_gst_applicability_rule` | M3 — composition safe; registered anomaly still flagged |
| `test_concentration_excludes_no_ledger_bucket` | M4 — cash bucket excluded |
| `test_snooze_sweep_is_atomic` | C4 — single `update_many` reopens only elapsed snoozes |
| `test_company_access_authorization` | R‑SEC‑2 — wildcard/allow/deny/compat rule |
| (existing 13) | determinism, idempotency, lifecycle, snapshot guard, diff, degraded briefing |

The fake‑Mongo harness gained `update_many` to exercise the atomic sweep. Concurrency itself (C1/C2 DuplicateKey races) is enforced by the unique indexes at the real‑Mongo layer — the live run confirmed generation stays idempotent (0 created on re‑run).

---

## 3. Contract & scope compliance

- **API contract:** unchanged paths/methods/response shapes. Only additive fields (`briefing.aiDisabled`, `/health.briefingAiEnabled`) and a new `403` (already documented). ✅
- **Frontend contract:** no frontend files changed; existing components consume the unchanged shapes. ✅
- **Minimal changes / no new infra:** 8 backend files touched; no new services, queues, or datastores. ✅
- **Deterministic over heuristics:** every fix is a deterministic rule (unique constraints, per‑kind normalization, applicability test) — no ML/thresholds‑guessing added; M2 *removed* a heuristic that caused false positives. ✅
- **Company isolation:** strengthened (R‑SEC‑2) and preserved everywhere else. ✅
- **Partial‑failure resilience:** materially improved (C3). ✅

## 4. Files touched
`business_health/`: `config.py`, `repository.py`, `snapshots.py`, `service.py`, `pillars.py`, `engines/kpi.py`, `engines/priority.py`, `routes.py` · `core/dependencies.py` · `tests/test_business_health.py`. Version bumped to `1.0.1-alpha`.

## 5. Not done (deliberately, deferred to FUTURE_IMPROVEMENTS)
Perf items P1–P4 from the review (client‑side simulator, `act()`/`simulate` metric reuse, Redis, streaming briefing) are **enhancements**, not blockers, and were out of the requested P0–P2 set. Runway‑basis (L4) and supplier concentration (A4) remain modeling improvements.
