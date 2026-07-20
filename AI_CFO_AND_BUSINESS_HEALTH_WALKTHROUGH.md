# AI CFO & Business Health — Screen-by-Screen Walkthrough

**Who this is for:** anyone who needs to *understand and explain* these two modules — a new developer, a teammate, a manager, or a customer demo. No finance degree needed.

**How to use it:** read Part 1 (5 minutes) to get the idea. Then use Parts 3 and 4 as a map — every tab, every card, explained in plain language, exactly as it appears on screen.

> **Companion doc:** `AI_CFO_AND_BUSINESS_HEALTH.md` is the *technical* brief (architecture, providers, contracts). **This** doc is the *product* walkthrough (what the user sees and what it means).

---

## Part 1 — The idea in five minutes

### The problem we're solving
Normal accounting software shows you **reports**. It tells you *what happened* and then leaves you alone. A business owner who isn't a finance expert stares at a Profit & Loss statement and thinks: *"OK… so now what?"*

A real CFO doesn't wait to be asked. A real CFO **watches the business every day, finds problems early, predicts what's coming, and tells the owner what to do next.**

That's what these two modules do. They sit **on top of** the reports we already have and turn numbers into decisions.

### The two modules, in one line each

| Module | One-line job | The vibe |
|---|---|---|
| **Business Health** | *"Here's what's wrong, what it's worth, and what to do about it."* | The **verdict + to-do list**. It talks to you. |
| **AI CFO** | *"Ask me anything — and here's what I'm watching."* | The **conversation + the analyst's desk**. You talk to it. |

Think of it like a doctor:
- **Business Health** = the **health check-up report card** — a score out of 100, what's weak, and the prescription.
- **AI CFO** = the **doctor sitting in front of you** — you can ask questions, and they explain what they're monitoring.

They never disagree with each other, because they both read from the **same reports**.

### The one rule that makes it all trustworthy 🛡️
> **The AI never does the maths. It only explains numbers our own engines already calculated.**

Every rupee you see in either module is pulled live from the **same report services** that power the P&L, Balance Sheet, Cash Flow and Outstanding pages. So the AI CFO's numbers **match the report pages to the rupee**.

If a number isn't available, the system **says so** — it never guesses. This is the single most important thing to tell anyone about this product.

---

## Part 2 — Where to find them

Both live in the sidebar under one group called **Business Health**:

| Sidebar item | URL | What opens |
|---|---|---|
| **Business Health** 🆕 | `/health` | A hub with **5 tabs** |
| **AI CFO** 🤖 | `/ai-cfo` | A page with **2 modes** (and the Desk mode has **4 tabs**) |

Everything is **per-company** and **per-financial-year**. Change the company or the FY at the top, and everything below re-calculates for that company. Nothing is hardcoded.

---

## Part 3 — Business Health (5 tabs)

**The hub header** says: *"Your business at a glance — what's wrong, what it's worth, what to do."* That's literally the job.

The 5 tabs, in the order they're meant to be read:

| # | Tab | The question it answers |
|---|---|---|
| 1 | **Overview** | "How am I doing, and what should I do this week?" |
| 2 | **Health Score** | "Why is my score that number — and what if I change something?" |
| 3 | **Decisions** | "What's on my to-do list, and did the things I did actually work?" |
| 4 | **Opportunities & Risks** | "Show me everything you found, ranked by money." |
| 5 | **Impact** | "How much better is my business since I joined?" |

---

### Tab 1 · Overview — the cockpit

This is the landing page. Reading order is deliberate: **verdict → actions → explanation → changes.**

**Card: "How to read this"**
A small helper box for first-timers explaining how to use the page.

**Card: The Verdict Hero** (the big one at the top)
- **Score ring** — your health score, **0 to 100**, with a letter grade **A–E**.
- **Trend arrow** — how the score moved **vs last week** (e.g. `+3`).
- **The verdict sentence** — one plain line, e.g. *"Healthy overall — watch: receivables are high."*
- **"Why this score:"** — one sentence explaining *which pillars are dragging it down and which are holding it up*. This is built only from the pillar scores; no new numbers invented.
- **Two buttons** — `View pillars` (→ Tab 2) and `See your impact` (→ Tab 5).

**Section: "Do this week — your top actions"**
The **top 3 decisions**, ranked by rupee impact. Each card shows:
- Title (e.g. *"Collect the ₹15L overdue from your top customer"*)
- **₹ amount** — `at risk ₹X` for a risk, `~₹Y` for an opportunity
- Chips: **Risk / Opportunity**, **confidence** (high/med/low), **effort** (low/med/high)
- A **"why"** line and a **"→ what to do"** line
- **Evidence** link — jumps to the actual report the number came from
- Buttons: **"I did this"** ✅ / **snooze** 🕐 / **dismiss** ✕

**Card: "AI insight"** *(marked `AI · grounded`)*
The weekly narrative briefing. Written by the AI model **if enabled** — otherwise a locally-written summary. Either way the numbers are ours. If the model was unavailable it says *"Grounded summary — AI model unavailable."*

**Card: "Recommendations"** *(labelled "What you need to do")*
These are **structural** fixes tied to your **weak pillars** (worst first) — e.g. *"Speed up collections and pause non-essential spend to rebuild a cash buffer."*

> 🔑 **Important distinction people always ask about:**
> - **"Do this week"** = *tactical* — chase this specific ₹74L.
> - **"Recommendations"** = *structural* — the habits that lift the score itself.

**Card: "What we noticed"**
A stream of everything flagged this week (risks, opportunities, positives, milestones) — up to 5.

**Section: "What changed since last week"**
A simple before → after list of your vital numbers, with a **green/red %**. Green = moved in the good direction (note: receivables going **down** is green, because down is good).
> On your very first week this says *"This is your first tracked week — deltas appear next week."* That's normal, not a bug.

---

### Tab 2 · Health Score — the report card

**Card: Overall health**
- The **score ring** + grade + label (Excellent / Healthy / Fair / At risk / Critical)
- **Coverage badge** — e.g. *"85% reconciled"*. This is our honesty meter: how much of the score is backed by fully verified data vs a clearly-labelled estimate.
- **A red→green band bar** with a marker showing where you sit: Critical → At risk → Fair → Healthy → Excellent
- **"Why this score:"** — the plain-language explanation again.

**Card: Score Simulator — "try a what if"** 🎚️ *(interactive)*
Three sliders for the **real levers an owner controls**:
1. **Cash & bank** — top up or draw down cash
2. **Receivables to collect** — *drag down = you collected it*
3. **Net margin** — profit left per ₹100 of sales

As you drag, it shows **current → projected** score and **"+N vs now"**, plus **"Pillars that move"** (e.g. *Liquidity 40 → 62 (+22)*).
> **Nothing in your books changes.** It's a preview. And the preview uses the *same* backend scoring engine, so it can never lie about what would happen.

**Section: "The five pillars — what makes up your score"**
Five cards. Each shows the pillar's **weight**, its **score**, a bar, its **drivers** (the actual numbers), and a **coverage badge**.

| Pillar | Weight | What it asks |
|---|---|---|
| **Profitability & Margin** | 25 | Are you actually making money after all costs? |
| **Liquidity & Cash** | 25 | Do you have enough cash to run day to day? |
| **Collections & Working Capital** | 20 | How fast does customers' money come back? |
| **Growth & Revenue Quality** | 15 | Are sales growing or shrinking? |
| **Book Hygiene** | 15 | Are the books clean, complete and trustworthy? |

**Grades:** A ≥ 85 Excellent · B ≥ 70 Healthy · C ≥ 55 Fair · D ≥ 40 At risk · E below 40 Critical.

> **Why "Book Hygiene" and not "Compliance"?** Because we **cannot** see real GST filing status from the Tally sync. Scoring compliance would be making things up. So we only score what the data actually supports. This is a deliberate honesty decision — worth mentioning, it earns trust.
>
> **Missing pillars don't score zero** — they drop out of the calculation entirely, so a data gap never unfairly punishes the score.

---

### Tab 3 · Decisions — the to-do list that remembers

This is the **Decision Ledger**, and it's the part that makes this a *loop* instead of a dashboard.

**Four sub-tabs:** `Open` · `Acted` · `Snoozed` · `Dismissed`, plus a **Refresh** button that regenerates the list from the latest books.

**The lifecycle of one decision** (this is the magic — explain this part slowly):

1. **Open** — the system found something worth doing and priced it in rupees.
2. You click **"I did this"** → it becomes **Acted**, and the system quietly **saves a baseline** of the relevant number (e.g. receivables were ₹1.2 Cr on that day).
3. Later, it **re-measures** that same number and gives a verdict:
   - ✅ **Improved** — it actually moved the right way
   - ⚠️ **No change yet**
   - ❌ **Worsened**
4. **Snooze** → hides it for 7 days, then it **comes back automatically**.
5. **Dismiss** → gone, **unless** its rupee impact changes by **25%+** — then it's important again and returns.

> **Why this matters:** the system doesn't just give advice — it **checks whether the advice worked**. That's what a real CFO does.
>
> The list **regenerates without creating duplicates** (each finding has a stable ID), and things you already acted on are never overwritten.

---

### Tab 4 · Opportunities & Risks — the full list

Two columns side by side, everything ranked by **rupee impact**:

**Opportunities (left)** — money to *gain*. Each card: 💡 title, `~₹Y` upside, a **why** line, a **→ what to do** line, confidence + effort chips, and an **Evidence** link.
Examples: collect concentrated overdue, stop margin leak on loss-making items, renegotiate fast-growing purchases.

**Risks (right)** — money to *protect*. Each card: ⚠️ title, `at risk ₹X`, why, severity chip, Evidence link.
Examples: negative cash, short runway, net loss, thin/compressing margin, customer concentration, high receivables, purchases outgrowing sales, high cancelled-voucher rate.

> This tab is **read-only** — it's the full menu. The **top 3** from here become your **"Do this week"** decisions on the Overview tab.
>
> **Confidence carries the honesty.** If we can't be exact (e.g. bill-wise due dates missing), we lower the confidence rather than fake precision.

---

### Tab 5 · Impact — "how much better am I since I joined?"

This is the **retention and sales** page — the one an owner screenshots and a salesperson demos.

**Hero card**
- Score ring (today) + **`58 → 84`** with **`+26 pts`**
- Headline: *"You're **45% healthier** than day one."*
  - If tracking just started, it says *"Your baseline is set."* instead
- **The big ₹ number** — *"freed & protected by acting on your CFO's decisions"*

**Section: "Where you started vs. where you are"**
Before → after tiles for each vital: current value big, **"was X"** underneath, and a coloured **%** badge. Colour follows *meaning*, not the sign (receivables **down** = green).

**Section: "How your CFO earned its keep"**
The ledger of value actually created. Each row: the decision, an **Improved** ✅ chip, and **+₹ realised**. Footer: *"Realised impact from N acted decisions → +₹X"*.

**Card: Methodology** 🛡️ — *"How this is measured — no invented numbers."*

> ### ⚠️ The two things people always misunderstand about this tab
>
> **1. "Why is everything 0% / the same?"**
> Because **the baseline is the first snapshot we captured**, and if that was *this week*, then "day one" **is** today. It's a weight-loss app on day 1 — before and after are identical. Real deltas appear as weeks pass. **This is correct behaviour, not a bug.**
>
> **2. "Why is the ₹ ledger empty?"**
> Because **realised impact only counts decisions you marked done AND whose number actually moved the right way afterwards.** A decision that didn't move the number earns **₹0**. That's deliberate — it keeps the number honest and un-gameable.

---

## Part 4 — AI CFO (2 modes)

**The header** always shows: the title, a **mode toggle**, and a **provider chip** (e.g. `openrouter · nemotron-3-super-120b-a12b:free`) with a green dot — or an amber *"AI model not configured"* if no key is set.

| Mode | What it is |
|---|---|
| **CFO Desk** *(default)* | The analyst's desk — **4 tabs**, one for each job a real CFO does. No typing needed. |
| **Chat** | Ask anything in your own words. |

> **Why Desk is the default:** the boss's whole point — *a real CFO doesn't wait for questions*. The Desk is the CFO **already working** the moment you open the page.

---

### Mode 1 · CFO Desk — the four jobs of a CFO

These four tabs are the four textbook responsibilities of a CFO. **Every tab has exactly the same three zones**, so once you understand one, you understand all four:

```
┌────────────────────┬──────────────────────────────────┐
│ WHAT A CFO         │  WHAT YOUR CFO SEES              │
│ DOES HERE          │  (your company's real numbers)   │
│ (the teaching bit) │                                  │
└────────────────────┴──────────────────────────────────┘
┌───────────────────────────────────────────────────────┐
│  Chief Officer Suggestions  → the verdict + what to do │
└───────────────────────────────────────────────────────┘
```

**Zone 1 — "What a CFO does here"** *(left, grey)*
Pure teaching, same for every company: the job title, a one-line definition, 3 bullet points, and the **question in italics** that this job answers.
> ❗ **Common confusion:** that italic question is **just a label**. It does **not** drive the analysis. The analysis comes from real data.

**Zone 2 — "What your CFO sees"** *(right)*
Your company's actual, live numbers. Different for each tab (below).

**Zone 3 — "Chief Officer Suggestions"** *(bottom, marked `GROUNDED`)*
The verdict in one paragraph + **recommendation chips** + an **"Ask the CFO about this →"** button that jumps into Chat with the question pre-filled.
The left border is **colour-coded**: 🟢 good · 🟡 warning · 🔴 danger · 🔵 info.

> **This text is written by our own rules — not the AI model.** That means it's instant, always available, and can never hallucinate. The AI model is one click away (that button) when you want a deeper conversation.

---

#### Tab 1 · Financial Planning 🧭
*"Where will this business be in 3, 6 and 12 months?"*

| Card | Meaning |
|---|---|
| **Revenue (FY)** | Total sales for the year |
| **Net margin** | Profit left per ₹100 of sales. **Turns red + says "net loss"** if negative |
| **Revenue vs last month** | Month-on-month sales movement |
| **Forecast · next month revenue** | Where next month lands, + a **confidence** label |
| **Receivables clear in** | How many months to collect what's owed, at the current run-rate |
| **"Where you're headed"** | Projected revenue **in 3 / 6 / 12 months**, each with projected profit (red if a loss) |

**How the forecast works:** a **straight-line (least-squares) trend** fitted to your real monthly numbers, projected forward. That's why it's badged **`DIRECTIONAL`** — it's an *indication*, not a promise, and the further out you look the less certain it is.

> **These forecast cards are a PREDICTION, not a solution.** They answer *"what happens if nothing changes?"* The **solutions** are the chips in Chief Officer Suggestions.
> Also note: each figure is **that month's** number (a monthly run-rate), not a running total.

**The verdict logic, in priority order:**
1. **Running at a loss?** → say that **first** (a real CFO names the loss before anything else), then the cause.
2. **Costs growing faster than revenue?** → warn that profit is being squeezed.
3. **Margin under 5%?** → warn it's thin.
4. Otherwise → healthy balance.

---

#### Tab 2 · Risk Management 🛡️
*"What could hurt this business next — and how big is it?"*

**What you see:** a list of every active risk, each with a title, a plain-language explanation, and a **red (danger) or amber (warning)** left border.

Typical risks: negative cash, negative cash flow, net loss, thin margin, sales decline, purchases spiking, receivables too high vs sales, and **customer concentration** (too much revenue riding on one buyer).

**Suggestions** are derived from the *categories* of risk found — e.g. *"Diversify the customer base to cut concentration"*, *"Protect cash — chase collections and delay non-essential spend"*.

If nothing is wrong, it says so plainly and turns green.

---

#### Tab 3 · Record Keeping 📖
*"Can I trust this month's numbers before I act on them?"*

This is the **newest** capability and the easiest to demo. A CFO doesn't type entries — a CFO makes sure the entries can be **trusted**.

It scans **every expense ledger**, month by month, and flags three things:

| Flag | Meaning | Real example |
|---|---|---|
| **MISSING** | A regular monthly expense wasn't booked this month | *"Electricity — no entry this month. Usually ~₹2,100."* |
| **DROP** | An expense is way below its own normal | *"Rent is ₹500 vs a ₹5,000 average — a 90% drop. Possible entry error."* |
| **SPIKE** | An expense jumped way above its normal | *"…confirm it isn't a duplicate entry or mis-posting."* |

**Deliberately conservative** so it never cries wolf:
- The ledger must be genuinely **recurring** (present in ≥3 prior months and ≥60% of them)
- It must average **≥ ₹1,000** (ignore trivial noise)
- Drop threshold **>60%** below its own average; spike **>150%** above
- Needs **≥4 booked months** of history — otherwise the tab honestly says *"Not enough booked months yet."*

If the books are clean it shows a green ✅ *"Books look clean — no missing or mis-keyed expense entries in [month]."*

---

#### Tab 4 · Financial Reporting 📊
*"In one glance — how did the business actually do?"*

| Card | Meaning |
|---|---|
| **Revenue** | with its month-on-month % |
| **Expenses** | with its month-on-month % |
| **Net profit** | with its month-on-month % |
| **Bar chart** | Last 6 months, **blue = revenue** vs **red = expense**, side by side |

**The verdict reads like a human wrote it:**
> *"A strong month — profit rose +35% because revenue grew +15% while expenses rose only +5%. Growth on controlled costs."*

…or, if it went the other way:
> *"Profit slipped −12% this month — expenses grew +20% against only +4% more revenue. Costs are eating the gains."*

---

### Mode 2 · Chat — ask anything

Three columns:

**Left — History:** your past conversations. Start a new one, reopen an old one, delete one. The conversation **survives navigation** — go to another page and come back, it's still there.

