from bson import ObjectId
from datetime import datetime

def serialize_doc(doc: dict) -> dict:
    """
    Recursively serialize Mongo documents, converting ObjectId to string 
    and datetime instances to ISO format strings.
    """
    if not doc:
        return doc
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc
