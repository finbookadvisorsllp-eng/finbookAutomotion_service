# Business Health v1 — Production Risk Register

Operational, deployment, and go‑live risks for the Business Health module. Each risk has a **likelihood**, **impact**, current **exposure**, and a **mitigation**. Ordered by priority. Cross‑references to `REVIEW_REPORT.md` findings in brackets.

Legend — Likelihood/Impact: 🔴 High · 🟠 Medium · 🟢 Low.

---

## Go‑live blockers

### R‑CONC‑1 — Concurrency produces duplicate decisions & snapshots  [C1, C2]
- **Likelihood:** 🔴 High (two tabs / a refetch / any second worker triggers it) · **Impact:** 🟠 Medium
- **Exposure:** `generate_decisions` and `maybe_write_weekly` are read‑then‑write with non‑unique indexes; `/overview` runs both on every load.
- **Mitigation:** unique index on `aman_decisions (fy, sourceId)` and `aman_health_snapshots (fy, period)`; convert both writes to `upsert`/insert‑ignore‑duplicate. **Low effort, must‑do.**

### R‑DEPLOY‑1 — Multi‑worker / multi‑instance deployment breaks core guarantees  [L1, C1, C2]
- **Likelihood:** 🔴 High if deployed with `uvicorn --workers >1` or replicas · **Impact:** 🔴 High
- **Exposure:** Three per‑process assumptions leak across workers:
  1. `report_cache` is in‑process → each worker has its own cache (N× the "heavy build" load, inconsistent reads between workers).
  2. The "one snapshot per week" and "idempotent decision generation" guards rely on read‑then‑write with no DB constraint → every worker can duplicate (compounds R‑CONC‑1).
  3. `_indexed_dbs` / index creation is per‑process (harmless, just repeated).
- **Mitigation:** (a) fix R‑CONC‑1 so correctness no longer depends on a single process; (b) move the shared cache to Redis (the `cached_report` API already anticipates this) before scaling out; (c) document that until then the service is **single‑worker‑correct only**.

