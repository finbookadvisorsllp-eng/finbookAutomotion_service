# Business Health — Future Improvements

Enhancements beyond the go‑live fixes in `REVIEW_REPORT.md` / `PRODUCTION_RISKS.md`. Grouped by theme, each with rough effort (S/M/L) and the value it unlocks. Nothing here blocks v1.

---

## A. Correctness & modeling quality

- **A1 · Typed metrics contract (M).** Replace the ~40‑key untyped "god dict" from `build_metrics` with a `@dataclass`/pydantic model. Kills whole classes of `.get("typo")` bugs, documents the driver surface, and makes `/simulate` overrides self‑validating.
- **A2 · Operating‑cash runway (S).** Base burn on operating cash flow (exclude financing/investing) so a term loan or equity infusion doesn't mask real burn; keep an "all‑in cash" secondary view. (Ref R‑TRUST‑4.)
- **A3 · Non‑linear burn / runway confidence (M).** Fit burn on the trailing trend, not a flat average; flag *accelerating* burn (a funded startup can look 12 months safe while doubling spend monthly). Attach a confidence band.
- **A4 · Supplier concentration & purchase‑side risk (M).** We compute customer concentration but not vendor concentration, despite already having `top_vendors`. A single‑supplier dependency is a real continuity risk for traders/manufacturers.
- **A5 · Working capital locked in inventory (M).** Surface stock days / cash tied up in slow & dead stock as a first‑class collections/liquidity driver (data exists via `inventory_service`). Currently only zero/negative stock is flagged.
- **A6 · Seasonality awareness (L).** Detect a seasonal profile and (i) suppress the `monthGaps` hygiene penalty for off‑seasons, (ii) compare snapshots season‑over‑season rather than week‑over‑week, (iii) annualize run‑rates seasonally. (Ref M2, scenarios #7/#8.)
- **A7 · Scheme‑aware GST hygiene (S).** Detect composition/exempt/unregistered before penalizing missing output tax. (Ref M3.)
- **A8 · Bill‑wise everything, once the sync carries `billAllocations` (L).** Upgrade collections/DSO from run‑rate *proxy* to dated aging; recompute the Collections pillar at full confidence; drive dated cash forecasts. This flips several "med confidence" figures to "high."
- **A9 · Repeat‑customer / revenue‑quality driver (M).** The Growth pillar lists a placeholder for repeat‑customer share; wire it from `party_totals` to distinguish durable growth from one‑off spikes.

## B. Priority & decision intelligence

- **B1 · Dual‑scale priority + guaranteed opportunity (S).** Normalize risks and opportunities separately and always surface ≥1 actionable opportunity in the weekly top‑N so a large loss doesn't crowd out the ₹50k win. (Ref M1.)
- **B2 · Outcome‑loop learning (L).** Use the `outcome.verdict` history to tune per‑segment priority weights ("collections nudges work for this business; expense nudges don't"). The data model already records baselines and verdicts.
- **B3 · Decision drafting / workflow (L).** Let the LLM draft the concrete artifact (a reminder message, a vendor email) for the owner to approve — the bridge from "recommendation" to "action taken," and the on‑ramp to the WhatsApp channel (deferred milestone).
- **B4 · Scenario planner (M).** Extend `/simulate` from single‑driver sliders to named scenarios ("raise prices 5%", "lose top customer", "hire two staff") over the deterministic model.
- **B5 · Snooze/dismiss nuance (S).** Per‑decision snooze durations, "dismiss with reason" analytics, and reviving a dismissed item only on a *material* change (the `DISMISS_REVIVE_MATERIALITY` hook exists but is untested end‑to‑end).

## C. Performance & scale

- **C1 · Client‑side simulator mirror (M).** Ship the deterministic pillar math to the browser (it's simple and already reproducible) so slider drags are instant and hit `/simulate` only to confirm — removes the server round‑trip entirely. (Ref P1.)
- **C2 · Redis‑backed cache + single‑flight (M).** Swap the in‑process `TTLCache` for Redis (the `cached_report` seam is ready) and add request coalescing so concurrent misses on heavy builds / the briefing collapse to one computation. (Ref R‑DEPLOY‑1, R‑PERF‑1, R‑CAP‑1.)
- **C3 · Precompute on sync, not on request (L).** Move the weekly snapshot + decision generation to a per‑tenant background tick triggered by the Tally sync, so the landing endpoint is a pure read. Eliminates write‑on‑GET (C4) and the hot‑path rebuilds.
- **C4 · Streaming briefing (S).** Reuse the AI‑CFO SSE path so the briefing streams token‑by‑token instead of blocking a worker for up to 180 s. (Ref P4.)

## D. Security, privacy, governance

- **D1 · Per‑company authorization (M, platform‑wide).** Enforce `x-company-id ∈ token.companies`. Benefits every `/api/v3` route, not just BH. (Ref R‑SEC‑2.)
- **D2 · AI data‑governance controls (M).** Per‑tenant "AI enabled" flag, provider choice with a DPA/no‑train guarantee for financial data, payload minimization (strip party names), and an in‑UI egress disclosure. (Ref R‑SEC‑1.)
- **D3 · Decision audit trail (S).** Append‑only history of status transitions (who/when/why) rather than last‑write‑wins on the decision doc — important if decisions ever gate money movement.

## E. UX & product surface

- **E1 · Live nav badges (S).** Wire the score number and open‑decision count onto the sidebar items (deferred in v1 to avoid coupling the Sidebar to data fetching).
- **E2 · Trend visualization (S).** The `/trend` endpoint and snapshots exist but aren't yet charted — add a score/vitals sparkline to the Command Center and Health Score pages (dataviz presets already in the app).
- **E3 · Guided "unlock" onboarding (M).** Turn each honest data gap (no bill‑wise dates, no reorder levels, no GST calendar) into a guided task that raises coverage — converts weakness into an engagement loop.
- **E4 · Insight stream surfacing (S).** `/insights` (unified typed stream) is built but only partially surfaced; give it a dedicated rail with the provenance tags.
- **E5 · Export / lender report (L).** A reconciled, tamper‑evident Business Health PDF is a directly monetizable artifact (lenders, CAs) — reuse the existing export service.

## F. Testing & observability

- **F1 · Concurrency & idempotency tests (M).** Add tests that hammer `generate_decisions` / `maybe_write_weekly` concurrently once the unique constraints land (proving C1/C2 fixed).
- **F2 · Partial‑data & sector fixtures (M).** Turn `STRESS_SCENARIOS.md` into seeded fixtures / integration tests (seasonal, composition, cash‑only, pre‑revenue, loss‑making) so the false‑positive fixes stay fixed.
- **F3 · BH telemetry (S).** Extend the AI‑CFO `monitoring` pattern to record BH build latency, cache hit‑rate, briefing degrade‑rate, and decision act/dismiss ratios — the raw material for B2.
- **F4 · Reconciliation contract test (S).** Codify the live `natraj` reconciliation (BH figures == report endpoints) as a CI check against a seed tenant, so a future refactor can't silently drift a number.

---

### Suggested sequencing
1. **Fast‑follow after go‑live fixes:** A2, A7, B1, C1, E1 (small, high‑visibility, remove trust‑eroding rough edges).
2. **Next milestone:** A1, A4, A5, C2, D1/D2, F1/F2 (durability, security, scale).
3. **North‑star (per the original strategy):** A8, B2/B3, C3, E5 → the proactive, learning, channel‑delivered operating system.
