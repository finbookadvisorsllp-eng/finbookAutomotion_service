"""Aman (LiveTally) backend package.

All Aman-project backend code lives under this package and is exposed under the
``/api/v3`` route prefix. It shares only the read-only tenant resolver
(``app.db``) and ``app.config`` with the Anjalee project; no business code
crosses the aman/anjalee boundary.
"""