### R‑ROBUST‑1 — A single failing report service takes down all of Business Health  [C3]
- **Likelihood:** 🟠 Medium (odd/partial tenants exist — this codebase already carries tenant‑specific self‑heals) · **Impact:** 🔴 High
- **Exposure:** `build_metrics` has no per‑source guard; every BH endpoint depends on it.
- **Mitigation:** wrap each source call in a `_safe`‑style shim and degrade to `null`/reduced coverage (the module already tolerates `None`). Add a partial‑data tenant to the test matrix (`STRESS_SCENARIOS.md` #19).

---

## Security & privacy

### R‑SEC‑1 — Automatic egress of company financials to a third‑party free LLM  [S1]
- **Likelihood:** 🔴 High (fires on Command‑Center load) · **Impact:** 🔴 High (data governance)
- **Exposure:** `briefing.py` sends sales, net profit, cash, receivables/payables, **top‑customer name**, and decision titles to OpenRouter's free NVIDIA model. Free tiers commonly log/retain and may train on inputs; there is no DPA/residency guarantee, and this happens **without an explicit user action** (unlike the AI‑CFO chat, which the user opts into by asking).
- **Mitigation options (pick one before go‑live):**
  1. Make the briefing **opt‑in** (button), not auto‑loaded, and/or gate it behind a per‑tenant "AI enabled" flag.
  2. Route to a **paid provider with a DPA / no‑training guarantee** (or a self‑hosted model) for financial data.
  3. **Minimize the payload** — send aggregates only, strip party names, and disclose egress in the UI.
- **Note:** the deterministic verdict + KPIs already work with AI off; the briefing is additive, so opt‑in costs little.

### R‑SEC‑2 — No per‑company authorization on `x-company-id`  [S2]
- **Likelihood:** 🟠 Medium (requires an authenticated aman user tampering with the header) · **Impact:** 🔴 High
- **Exposure:** `require_aman_subscription` validates the product + subscription but **not** that the caller is entitled to the requested company. Any aman token + any `x-company-id` → that company's score, risks, customers, and a **writable** decision ledger. Inherited across all `/api/v3`, but BH both exposes sensitive derived intelligence and accepts mutations.
- **Mitigation:** enforce `x-company-id ∈ token.companies` (or an org‑membership lookup) in `get_db` / a dependency, platform‑wide. Until then, treat any company header from a valid token as authorized — document this as a known limitation and prioritize the platform fix.

### R‑SEC‑3 — Writable ledger with company‑wide visibility, audit‑only actor
- **Likelihood:** 🟢 Low · **Impact:** 🟠 Medium
- **Exposure:** Per the approved scope, any user of a company can `act`/`snooze`/`dismiss` any decision; only `actedBy` is recorded. No approval workflow, no immutability of the audit trail.
- **Mitigation:** acceptable for v1; if decisions later drive money movement, add role checks and an append‑only audit log.

---

## Performance & capacity

### R‑PERF‑1 — Briefing holds a sync worker 60–180 s with no coalescing  [P4]
- **Likelihood:** 🟠 Medium · **Impact:** 🟠 Medium (worker‑pool exhaustion under load)
- **Exposure:** `/briefing` is a sync endpoint (runs in the threadpool); the free model is slow; `cached_report` has no single‑flight, so concurrent misses each call the LLM and each pins a worker.
- **Mitigation:** single‑flight lock around the briefing build; shorter timeout with graceful degrade; consider SSE streaming. Combine with R‑SEC‑1 (opt‑in) to bound frequency.

### R‑PERF‑2 — Hot paths rebuild heavy metrics uncached  [P1, P2, P3]
- **Likelihood:** 🔴 High · **Impact:** 🟠 Medium
- **Exposure:** `/simulate` (per slider drag) and `act()` (per click) do full uncached `build_metrics`; `/overview` computes risks/opportunities twice and runs uncached inventory aggregations each load.
- **Mitigation:** reuse cached base metrics in simulate/act; compute risk/opp once per overview; the fixes are small and localized.

### R‑CAP‑1 — Unbounded in‑process cache  [L1]
- **Likelihood:** 🟠 Medium (grows with tenant count) · **Impact:** 🟢 Low→🟠 Medium
- **Exposure:** `TTLCache` evicts only by TTL; BH adds ~5 keys per (tenant, FY). Many tenants × FYs → steady memory growth until expiry.
- **Mitigation:** size cap / LRU eviction, or Redis (also solves R‑DEPLOY‑1). Low urgency at current tenant counts.

---

## Data‑quality / trust (erodes the moat if unaddressed)

### R‑TRUST‑1 — False‑positive hygiene penalties  [M2, M3]
- **Likelihood:** 🔴 High for seasonal & composition/exempt/unregistered businesses · **Impact:** 🟠 Medium
- **Exposure:** seasonal off‑seasons docked as "book gaps"; GST‑less legitimate dealers docked 15 points. Owners who spot an unfair red will distrust the whole score.
- **Mitigation:** M2/M3 fixes — make these advisory or scheme‑aware. **This is a trust risk, not just a math nit.**

### R‑TRUST‑2 — Concentration mislabels the cash / "(No Ledger)" bucket as a customer  [M4]
- **Likelihood:** 🟠 Medium (cash‑heavy retail/trading) · **Impact:** 🟠 Medium
- **Mitigation:** exclude the no‑ledger bucket from concentration.

### R‑TRUST‑3 — Priority buries small, actionable wins behind large losses  [M1]
- **Likelihood:** 🔴 High for any loss‑making tenant (see live `natraj`) · **Impact:** 🟠 Medium
- **Exposure:** the weekly "top 3" can be entirely large‑number risks the owner already knows about, hiding the ₹50k thing they could actually do this week.
- **Mitigation:** separate normalization scales for risks vs opportunities; guarantee ≥1 opportunity in the top‑N.

### R‑TRUST‑4 — Runway can look healthy while operating cash burns  [L4]
- **Likelihood:** 🟠 Medium (funded startups, term‑loan‑financed manufacturers) · **Impact:** 🟠 Medium
- **Mitigation:** base burn on operating cash flow (exclude financing/investing) or label runway as "all‑in cash" explicitly.

---

## Pre‑launch checklist

- [ ] Unique indexes + upsert for decisions & snapshots (R‑CONC‑1)
- [ ] Defensive `build_metrics` degradation (R‑ROBUST‑1)
- [ ] Decide & implement LLM egress policy (R‑SEC‑1)
- [ ] Confirm deployment topology; if multi‑worker, Redis cache + rely on DB constraints (R‑DEPLOY‑1)
- [ ] Stop side‑effect writes on GET or make them race‑safe (C4)
- [ ] Reuse cached metrics in `/simulate` and `act()` (R‑PERF‑2)
- [ ] Fix hygiene/concentration false‑positives before customer‑facing rollout (R‑TRUST‑1/2)
- [ ] Note per‑company authz as a platform follow‑up (R‑SEC‑2)
