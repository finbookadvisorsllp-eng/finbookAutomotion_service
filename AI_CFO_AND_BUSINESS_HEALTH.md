# AI CFO & Business Health — System Brief

**Product:** LiveTally (the "aman" side of the platform) · **Backend prefix:** `/api/v3` · **Frontend:** `livetally/`
**Status of this document:** written to serve two audiences at once —

- **For your boss / a business reader** → start at [1. The one-paragraph version](#1-the-one-paragraph-version) and [2. What it does, in plain English](#2-what-it-does-in-plain-english). Skip the tables.
- **For another AI or an engineer** → the whole thing is the brief. Sections [5](#5-ai-cfo--full-capability-map)–[8](#8-how-the-two-modules-relate) are the technical contract; [9](#9-current-status--maturity) is the honest state of things; [10](#10-known-limitations-be-honest) and [11](#11-where-you-other-ai-can-improve-it) are where new work should go.

Everything below is grounded in the actual code in `Backend/app/aman/ai_cfo/` and `Backend/app/aman/business_health/`. No aspiration is described as if it already ships — where something is planned or off-by-default, it says so.

---

## 1. The one-paragraph version

We took an accounting platform that already produces trustworthy financial **reports** (Profit & Loss, Balance Sheet, Trial Balance, Cash & Bank, Sales/Purchase registers, Outstanding, Inventory) and built an **intelligence layer** on top of it. That layer has two faces:

1. **AI CFO** — a chat assistant the owner can *talk to* about their own numbers ("why did profit fall?", "who owes me money?"). It answers in plain language, but **it is never allowed to invent a number** — every figure it quotes is pulled live from the same reconciled reports the UI shows.
2. **Business Health** — a *decision engine* that runs silently in the background, scores the business out of 100 across five pillars, spots risks and opportunities in rupees, and hands the owner a short ranked list of **"do this week"** actions — then tracks whether doing them actually moved the number.

The AI CFO is the **conversation**; Business Health is the **verdict and the to-do list**. Both sit on the same grounded data foundation, so they can never disagree with the reports or with each other.

---

## 2. What it does, in plain English

**AI CFO — "ask your books anything."**
The owner opens a chat. They type a question. The system quietly looks up the relevant, real figures from the company's live books, hands them to an AI model, and the model explains the answer like a seasoned CA/CFO would — concise, direct, with the actual rupee figures. If the AI model is down or unaffordable, it *still* answers with a grounded local summary instead of erroring. Alongside every chat it also surfaces deterministic (non-AI) recommendations, warnings, and alerts, plus a 0–100 financial health score and a simple forward forecast.

**Business Health — "what should I actually do?"**
Instead of making the owner read reports, this module reads them *for* the owner. Once a company has synced data, it computes a single health score, a one-line verdict ("You're Healthy overall — watch: receivables are high"), the **top 3 actions worth doing this week** (each with a rupee impact and a one-click "Mark done"), what changed since last week, and a set of vital signs. When the owner marks an action done, the system remembers the baseline and later tells them whether the metric actually improved. It even has a **what-if simulator**: drag "receivables down to ₹X" and watch the score move before you do anything.

---

## 3. The "future landscape" — why this exists

Traditional accounting software stops at **reporting**: it shows you the numbers and leaves interpretation to you (or your accountant). The direction we are building toward is a **finance co-pilot** that closes the loop:

| Stage | Traditional software | What we are building |
|---|---|---|
| **See** | Reports & dashboards | Same reports (kept as the source of truth) |
| **Understand** | You read and interpret | **AI CFO** explains in plain language, on demand |
| **Decide** | You figure out what matters | **Business Health** ranks risks/opportunities into a weekly to-do list |
| **Act** | Manual, untracked | One-click "act", with the action logged |
| **Learn** | — | **Outcome loop**: did the metric move after you acted? |

The strategic bet: for a small/medium business owner who is *not* a finance expert, the value is not more charts — it's **"tell me what's wrong, what it's worth, and what to do,"** grounded in numbers they can trust. That is the landscape both modules are aimed at.

---

## 4. The single most important design idea: **grounding (anti-hallucination)**

This is the concept to internalise before anything else, because every other design choice flows from it.

> **The AI model never does the accounting. It only explains numbers that were already computed and reconciled by the report engines.**

Concretely:

- A **Context Engine** (`ai_cfo/context_builder.py`) pulls every figure it will show the model from the *existing* report services (`dashboard_service`, `pl_service`, `outstanding_service`, `inventory_service`, `gst_service`). These are the same engines that render the UI, so the AI's numbers **reconcile to the rupee** with the reports.
- The context is injected into the prompt as an authoritative block, and the system prompt contains **absolute rules**: *only state figures present in the context; never invent or "remember" numbers; if data is missing, say so and name the report that would have it.*
- A **deterministic rules engine** (`ai_cfo/rules_engine.py`) computes all the actual recommendations/warnings/alerts with plain Python — **no LLM involved**. The LLM only *narrates* on top of this trustworthy backbone.
- If any single report fails to load, that one section degrades to `{"available": false, "reason": ...}` and is listed as a **DATA GAP** the model must be honest about — it never breaks the chat.

So the LLM is a **language layer, not a calculation layer.** This is what makes the feature safe to put in front of a business owner and their money.

---

## 5. AI CFO — full capability map

**Package:** `Backend/app/aman/ai_cfo/` · **Mounted at:** `/api/v3/ai-cfo` (subscription-gated, tenant-scoped)
**Frontend:** `livetally/src/pages/AICFO/*` + a floating launcher/widget (`components/AICFOLauncher.jsx`, `AICFOWidget.jsx`) and `context/AICFOContext.jsx`.

### 5.1 What it can do today

| Capability | How it works | Endpoint |
|---|---|---|
| **Conversational chat** | Grounded context + history + business memory → LLM → answer | `POST /ai-cfo/chat` |
| **Streaming chat** ("typing") | Same, but token-by-token over **SSE** | `POST /ai-cfo/chat/stream` |
| **Deterministic insights** | Rules engine over grounded context (no LLM) | `GET /ai-cfo/insights` |
| **Recommendations / warnings / alerts** | Insights split by kind & severity | `GET /ai-cfo/{recommendations,warnings,alerts}` |
| **Financial health score (0–100)** | 4-pillar deterministic composite | `GET /ai-cfo/health-score` |
| **Forecast** | Least-squares linear projection of sales / cash / collections | `GET /ai-cfo/forecast` |
| **Business memory** | Owner-stated goals/targets/preferences, replayed into prompts | `GET/POST/DELETE /ai-cfo/memory` |
| **Conversation history / sessions** | Per-user session list + message history | `GET /ai-cfo/history` |
| **Suggested questions** | Dynamic starters based on the company's data | `GET /ai-cfo/suggestions` |
| **Usage stats** | Volume, latency, tokens, degraded-rate per tenant | `GET /ai-cfo/stats` |
| **Delete conversation** | Removes a session + its messages | `DELETE /ai-cfo/conversation` |
| **Config/health probe** | Provider, model, configured?, graceful-degrade? | `GET /ai-cfo/health` |

### 5.2 How a single chat turn flows (`service.answer_chat` / `stream_chat`)

1. **Resolve/create the session**, persist the user's message.
2. **Pick only the context sections the question needs** — a keyword classifier (`_infer_sections`) maps "profit/margin", "receivable/overdue", "cash", etc. to a subset of the 8 sections, so a targeted question doesn't build everything. Greetings/small-talk are detected (`_is_smalltalk`) and **skip the heavy context build entirely** — a "Hi" doesn't ship 1.7k tokens of financials.
3. **Build the grounded context** (briefly cached per tenant+FY+section-set).
4. **Attach deterministic insights** from the rules engine (always reconciled).
5. **Assemble the prompt**: system persona + financial-reading rules + recommendation rules + business memory + live context + recent turns + the new question.
6. **Call the provider** with graceful degradation — on any provider error (and `GRACEFUL_DEGRADE=true`) it returns a grounded local summary instead of a 500.
7. **Persist the assistant answer** with audit metadata (provider, model, tokens, latency, degraded flag, context used) and **log a PII-light monitoring line**.

### 5.3 The AI CFO health score (0–100)

Deterministic, four sub-scores, weighted blend, letter grade A–E (`ai_cfo/health_score.py`):

| Sub-score | Weight | Driver |
|---|---|---|
| Profitability | 35% | Net margin |
| Liquidity | 30% | Cash/bank sign + net cash-flow direction |
| Collections | 20% | Receivables as a share of annual sales (lower = better) |
| Growth | 15% | Sales YoY (neutral when no prior-year data) |

*(Note: this is the AI-CFO-era score. Business Health later introduces a broader **5-pillar** score — see §6.3. They are separate scorers with overlapping intent.)*

---

## 6. Business Health — full capability map

**Package:** `Backend/app/aman/business_health/` · **Mounted at:** `/api/v3/business-health` · **Version:** `1.0.1-alpha`
**Frontend:** `livetally/src/pages/BusinessHealth/*` — `CommandCenter.jsx` (the cockpit), `HealthScore.jsx` (pillars + simulator), `Decisions.jsx` (the ledger), `OpportunitiesRisks.jsx`.

### 6.1 The philosophy: a **Decision Engine**, not another dashboard

The design was chosen deliberately (internally: "Approach ② Decision Engine"). A dashboard shows you data and hopes you act. A decision engine **does the interpretation, ranks it by rupee impact, and tracks the outcome.** The reading order of the Command Center encodes the priority: **verdict → this week's decisions → what changed → vital signs → briefing.**

### 6.2 One grounded metrics build feeds everything

`engines/kpi.build_metrics(db, fy)` assembles **one** normalized dict of reconciled figures by *consuming the same report services* (never re-computing accounting). Every other engine — pillars, risk, opportunity, simulate, briefing — reads that one dict, so all of Business Health shares a single source of truth. Only two figures are genuinely new derivations, and both are trivial: **cash runway** = cash ÷ avg monthly burn, and **customer concentration** = top customer's share of sales.

### 6.3 The five pillars (Health Score)

Deterministic, weight-normalized, letter-graded A–E; each pillar exposes its **drivers** and a **coverage %** (how much is fully reconciled vs a labelled proxy). Missing pillars drop out of the denominator — they never silently score zero. (`business_health/pillars.py`, weights in `config.py`.)

| Pillar | Weight | What it measures |
|---|---|---|
| **Profitability & Margin** | 25 | Net & gross margin, expense-to-revenue |
| **Liquidity & Cash** | 25 | Cash/bank sign, net cash-flow direction, runway |
| **Collections & Working Capital** | 20 | Receivables run-rate, receivables÷payables, concentration |
| **Growth & Revenue Quality** | 15 | Sales YoY, monthly trend slope |
| **Book Hygiene** | 15 | Cancelled-voucher rate, active-month coverage, GST capture consistency |

> **Important honest design choice:** the 5th pillar is **Book Hygiene**, *not* "Compliance filings." We cannot source real filing status from the Tally sync, so scoring compliance would be fabrication. Book Hygiene scores only what the data actually supports. (And GST is only judged for businesses that actually operate under GST — composition/exempt/unregistered dealers are not penalised.)

Grade bands: **A** ≥85 Excellent · **B** ≥70 Healthy · **C** ≥55 Fair · **D** ≥40 At risk · **E** Critical.

### 6.4 Risks, Opportunities, and the Priority queue

- **Risk engine** (`engines/risk.py`) — deterministic threats, each with **rupees-at-risk**, a confidence, a stable `sourceId`, and evidence provenance: negative cash, short runway, net loss / thin or compressing margin, customer concentration, high receivables, purchases outgrowing sales, high cancelled-voucher rate.
- **Opportunity engine** (`engines/opportunity.py`) — quantified upside phrased as *"do X → worth ~₹Y"*: collect concentrated overdue, stop margin leak on loss-making items (real ₹), renegotiate fast-growing purchases (directional, low confidence), resolve zero/negative stock (qualitative). Confidence carries the honesty — it never over-states impact.
- **Priority engine** (`engines/priority.py`) — merges both into one ranked queue with a reproducible score:
  `priorityScore = normalize(rupees) × confidenceWeight ÷ effortWeight × urgencyBoost`
  Opportunities and risks are normalized on **separate** scales so one huge loss can't crush every genuine opportunity, and the top list is guaranteed to include at least one *actionable opportunity* when any exist.

### 6.5 The Decision Ledger (the part that makes it a "loop")

Decisions are **company-scoped** and stored in the tenant DB (`aman_decisions`). Lifecycle (`service.py`):

- **Generation is idempotent** — upserts open decisions keyed on `sourceId`; creates new, refreshes still-open, leaves acted/snoozed untouched, and **revives a dismissed item only when its ₹ impact moves ≥ 25%** (materiality). Concurrency-safe via a `(fy, sourceId)` unique index.
- **Act** → stamps a **baseline** from the decision's metric, records who/when.
- **Outcome loop** → on later reads, an acted decision's metric is re-measured vs baseline and gets a verdict: **improved / worsened / no-change**.
- **Snooze** → hidden for N days, then auto-reopens (one atomic `update_many`).
- **Dismiss** → gone unless a material change revives it.

### 6.6 Memory without a scheduler: weekly snapshots

`snapshots.py` writes **one snapshot per ISO week per company**, lazily triggered by a Command Center or Score view (no cron needed in v1). That history powers **"what changed since last week,"** the **7-day trend arrow**, and trend milestones ("score at its highest in months"). Snapshots store the overall score, per-pillar scores, and a flat set of vitals for cheap diffing.

### 6.7 The What-If Simulator

`POST /business-health/simulate` re-scores an **overridden** metrics dict and returns the delta vs current. Override "receivables → ₹X" or "net margin → Y%", and dependent values (collections months, runway, working-capital ratio) are re-derived so the preview stays internally consistent. The score UI seeds its sliders from `simInputs`.

### 6.8 Business Health endpoints

| Endpoint | Purpose |
|---|---|
| `GET /business-health/health` | Config probe (pillars, weights-valid, briefing status) |
| `GET /business-health/overview` | The composed Command Center payload (score, verdict, top decisions, what-changed, vitals) |
| `GET /business-health/score` · `/pillars` · `/kpis` | Score object · pillar breakdown · vital signs |
| `GET /business-health/insights` · `/risks` · `/opportunities` | Unified insight stream · risks · opportunities |
| `POST /business-health/simulate` | What-if re-scoring |
| `GET /business-health/decisions` · `POST /decisions/generate` | List the ledger · (re)generate |
| `POST /decisions/{id}/act` · `/snooze` · `/dismiss` | Ledger lifecycle actions |
| `GET /business-health/briefing` | Weekly narrative (AI or deterministic — see §7.2) |
| `GET /business-health/trend` | Snapshot time-series |

---

## 7. Which AI is being used (the exact answer)

### 7.1 Provider, model, and how it's wired

- **The abstraction:** a small provider registry (`ai_cfo/providers/`) behind an `AIProvider` interface. Switching providers is an **env-only change** — no route/service edits.
- **Supported providers:** `openrouter` (default), `openai`, `gemini`. OpenRouter and OpenAI share the same `/chat/completions` wire format.
- **Currently configured (from `Backend/.env`):**
  - `AI_CFO_PROVIDER=openrouter`
  - **Model = `nvidia/nemotron-3-super-120b-a12b:free`** — a free NVIDIA Nemotron model served through the **OpenRouter** gateway.
  - OpenRouter API key is present; OpenAI/Gemini keys are not.
- **If switched to OpenAI**, the default model is `gpt-4o-mini`; **Gemini** default is `gemini-1.5-flash` (wired but optional/future).
- **Implementation detail worth knowing:** the provider is written with the **Python standard library only** (`urllib`) — no `openai` SDK dependency added to `requirements.txt`. It supports both blocking calls and **true token streaming (SSE)**.

### 7.2 Generation settings & safety

- **Temperature `0.2`** (deliberately low — factual, not creative), **max tokens `1200`**, **request timeout `180s`** (a hard ceiling, not an artificial delay — it streams the moment it's ready), **history = last 8 turns** replayed for context.
- **Graceful degradation is ON by default** — provider unreachable/unconfigured ⇒ a grounded local answer with `degraded: true`, never a hard failure.
- **The Business Health weekly AI briefing is OFF by default** (`BH_BRIEFING_AI_ENABLED=false`). That briefing is the *only* place company aggregates would be sent to a third-party LLM, so it's an explicit, informed opt-in. When off, `/briefing` returns a deterministic, local-only summary and **no company data leaves the server**. Even when on, only **aggregates** are sent — never party names.

**Summary for a reader:** *"It uses a free NVIDIA Nemotron 120B model via OpenRouter today, but the provider is pluggable (OpenAI or Gemini by changing one env var). The AI only writes the explanations — all the actual finance math is done by our own deterministic engines."*

---

## 8. How the two modules relate

```
                 ┌─────────────────────────────────────────┐
                 │        Report services (the truth)       │
                 │  P&L · Dashboard · Outstanding · GST ·   │
                 │      Inventory · Cash Flow · Sales       │
                 └───────────────┬─────────────────────────┘
                                 │  (consumed, never re-computed)
             ┌───────────────────┴───────────────────┐
             ▼                                        ▼
   ┌───────────────────┐                   ┌──────────────────────┐
   │      AI CFO       │                   │   Business Health    │
   │  context_builder  │                   │   engines/kpi build  │
   │        │          │                   │          │           │
   │  rules_engine ────┼── deterministic ──┼──► risk / opportunity│
   │        │          │                   │     priority / pillars│
   │   PROVIDER (LLM) ◄─┼── shared provider ┼──► briefing (opt-in) │
   │  chat / stream    │                   │  Decision Ledger +    │
   │  health-score     │                   │  weekly snapshots +   │
   │  forecast         │                   │  simulator            │
   └───────────────────┘                   └──────────────────────┘
```

**Shared foundations:** same report services, same tenant/company scoping, same FY convention (`YYYY-YYYY`), same in-process TTL cache, same provider abstraction (Business Health's briefing reuses the AI CFO provider), same graceful-degrade philosophy.

**The division of labour:** AI CFO = *pull* (owner asks, on demand, conversational). Business Health = *push* (system decides what matters, ranks it, tracks it). One explains; the other prescribes.

**Isolation:** both live on the aman **protected** router, gated by `require_aman_subscription` (an anjalee-issued token can never reach `/api/v3`); Business Health additionally enforces `require_company_access` so each company's decisions/snapshots are isolated by construction (they physically live in that company's `sf_tenant_<id>` database).

---

## 9. Current status & maturity

| Area | State |
|---|---|
| **AI CFO** | Implemented and committed (see commit `40a7c89 feat: implement AI CFO module…`). Chat, streaming, insights, health-score, forecast, memory, monitoring all present. |
| **Business Health** | **Code-complete and tested** — v1 Decision Engine + a pre-production remediation pass (version `1.0.1-alpha`). Backend package + frontend pages exist; a test file (`Backend/app/aman/tests/test_business_health.py`) covers it. **Not yet committed** (currently untracked on the `aman` branch). |
| **AI provider** | Live on a **free** NVIDIA Nemotron model via OpenRouter — good for demos, but subject to free-tier rate limits. Graceful degrade covers outages. |
| **Weekly AI briefing** | Wired but **OFF by default** for privacy; deterministic summary served instead. |
| **Snapshots/history** | Accrue lazily per ISO week — meaningful week-over-week deltas need at least a second week of views. |

---

## 10. Known limitations (be honest)

These are deliberately surfaced in-product rather than hidden, and any downstream AI improving the system should respect them:

- **Reorder levels are not in the sync**, so stock only flags **zero/negative** — no "below reorder point" alerts.
- **Bill-wise aging is not always available**; when absent, collections use a **run-rate proxy** (receivables ÷ avg monthly sales) and are labelled as such (confidence drops to "med").
- **Closing stock** can carry a reconciliation caveat for some tenants — the context passes the caveat through rather than papering over it.
- **The forecast is a transparent linear trend**, explicitly "directional, not exact," with confidence tied to how many months of data exist.
- **Month-gap detection is advisory only** — a seasonal lull must not be mistaken for missing bookkeeping, so it never deducts from the score.
- **The free LLM tier can rate-limit or 429** — the system stays up via graceful degrade, but response quality/latency varies with the chosen model.

---

## 11. Where you (other AI) can improve it

This section is for reason #2 — briefing another AI so it can build on the thinking. The architecture was designed for exactly these extension points:

- **Swap or add an LLM provider** → implement the `AIProvider` interface in `ai_cfo/providers/`, register it, set `AI_CFO_PROVIDER`. Nothing else changes. (E.g. move from the free Nemotron model to a stronger paid model, or add Anthropic Claude / Gemini as a first-class provider — the Nemotron/free tier is a cost choice, not an architectural one.)
- **Add a health pillar** → add a scorer in `pillars.py` and a weight in `config.PILLAR_WEIGHTS` (must still sum to 100 — there's a `weights_valid` guardrail).
- **Add a risk / opportunity** → one function in `engines/risk.py` or `engines/opportunity.py`, each returning a stable `sourceId` + rupee figure + evidence; it automatically flows into the priority queue and the Decision Ledger.
- **Tune thresholds** → all band cut-offs, priority weights, and materiality live in `business_health/config.py` (and rules thresholds in `ai_cfo/rules_engine.py`) — one place, auditable.
- **Strengthen grounding** → new context sections go in `ai_cfo/context_builder.py`, each wrapped in `_safe(...)` so a failing report degrades gracefully.

**Hard rules any improvement MUST keep** (these are the guardrails that make the product trustworthy):

1. **Never let the LLM compute accounting.** Numbers come from report services; the model only explains them.
2. **Never fabricate a figure.** Missing data → say so and name the report; do not estimate silently.
3. **Keep everything company-/tenant-scoped.** No cross-company leakage; no hardcoded company id or name.
4. **Deterministic engines stay the backbone.** The score, risks, opportunities, and decisions must be reproducible without any AI — the LLM is a narration layer, removable at any time.
5. **Respect the privacy default.** Company financials leave the server only via the explicitly opted-in briefing, and only as aggregates.

**Promising directions to suggest/prompt against:** a real scheduler for snapshots and briefings; richer aging when bill-wise dates are available; per-owner personalization via business memory; benchmarking a company against its own history more deeply; tightening the forecast with seasonality once enough history accrues; and (with a paid model) enabling the weekly AI briefing by default.

---

*Generated from the live codebase on the `aman` branch. Figures, endpoints, weights, and the configured model reflect the actual source in `Backend/app/aman/ai_cfo/` and `Backend/app/aman/business_health/` and `Backend/.env`.*
