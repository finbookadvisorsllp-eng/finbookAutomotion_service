"""Tiny in-process TTL cache (stdlib only).

Used to memoise expensive report aggregations. Keyed by (tenant, fy, report,
params). For a single-instance deployment this is sufficient; swap the backing
store for Redis when scaling horizontally (the public API here stays the same).
"""
import threading
import time
from typing import Any, Callable

from app.aman.config import aman_settings


class TTLCache:
    def __init__(self, default_ttl: int = 600):
        self._default_ttl = default_ttl
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = threading.RLock()

    def get(self, key: str):
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            expires_at, value = item
            if expires_at < time.time():
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl: int | None = None):
        with self._lock:
            self._store[key] = (time.time() + (ttl or self._default_ttl), value)

    def invalidate(self, prefix: str | None = None):
        """Drop everything (prefix=None) or all keys starting with ``prefix``."""
        with self._lock:
            if prefix is None:
                self._store.clear()
            else:
                for k in [k for k in self._store if k.startswith(prefix)]:
                    self._store.pop(k, None)

    def stats(self) -> dict:
        with self._lock:
            now = time.time()
            live = sum(1 for exp, _ in self._store.values() if exp >= now)
            return {"entries": len(self._store), "live": live}


report_cache = TTLCache(aman_settings.CACHE_TTL_SECONDS)


def cache_key(tenant: str, report: str, **params) -> str:
    parts = [tenant or "default", report]
    for k in sorted(params):
        parts.append(f"{k}={params[k]}")
    return "|".join(parts)


def cached_report(tenant: str, report: str, builder: Callable[[], Any],
                  ttl: int | None = None, **params) -> Any:
    """Return a cached report or build+store it. Respects CACHE_ENABLED."""
    if not aman_settings.CACHE_ENABLED:
        return builder()
    key = cache_key(tenant, report, **params)
    hit = report_cache.get(key)
    if hit is not None:
        return hit
    value = builder()
    report_cache.set(key, value, ttl)
    return value
