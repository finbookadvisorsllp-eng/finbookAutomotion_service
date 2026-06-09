"""Tally setup / company info routes (/api/v3/setup) — powers TallySetup page."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db
from app.aman.core.serializers import serialize_doc, serialize_docs
from app.aman.models.common import ok

router = APIRouter(prefix="/setup", tags=["aman:setup"])


@router.get("/license")
async def license_info(db=Depends(get_db)):
    doc = db["tallyLicenseInfo"].find_one()
    return ok(serialize_doc(doc))


@router.get("/master-stats")
async def master_stats(db=Depends(get_db)):
    stats = serialize_docs(db["masterStats"].find({}))
    # Convenience: also expose live collection counts.
    counts = {
        "groups": db["groups"].count_documents({}),
        "ledgers": db["ledgers"].count_documents({}),
        "vouchers": db["vouchers"].count_documents({}),
        "stockItems": db["stockItems"].count_documents({}),
        "voucherTypes": db["voucherTypes"].count_documents({}),
        "stockGroups": db["stockGroups"].count_documents({}),
        "godowns": db["godowns"].count_documents({}),
    }
    return ok({"stats": stats, "counts": counts})


@router.get("/company-info")
async def company_info(db=Depends(get_db)):
    doc = db["companies"].find_one()
    return ok(serialize_doc(doc))
