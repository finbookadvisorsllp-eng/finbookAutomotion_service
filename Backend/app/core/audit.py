"""
app/core/audit.py
=================
Fire-and-forget asynchronous audit log writer.
Saves authentication events to the `iam.audit_logs` collection.
"""
from datetime import datetime
from typing import Optional
from app.core.iam_db import get_async_iam_db

async def log_event(
    event_type: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    org_id: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    meta: Optional[dict] = None,
):
    """
    Log an event into the central iam.audit_logs collection.
    Wrapped in try-except so logging issues never break the active request.
    """
    try:
        db = await get_async_iam_db()
        record = {
            "eventType": event_type,
            "userId": user_id,
            "email": email,
            "orgId": org_id,
            "ip": ip,
            "userAgent": user_agent,
            "timestamp": datetime.utcnow(),
            "meta": meta or {},
        }
        await db["audit_logs"].insert_one(record)
    except Exception as e:
        # Fail silently to avoid breaking the core auth lifecycle
        pass
