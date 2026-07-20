# CFO Reasoning Model — how the AI CFO should think, not just what it shows

**Status:** research brief + design spec for the CFO Desk rebuild. **Part 1 deliverable — read and approve before the engine/UI are built.**

**Audience:** a developer with no deep finance background (so every finance idea is defined in plain terms), who will later want to *tune* the numbers here without re-learning accounting.

**The one-line thesis of the rebuild:**
> A CFO doesn't report one comment per category on a fixed schedule. A CFO scans the whole business, decides what is *material* right now, and reports **only that** — worst thing first — and stays honestly quiet where there's nothing to say. We are moving from **4 always-on tabs** to **1 findings engine** that produces between zero and many findings, ranks them across categories, and lets the AI narrate the ranked list.

---

## Part A — What real CFOs actually do (research synthesis)

Everything below is summarized in my own words from the sources listed at the end, plus standard finance/audit practice.

### A1. How CFOs decide what matters — *materiality*

"Materiality" is the professional word for *"is this big enough or important enough to bother the decision-maker with?"* It has **two halves**, and you need both:

**1. Quantitative materiality (the size test).**
The classic auditor's rule of thumb is **~5% of net income**: below 5% is presumed immaterial, above ~10% is presumed material, and 5–10% is a judgment call. This is only ever a *starting point* — regulators (SEC's SAB 99) explicitly say a percentage ceiling **alone is not acceptable**.

> ⚠️ **Critical adaptation for us:** the "5% of net income" anchor **breaks for small businesses**, because net income is often near zero or negative (our live example company is at a **−7.65% margin / net loss**). Dividing by a near-zero number is exactly what produced the `+19771830%` bug. **So we anchor size to a stable base — annual revenue — not net income.** (More in Part C.)

