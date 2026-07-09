"""AI CFO — a virtual Chief Financial Officer for the LiveTally (aman) product.

Self-contained package: everything AI-CFO lives here so it is easy to reason
about, test and evolve independently of the report modules it *consumes*.

Design contract (never violated):
  * It NEVER re-invents accounting. Every figure comes from an existing report
    service (see ``context_builder``) — the same engine that powers the UI, so
    the AI's numbers reconcile to the rupee with the report pages.
  * It is fully tenant-isolated: conversations/sessions live in the caller's
    ``sf_tenant_<id>`` database, reached through the shared ``get_db`` dependency.
  * It is gated by ``require_aman_subscription`` — an anjalee token can never
    reach any /api/v3/ai-cfo endpoint.

Flow:  Reports → Financial Context → AI Analysis → Business Recommendations
"""
