"""Persistence for AI CFO — conversations, sessions and business memory.

All three collections live inside the caller's own ``sf_tenant_<id>`` database
(passed in as ``db``), so tenant isolation is automatic and free: a query can
only ever touch one company's chat history. Sync pymongo, matching every other
aman repository.

Collections
-----------
``ai_sessions``       one document per conversation (title + counters + owner)
``ai_conversations``  one document per message (role/content, ordered by time)
``ai_business_memory` durable business context (goals, targets, key customers)
"""
import threading
import uuid
from datetime import datetime
from typing import Optional

from app.aman.ai_cfo.config import ai_cfo_settings as cfg

_SESSIONS = cfg.SESSIONS_COLLECTION
_MESSAGES = cfg.CONVERSATIONS_COLLECTION
_MEMORY = cfg.BUSINESS_MEMORY_COLLECTION

_indexed_dbs: set[str] = set()
_index_lock = threading.Lock()


def _now() -> datetime:
    return datetime.utcnow()


def _new_id() -> str:
    return uuid.uuid4().hex


# ─────────────────────────────── Indexes ───────────────────────────────
def ensure_indexes(db) -> None:
    """Idempotently create the AI-CFO indexes for this tenant (once per process)."""
    name = db.name
    with _index_lock:
        if name in _indexed_dbs:
            return
        _indexed_dbs.add(name)
    try:
        db[_SESSIONS].create_index([("sessionId", 1)], unique=True)
        db[_SESSIONS].create_index([("userSub", 1), ("updatedAt", -1)])
        db[_MESSAGES].create_index([("sessionId", 1), ("seq", 1)])
        db[_MESSAGES].create_index([("createdAt", -1)])
        db[_MEMORY].create_index([("userSub", 1), ("key", 1)], unique=True)
    except Exception:
        # Index creation is best-effort; queries still work without them.
        pass


# ─────────────────────────────── Sessions ───────────────────────────────
def create_session(db, user_sub: str, fy: Optional[str] = None,
                   title: str = "New conversation") -> dict:
    ensure_indexes(db)
    now = _now()
    doc = {
        "sessionId": _new_id(),
        "userSub": user_sub or "unknown",
        "title": (title or "New conversation")[:120],
        "fy": fy,
        "messageCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    db[_SESSIONS].insert_one(doc)
    return doc


def get_session(db, session_id: str) -> Optional[dict]:
    if not session_id:
        return None
    return db[_SESSIONS].find_one({"sessionId": session_id})


def get_or_create_session(db, session_id: Optional[str], user_sub: str,
                          fy: Optional[str] = None) -> dict:
    if session_id:
        existing = get_session(db, session_id)
        if existing:
            return existing
    return create_session(db, user_sub, fy)


def list_sessions(db, user_sub: Optional[str] = None, limit: int = 50) -> list[dict]:
    ensure_indexes(db)
    match: dict = {}
    if user_sub and user_sub not in ("*", "dev-user"):
        match["userSub"] = user_sub
    cur = db[_SESSIONS].find(match).sort("updatedAt", -1).limit(int(limit))
    return list(cur)


def touch_session(db, session_id: str, title: Optional[str] = None,
                  inc_messages: int = 0) -> None:
    update: dict = {"$set": {"updatedAt": _now()}}
    if title:
        update["$set"]["title"] = title[:120]
    if inc_messages:
        update["$inc"] = {"messageCount": inc_messages}
    db[_SESSIONS].update_one({"sessionId": session_id}, update)


def delete_session(db, session_id: str) -> int:
    """Remove a session and every message in it. Returns messages deleted."""
    if not session_id:
        return 0
    res = db[_MESSAGES].delete_many({"sessionId": session_id})
    db[_SESSIONS].delete_one({"sessionId": session_id})
    return res.deleted_count


# ─────────────────────────────── Messages ───────────────────────────────
def _next_seq(db, session_id: str) -> int:
    last = db[_MESSAGES].find_one({"sessionId": session_id}, sort=[("seq", -1)],
                                  projection={"seq": 1})
    return int((last or {}).get("seq", 0)) + 1


def add_message(db, session_id: str, role: str, content: str,
                meta: Optional[dict] = None) -> dict:
    doc = {
        "sessionId": session_id,
        "seq": _next_seq(db, session_id),
        "role": role,
        "content": content,
        "meta": meta or {},
        "createdAt": _now(),
    }
    db[_MESSAGES].insert_one(doc)
    touch_session(db, session_id, inc_messages=1)
    return doc


def get_messages(db, session_id: str, limit: int = 200) -> list[dict]:
    if not session_id:
        return []
    cur = db[_MESSAGES].find({"sessionId": session_id}).sort("seq", 1).limit(int(limit))
    return list(cur)


def recent_turns_for_model(db, session_id: str, turns: int) -> list[dict]:
    """Return the last ``turns`` messages as ``[{role, content}]`` for the model.

    Ordered oldest→newest so the provider sees a natural transcript. System
    messages are excluded (the live system prompt is rebuilt every call)."""
    if not session_id:
        return []
    cur = (db[_MESSAGES]
           .find({"sessionId": session_id, "role": {"$in": ["user", "assistant"]}},
                 projection={"role": 1, "content": 1, "seq": 1})
           .sort("seq", -1).limit(int(turns)))
    rows = list(cur)
    rows.reverse()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


# ─────────────────────────────── Business memory ───────────────────────────────
def get_business_memory(db, user_sub: str) -> list[dict]:
    ensure_indexes(db)
    match = {} if user_sub in ("*", "dev-user", None) else {"userSub": user_sub}
    return list(db[_MEMORY].find(match).sort("updatedAt", -1))


def upsert_business_memory(db, user_sub: str, key: str, value, category: str = "general") -> dict:
    ensure_indexes(db)
    now = _now()
    db[_MEMORY].update_one(
        {"userSub": user_sub, "key": key},
        {"$set": {"value": value, "category": category, "updatedAt": now},
         "$setOnInsert": {"createdAt": now}},
        upsert=True,
    )
    return db[_MEMORY].find_one({"userSub": user_sub, "key": key})


def delete_business_memory(db, user_sub: str, key: str) -> int:
    res = db[_MEMORY].delete_one({"userSub": user_sub, "key": key})
    return res.deleted_count