**2. Qualitative materiality (the "small but important" test).**
A small rupee amount can still be material because of *what it signals*. SAB 99's whole point: don't dismiss something just because it's quantitatively tiny. Classic qualitative overrides:
- it turns a profit into a loss, or reverses a trend
- it signals a **control/integrity problem** (a missing recurring expense → the books can't be trusted)
- it concentrates risk (one customer = most of revenue)
- it threatens **solvency/liquidity** (running out of cash) — always material regardless of size

**Takeaway for the engine:** a finding is surfaced if it clears a **size floor** *(quantitative)* **OR** it trips a **qualitative override**. Never size alone.

### A2. Beyond materiality — the other three filters a CFO applies

A real CFO ranks a shortlist using four filters together, not just size:

| Filter | The question | Why it matters |
|---|---|---|
| **Materiality** | Is the ₹ amount (or signal) big enough to matter? | Filters out noise |
| **Urgency** | Does it get worse if ignored this week? | A slow leak ranks below an imminent cash crunch |
| **Actionability** | Can the owner actually *do* something now? | A CFO doesn't nag about what can't be changed |
| **Confidence** | How sure are we this is real vs. a data artifact? | Low-confidence items are flagged softly, not shouted |

This is **management by exception**: report deviations from normal/plan, not a full recital every time.

### A3. How CFOs sequence a briefing — *lead with the answer*

Two well-known frameworks, and they agree:

- **BLUF (Bottom Line Up Front)** — a US-military communication standard: **Bottom line → So what → The ask → Evidence.** State the single most important thing first, so the message lands even if the reader stops after one line.
- **Minto Pyramid Principle** (Barbara Minto, McKinsey) — executives want **recommendation → supporting evidence → context**, the *opposite* of how analysts naturally present (context → analysis → conclusion). Lead with the answer.

**One important nuance for *bad* news:** pure BLUF ("You're losing money.") reads as cold. Best practice is a **brief softening clause of context first, then the hard finding, then the cause, then the fix.** e.g. *"Sales are growing, but the business is running at a net loss — costs are climbing faster than revenue. Here's the fix."*

**Takeaway for the engine:** the brief is **ordered by priority (most material/urgent first)**, and each finding is phrased as *situation → finding → why → what to do*.

### A4. What CFOs stay *silent* about — "no material findings"

Professionals communicate "nothing notable" **all the time**, and it reads as competence, not laziness — because it's *specific*:
- An auditor issues a **clean ("unqualified") opinion** — a short, confident statement, not a blank page.
- Management commentary (MD&A) routinely says **"no material changes"** in a section rather than padding it.
- Exception-based status reporting **omits** everything on-plan and lists only deviations.

The trick is that silence is **stated with evidence of having looked**: *"No material planning issues this period — revenue and cash trends are stable,"* not an empty panel. That short line is the CFO's quiet confidence.

**Takeaway for the UI:** a category with nothing to report shows a calm **"checked — all clear"** line naming what was checked, never a blank/empty-state that looks broken.

### A5. How CFOs handle uncertainty — flag it, don't fake it

When data is incomplete, CFOs and auditors **disclose the limitation** rather than guess:
- auditors issue **"except for" (qualified) opinions** and disclose **estimation uncertainty**
- a **going-concern** doubt is flagged explicitly, not buried
- estimates carry a stated basis and range

This is *exactly* what our codebase already does well: the **Record Keeping** tab refuses to judge with < 4 months of history, and **Business Health** shows a **coverage badge** ("85% reconciled") and **confidence chips**. We treat those two as the **reference implementation** and apply the same discipline everywhere — especially to the two areas currently misbehaving (Planning % and Forecast).

---

## Part B — Translating that into our system: the Findings Engine

### B1. The shift

| Today (wrong) | After (right) |
|---|---|
| 4 tabs, each **always** emits a metric panel + an AI paragraph | 1 engine emits **0..N findings**; a check that finds nothing material emits **nothing** |
| Category **forces** content into existence | Category becomes a **tag** on a finding (for filtering/learning), not a container that must be filled |
| User clicks 4 tabs to learn if anything matters | User sees **one ranked brief** (top 3–5 across all categories); tabs are optional drill-down |
| Bad math is narrated as fact (`+19771830%`, `₹0.00` forecast) | Every number passes **materiality + data-sufficiency guards**; failing ones become an explicit "can't assess" state, never narrated |

### B2. The finding object (the contract Part 2 will implement)

Every check returns **either `None`** (nothing material) **or one finding**:

```
Finding {
  id:            stable string (so we can de-dupe / track "seen")
  category:      'planning' | 'risk' | 'record_keeping' | 'reporting'   # a TAG, not a box
  severity:      'critical' | 'warning' | 'positive' | 'info'
  title:         short headline
  detail:        the "why", in plain language (grounded)
  action:        the "what to do this week" (null for pure info/positive)
  rupeeImpact:   number | null                                          # signed magnitude for ranking
  confidence:    'high' | 'med' | 'low'
  dataStatus:    'ok' | 'insufficient'
  insufficientReason: string | null    # when insufficient: what's missing, in plain words
  metricKey:     string | null         # ties into the existing outcome-tracking loop
  evidence:      { report, params } | null   # the "verify it yourself" link
  priorityScore: number               # computed by the shared ranking logic
}
```

### B3. The pipeline (deterministic core; AI only narrates)

```
1. SCAN     run every check over the company's real, reconciled figures
2. FILTER   each check emits a Finding only if material OR a qualitative override trips;
            otherwise None  → this is where "silence" happens
3. GUARD    every number passes data-sufficiency + %-base + forecast guards;
            a failing number ⇒ dataStatus:'insufficient' (never a raw computed value)
4. RANK     order ALL findings together (reuse business_health priority engine)
5. NARRATE  hand the ranked, validated list to the AI to sequence & explain (BLUF).
            The AI MUST skip or explicitly flag any dataStatus:'insufficient' finding —
            never narrate around a gap. If AI is down ⇒ deterministic text (graceful degrade).
```

Rule that never changes: **the engine does 100% of the numbers and the materiality judgment; the AI only writes prose over the finished list.**

---

## Part C — The concrete thresholds (tune these here later)

All of these are proposed defaults with rationale. They will live in **one config block** so you can adjust them without touching logic. Where a good pattern already exists in the repo, I name it for reuse.

### C1. Materiality — anchored to **revenue**, not net income

```
ABS_FLOOR            = ₹25,000     # ignore anything smaller unless a qualitative override trips
MATERIAL_PCT         = 0.5%        # of annual revenue → "worth mentioning"
CRITICAL_PCT         = 2.0%        # of annual revenue → "urgent"
```
A finding is **material** if `rupeeImpact ≥ max(ABS_FLOOR, MATERIAL_PCT × annualRevenue)`.
It is **critical** if `rupeeImpact ≥ CRITICAL_PCT × annualRevenue` **or** a solvency override trips.

*Why revenue, not the textbook 5%-of-net-income?* Because net income for an SME is often ≈0 or negative, which makes the ratio explode or flip sign. Revenue is always positive and stable. (This is the same root cause as the % bug.) Documented deviation from the 5%-net-income rule of thumb, on purpose.

### C2. Qualitative overrides — **always** surface, regardless of size

- cash/bank negative (overdrawn) → **critical**
- net loss / margin < 0 → **critical**
- a **recurring** expense missing this month → **warning** (book-integrity signal)
- customer concentration ≥ 40% of sales → **warning** (≥ 60% → critical)
- a metric **reversed sign** vs last period (profit→loss, positive→negative cash flow)

### C3. The MoM %-base guard  *(fixes the `+19771830%` bug)*

```
PCT_BASE_FLOOR = max(₹10,000, 1% of avg monthly revenue)
```
- If `|previous| < PCT_BASE_FLOOR` → **do not compute or show a %.** Show the **absolute** change (`+₹X`) and label it *"new / near-zero last month."*
- Hard cap: if a % ever exceeds **±999%**, treat as base-too-small → suppress the %.
*Rationale:* a jump from ~₹0 to ₹X is "a new line item appeared," not "19 million percent growth." A % is only meaningful against a non-trivial base.

### C4. The forecast guards  *(fixes the "positive next month but ₹0.00 at 6/12 months" bug)*

Root cause: the linear projection clamps negatives to ₹0, so a **declining** trend shows a real ₹ next month and then hard **₹0.00** further out — a self-contradiction.

```
MIN_FORECAST_MONTHS   = 3     # below this: no forecast at all (dataStatus insufficient)
CONF_MODERATE_MONTHS  = 6     # ≥6 months history ⇒ 'med'; 3–5 ⇒ 'low'; <3 ⇒ none
MAX_HORIZON_FACTOR    = 2     # only show a horizon month H if H ≤ 2 × months_of_history
```
Rules:
1. **Don't show a horizon you can't support.** With 4 months of data, show 3-month; **omit** 6- and 12-month rather than print a fabricated number. (No projecting a year from a quarter.)
2. **A clamped-to-zero value is not a prediction.** If the trend is declining and the projection floors at ₹0, render **"declining trend — projection unreliable beyond ~N months"** with `dataStatus:'insufficient'`, **never `₹0.00` next to a positive next-month.**
3. **Confidence degrades with distance** — a 12-month figure can never be labeled the same confidence as next month. Each horizon step drops confidence at least one level.
4. Keep **next-month as the headline** (highest confidence); horizons are clearly "directional."

### C5. Data-sufficiency minimums (reuse Record Keeping's discipline everywhere)

| Check | Needs | Else |
|---|---|---|
| Month-over-month % | ≥ 2 active months **and** base ≥ `PCT_BASE_FLOOR` | show absolute / suppress % |
| Forecast | ≥ `MIN_FORECAST_MONTHS` | `insufficient` — "need more history" |
| Expense anomaly | ≥ 4 booked months (already correct) | "not enough booked months" |
| YoY growth | a prior FY exists | fall back to within-year trend, `confidence:'low'` |
| Any margin/ratio | denominator ≥ its base floor | `insufficient`, never divide by ~0 |

### C6. Confidence model

- **high** — fully reconciled (bill-wise aging present, prior-year present, ≥6 months)
- **med** — a labelled proxy in play (run-rate collections when bill dates absent) or 3–5 months
- **low** — < 3 months, no prior year, or a far-out forecast step

### C7. Ranking — **reuse, don't reinvent**

Use the existing `business_health/engines/priority.py`:
```
priorityScore = normalize(rupeeImpact) × confidenceWeight ÷ effortWeight × urgencyBoost
```
with **separate normalization scales for negatives (risks) and positives (opportunities)** so one giant loss can't crush every smaller-but-real finding — this is already implemented and tested there. The brief orders by: **critical first → then priorityScore → then confidence.**

---

## Part D — The two bugs: before → after

### Bug 1 — Exploding percentage (`+19771830%`)
- **Before:** last month's value was ≈ ₹0; `(current − previous) / previous × 100` explodes. The UI printed `+19771830%` as if it were a real growth rate.
- **After (C3):** the %-base guard sees `previous < PCT_BASE_FLOOR`, suppresses the percentage, and shows **`+₹X · new / near-zero last month`** instead. The finding's `confidence` drops to `low`. No meaningless percentage is ever narrated.

### Bug 2 — Contradictory forecast (positive next month, `₹0.00` at 6 & 12 months)
- **Before:** the linear trend was declining; the projector clamped negatives to ₹0, so the horizon cards showed a real ₹ next month and `₹0.00` further out — a visible contradiction.
- **After (C4):** (a) horizons beyond `2 × history` are **omitted**, not zero-filled; (b) a clamped-to-zero declining trend renders **"declining trend — projection unreliable beyond ~N months"** as an explicit `insufficient` state; (c) confidence **degrades** with each step; (d) next-month stays the headline. The user sees an honest "we can't reliably see that far," never a fake ₹0.

---

## Part E — What we reuse (so this is a refactor, not a rewrite)

| Existing, already-correct pattern | Where | Reused for |
|---|---|---|
| Rupee-impact ranking (separate risk/opp scales) | `business_health/engines/priority.py` | Step 4 (RANK) |
| Grounded checks (risk/anomaly/rules) | `business_health` risk/opportunity, `ai_cfo` rules_engine + anomaly | Step 1 (SCAN) — wrapped to emit `Finding`s |
| Data-sufficiency / `insufficient` state | `ai_cfo/anomaly.py` | The guard discipline (Step 3) everywhere |
| Coverage badge + confidence chips | `business_health` Pieces / ui | Honest uncertainty in the UI |
| "I did this / snooze / dismiss" + outcome loop | `business_health` Decision Ledger | "Seen / will handle / not relevant" + "you fixed this" |
| "Evidence" report links | `business_health` ui `evidenceRoute` | "verify it yourself" per finding |
| "GROUNDED" label + colour-coded severity borders | AI CFO Desk + Business Health | Brief + finding cards |
| Graceful AI degrade | `ai_cfo/service` + providers | Step 5 (NARRATE) fallback |

---

## Part F — UI direction this implies (full detail in Part 3, after you approve this)

- **Open with one prioritized brief** — top 3–5 findings across all categories, worst first (BLUF), each with *why + what-to-do + ask-the-CFO + evidence*.
- **Category tabs become optional drill-down** — and when a category is clean, a calm **"checked — all clear"** line, never a blank panel.
- **Findings are actionable inline** — expand a finding into a mini Q&A; mark seen/handled/dismissed (reusing the ledger), so the desk doesn't repeat itself and can later say "you fixed this."
- **Staged reveal** — findings delivered worst-first, not dumped at once.

---

## Sources

- [BLUF (communication) — Wikipedia](https://en.wikipedia.org/wiki/BLUF_(communication))
- [BLUF: how these 4 letters simplify communication — The Persimmon Group](https://thepersimmongroup.com/bluf-how-these-4-letters-simplify-communication/)
- [Great communication: call your BLUF — Board Intelligence](https://www.boardintelligence.com/blog/great-communication-call-your-bluf)
- [Minding the Gaps: How to Calculate Materiality Thresholds — Numeric](https://www.numeric.io/blog/materiality-threshold)
- [Materiality Threshold in Audits: Decoding the 5% Rule — Lythouse](https://www.lythouse.com/blog/materiality-threshold-in-audits)
- [The New Importance of Materiality — Journal of Accountancy](https://www.journalofaccountancy.com/issues/2005/may/thenewimportanceofmateriality/)
- [Financial Thresholds — Materiality Tracker](https://www.materialitytracker.net/standards/financial-thresholds/)

*Terminology (materiality %, SAB 99, BLUF, Minto Pyramid) is summarized in my own words from the above; the specific ₹ thresholds and the revenue-anchored adaptation are choices made for this product and are documented here so they can be tuned.*
