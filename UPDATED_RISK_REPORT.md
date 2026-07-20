# Business Health v1 — Updated Risk Register (post‑remediation)

Supersedes `PRODUCTION_RISKS.md`. Status after the remediation pass. Legend — Likelihood/Impact: 🔴 High · 🟠 Medium · 🟢 Low. Status: ✅ Resolved · 🟡 Reduced/residual · ⬜ Open (accepted for v1).

| ID | Risk | Before | After | Status |
|---|---|---|---|---|
| R‑CONC‑1 | Duplicate decisions & snapshots under concurrency | 🔴/🟠 | 🟢/🟢 | ✅ Resolved |
| R‑DEPLOY‑1 | Multi‑worker breaks core guarantees | 🔴/🔴 | 🟢/🟠 | 🟡 Correctness resolved; cache perf residual |
| R‑ROBUST‑1 | One failing report 500s the module | 🟠/🔴 | 🟢/🟢 | ✅ Resolved |
| R‑SEC‑1 | Auto‑egress of financials to third‑party LLM | 🔴/🔴 | 🟢/🟠 | ✅ Resolved (opt‑in, default off) |
| R‑SEC‑2 | No per‑company authorization | 🟠/🔴 | 🟢/🟠 | 🟡 Enforced for BH; platform‑wide residual |
| R‑SEC‑3 | Writable ledger, company‑wide visibility | 🟢/🟠 | 🟢/🟠 | ⬜ Accepted (approved scope) |
| R‑PERF‑1 | Briefing holds a worker 60–180 s | 🟠/🟠 | 🟢/🟢 | 🟡 Default path instant; residual only when AI opt‑in |
| R‑PERF‑2 | Hot paths rebuild heavy metrics | 🔴/🟠 | 🟠/🟠 | ⬜ Open (perf enhancement, not a blocker) |
| R‑CAP‑1 | Unbounded in‑process cache | 🟠/🟢 | 🟠/🟢 | ⬜ Open (Redis deferred) |
| R‑TRUST‑1 | False‑positive hygiene penalties | 🔴/🟠 | 🟢/🟢 | ✅ Resolved (M2, M3) |
| R‑TRUST‑2 | Concentration mislabels cash bucket | 🟠/🟠 | 🟢/🟢 | ✅ Resolved (M4) |
| R‑TRUST‑3 | Priority buries small wins | 🔴/🟠 | 🟢/🟢 | ✅ Resolved (M1) |
| R‑TRUST‑4 | Runway masks operating burn | 🟠/🟠 | 🟠/🟠 | ⬜ Open (modeling — A2) |

---

## Resolved (verified)

- **R‑CONC‑1 / R‑ROBUST‑1 / R‑TRUST‑1/2/3** — unique `(fy,sourceId)` and `(fy,period)` indexes + `DuplicateKeyError` handling; defensive `build_metrics`; per‑kind priority + guaranteed opportunity; advisory month‑gaps; GST applicability; concentration bucket exclusion. Covered by 6 new unit tests + the live run.
- **R‑SEC‑1** — briefing is opt‑in (`BH_BRIEFING_AI_ENABLED`, default off). Live run confirmed `/briefing` returns `aiDisabled: true` with no egress. **Residual (🟠 impact):** when an operator opts in, the egress + provider‑DPA considerations from the original R‑SEC‑1 apply — document the choice and prefer a no‑train provider for financial data (see D2).

## Reduced / residual

- **R‑DEPLOY‑1 (🟡).** Correctness is now multi‑worker‑safe (DB constraints). **Residual:** the in‑process `report_cache` is per‑worker, so under N workers you pay up to N× the heavy‑build cost and can serve values that differ by up to one TTL between workers — a **performance/consistency‑of‑freshness** issue, not a correctness one. Mitigate with Redis before scaling out (deferred, no new infra now).
- **R‑SEC‑2 (🟡).** Enforced for the Business Health router. **Residual:** other `/api/v3` modules still lack the check; promote `require_company_access` platform‑wide, and flip the "no `companies` claim → allow" compatibility branch to **deny** once every issued token carries the claim.

## Open — accepted for v1 (tracked in FUTURE_IMPROVEMENTS)

- **R‑PERF‑2** — `/simulate` and `act()` still rebuild uncached metrics; `/overview` still runs inventory aggregations per load (halved the risk/opp double‑compute in C4). Enhancement: reuse cached metrics / client‑side simulator (C1, C1‑fe in FUTURE_IMPROVEMENTS).
- **R‑CAP‑1** — cache size cap / Redis.
- **R‑SEC‑3** — role‑based decision mutation + append‑only audit, if decisions ever gate money movement.
- **R‑TRUST‑4** — operating‑cash runway basis (A2).

## Net go‑live posture
All **go‑live blockers are cleared or reduced to accepted residuals**. Two operational decisions remain product/ops calls rather than code: (1) whether/when to enable the AI briefing (and with which provider), and (2) deployment topology (single‑worker now, or Redis before scaling out). Both are documented; neither blocks a controlled launch.