**Middle — The chat:** type a question in plain English. The answer **streams in word by word** like ChatGPT. Below the box: *"Figures reconcile with your reports — the AI never computes accounting itself."* On an empty chat you get **suggested questions** built from your own data.

**Right — Live insights:** your health score ring plus clickable insight cards — **click one and it asks the CFO about it automatically.**

**What happens behind one question:**
1. It figures out which parts of your books the question needs (asking *"Hi"* doesn't load your whole P&L — that keeps it fast).
2. It pulls those **real figures** from the reports.
3. It hands them to the AI model with strict rules: *only use these numbers, never invent one, and if data is missing, say so.*
4. If the model is down or rate-limited → you still get a **grounded local answer** marked *degraded*. **It never shows an error page.**

---

## Part 5 — Where the numbers come from (the formulas people ask about)

| Number | Formula | Source |
|---|---|---|
| **Net margin** | Net Profit ÷ Revenue × 100 | The P&L report engine |
| **Net Profit** | Gross Profit + Indirect Income − Indirect Expenses | The P&L report engine |
| **Gross Profit** | Revenue − COGS *(COGS = Opening Stock + Purchases + Direct Expenses − Closing Stock)* | The P&L report engine |
| **Cash runway** | Cash & bank ÷ average monthly burn | Cash flow |
| **Collections horizon** | Receivables ÷ average monthly sales | Outstanding + Sales |
| **Customer concentration** | Top customer's sales ÷ total sales | Sales register |
| **Health score** | Weighted blend of the 5 pillars (available ones only) | All of the above |
| **Realised impact** | Σ ₹ of acted decisions whose metric actually improved | Decision ledger |

**The golden rule underneath everything:** Debit/Credit comes from the **sign of the ledger entry amount**, never from Tally's `isDeemedPositive` flag (which is wrong on ~6% of lines). Vouchers are classified by `voucherTypeOrigName` (the Tally reserved name), never by the company's custom voucher name. This is why our numbers match Tally.

---

## Part 6 — Honest limitations (say these out loud — they build trust)

| Limitation | What it means |
|---|---|
| **Bill-wise aging isn't always in the sync** | Collections fall back to a **run-rate estimate**, clearly labelled, confidence drops to "med" |
| **Reorder levels aren't in the sync** | We only flag **zero/negative** stock, never "below reorder point" |
| **The forecast is a straight line** | Explicitly **directional**, not exact. Confidence is tied to how many months exist |
| **Anomaly detection needs ≥4 booked months** | Until then, the Record Keeping tab says so honestly |
| **Impact baseline = first snapshot, not literally onboarding day** | The copy says *"since we started tracking"* — we never fabricate a day-1 we didn't measure |
| **Snapshots accrue weekly, lazily** | No scheduler yet — history builds as people open the pages. Week-over-week deltas need a second week |
| **Idle months don't hurt your score** | A seasonal lull must not be mistaken for bad bookkeeping, so it's advisory only |
| **The free AI model can rate-limit** | The system stays up via graceful degrade; only the prose quality/latency varies |
| **The weekly AI briefing is OFF by default** | It's the only place company aggregates would leave our server, so it's an explicit opt-in. Even then: aggregates only, never customer names |

---

## Part 7 — Cheat sheet (if someone asks…)

**"So what is this, in one sentence?"**
> It's a digital CFO. It reads your books every day, scores your business out of 100, tells you the top 3 things to do this week in rupees, and then checks whether doing them actually worked.

**"Does the AI make up numbers?"**
> No. The AI never calculates anything. Our own engines compute every figure from the same reports that power the dashboards; the AI only writes the explanation. Turn the AI off entirely and every score, risk and number still works.

**"What's the difference between the two modules?"**
> **Business Health pushes** — it decides what matters and hands you a to-do list. **AI CFO pulls** — you ask, it answers. One prescribes, the other explains.

**"Why is my Impact page empty / all zeros?"**
> Because tracking just started this week, so "day one" is today. Like a fitness app — the before/after are the same on the day you join. It fills in as weeks pass.

**"Why does it say 0 receivables when we clearly have some?"**
> That means the receivables data didn't come through in the sync for that company. The module isn't hiding it — it's showing you a real gap in the source data.

**"Is this per company?"**
> Yes. Every score, decision and snapshot lives inside that company's own database. One company can never see another's data — it's isolated by design, not by a filter someone could forget.

---

*Written from the live code on the `aman` branch. If you change a threshold, a pillar weight, or a card, update this file too — it's meant to stay true.*
