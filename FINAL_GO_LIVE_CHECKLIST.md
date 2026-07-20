# Business Health v1 — Final Go‑Live Checklist

Gate for a controlled production launch of the Business Health module. Status reflects the post‑remediation build (`business_health 1.0.1-alpha`). **Not committed.**

---

## A. Correctness & data integrity  — ✅ ready

- [x] Decision generation idempotent & race‑safe — unique `(fy, sourceId)` index + `DuplicateKeyError` handling (C1)
- [x] Weekly snapshot writes at most once per ISO week, race‑safe — unique `(fy, period)` index (C2)
- [x] Partial‑failure resilient — one failing report degrades a section, not the module (C3)
- [x] Side effects on read are atomic/idempotent — single `update_many` snooze sweep; risks/opps computed once (C4)
- [x] Every figure reconciles to its report — live `natraj` run (receivables/margin/cash == Receivables/P&L/Dashboard)
- [x] Deterministic & reproducible score/simulate — unit‑verified
- [x] 19/19 unit tests pass; frontend `npm run build` clean

## B. Security & isolation  — ✅ ready (with residuals tracked)

- [x] Per‑company authorization on Business Health — `require_company_access` on the BH router (R‑SEC‑2)
- [x] No automatic third‑party data egress — briefing opt‑in, default off (R‑SEC‑1)
- [x] Tenant‑scoped collections & cache; cross‑company reads/writes blocked for BH
- [ ] **Decision (ops):** promote `require_company_access` platform‑wide and flip the "no `companies` claim → allow" branch to deny once all IAM tokens carry `companies` — *tracked, not a BH blocker*
- [ ] **Decision (product/legal):** if enabling the AI briefing, choose a provider with a DPA / no‑train guarantee for financial data — *only relevant if `BH_BRIEFING_AI_ENABLED=true`*

## C. Trust / data quality  — ✅ ready

- [x] Seasonal businesses not falsely penalized (month‑gaps advisory) (M2)
- [x] Composition/exempt/unregistered dealers not falsely penalized on GST (M3)
- [x] Concentration excludes the cash / "(No Ledger)" bucket (M4)
- [x] Small actionable opportunities not buried behind large losses (M1)
- [x] Proxy metrics carry confidence/coverage; `null` = not computable (never `0`)

## D. Deployment & ops  — ⬜ decide before scale‑out

- [x] **Multi‑worker correctness** — guaranteed by DB unique constraints (R‑DEPLOY‑1 correctness)
- [ ] **Topology decision:** launch single‑worker (fully correct + consistent cache), **or** move `report_cache` to Redis before running multiple workers/replicas (per‑worker cache is perf/freshness‑only, not correctness)
- [ ] Confirm indexes created on first request per tenant (lazy `ensure_indexes`) — or run a one‑off index build on the `aman_decisions` / `aman_health_snapshots` collections
- [ ] Set env vars intentionally: `BH_BRIEFING_AI_ENABLED` (default off), `AMAN_CACHE_TTL`, `BH_SNAPSHOT_MIN_AGE_DAYS`, `BH_SNOOZE_DAYS` — all have safe defaults
- [ ] Confirm `AMAN_AUTH_MODE=prod` in production (dev mode issues a wildcard‑company token that bypasses R‑SEC‑2)

## E. Observability & rollback  — ⬜ recommended

- [ ] Add BH build‑latency / cache‑hit / briefing‑degrade telemetry (FUTURE_IMPROVEMENTS F3) — recommended, not blocking
- [x] Feature is additive & isolated — rollback = remove the nav group + unregister the BH router (no schema migration to reverse; the two new collections are inert if unused)
- [ ] Decide a rollout ring (e.g. enable for a few pilot companies first via the nav group / a capability flag)

## F. Known accepted limitations for v1 (documented)

- Runway uses all‑in cash (financing incl.) — operating‑cash basis is a fast‑follow (A2 / R‑TRUST‑4)
- Supplier‑side concentration not yet measured (A4)
- Working capital locked in inventory not yet a scored driver (A5)
- `/simulate` and `act()` rebuild uncached metrics — perf enhancement, not a blocker (R‑PERF‑2)
- Live nav badges (score / open‑decision count) deferred (E1)

---

## Go / No‑Go summary

| Area | Verdict |
|---|---|
| Correctness / integrity | ✅ **Go** |
| Security / isolation | ✅ **Go** (2 platform/ops follow‑ups tracked) |
| Trust / data quality | ✅ **Go** |
| Deployment | ⬜ **Go, single‑worker** — Redis required before horizontal scale‑out |
| Observability | ⬜ **Go** — add telemetry as a fast‑follow |

**Overall: GO for a controlled (single‑worker / pilot‑ring) launch.** Two decisions are the operator's, not code blockers: the AI‑briefing enablement + provider, and the scale‑out cache. Recommended fast‑follows: platform‑wide `require_company_access`, BH telemetry, and the runway/perf enhancements.

**Not committed** — awaiting approval to branch, commit, and open a PR.
