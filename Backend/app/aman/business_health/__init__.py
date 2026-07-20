"""Business Health — an AI operating layer for SME owners on the LiveTally (aman) product.

Self-contained package, mirroring ``app.aman.ai_cfo``: everything Business-Health
lives here so it can evolve and be tested independently of the report modules it
*consumes*.

Design contract (never violated):
  * It NEVER re-invents accounting. Every rupee is pulled from an existing report
    service (``dashboard_service``, ``pl_service``, ``outstanding_service``,
    ``inventory_service``, ``cashflow_service``, ``forecast``, ``rules_engine``,
    ``context_builder``) — the same engines that power the UI, so every score,
    KPI and decision reconciles to the rupee with the report pages.
  * Deterministic core, thin AI layer. Scores, ₹ values and rankings are computed
    in Python and are fully reproducible; the LLM only writes prose (the weekly
    briefing and each decision's "why/how"). An AI failure never blanks a number.
  * Honesty is surfaced, not hidden. Proxy metrics (e.g. run-rate collections when
    bill-wise due dates are absent) carry a confidence / coverage flag through to
    the UI; fabricated precision is never rendered.
  * Fully tenant-isolated: the Decision Ledger and health snapshots live in the
    caller's ``sf_tenant_<id>`` database, reached through the shared ``get_db``
    dependency, and it is gated by ``require_aman_subscription``.

Approved product decisions (milestone: Business Health v1 — "Decision Engine"):
  * The Health Score has FIVE pillars; the fifth is **Book Hygiene** (derivable
    book-quality signals), replacing a "Compliance filings" pillar we cannot
    source honestly. See ``config.PILLAR_WEIGHTS``.
  * All intelligence — decisions, recommendations, risks, opportunities and
    priorities — is **company-scoped**: it belongs to the currently selected
    company (the tenant database). Group-level intelligence is a future release.

Flow:  Reports → KPIs / Pillars → Risks + Opportunities → Priority → Decisions
"""
