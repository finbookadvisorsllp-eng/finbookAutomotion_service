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


@router.get("/debug-natraj")
async def inspect_ledgers(db=Depends(get_db)):
    import traceback
    
    try:
        # Search all groups containing PF, ESIC, Payable, Duties, or Taxes
        groups = list(db["groups"].find({}))
        groups_by_name = {g["groupName"]: g for g in groups}
        
        pf_esic_groups = [g for g in groups if "PF" in g["groupName"].upper() or "ESIC" in g["groupName"].upper() or "PAYBLE" in g["groupName"].upper()]
        
        # Let's inspect ledgers under Duties & Taxes
        d_t_ledgers = []
        for l in db["ledgers"].find():
            gname = l.get("groupName")
            # Trace hierarchy
            path = []
            curr = gname
            visited = set()
            while curr and curr not in visited:
                visited.add(curr)
                path.append(curr)
                g = groups_by_name.get(curr)
                curr = g.get("parentGroupName") if g else None
            
            hierarchy = list(reversed(path))
            if "Duties & Taxes" in hierarchy:
                d_t_ledgers.append({
                    "name": l.get("ledgerName"),
                    "groupName": gname,
                    "hierarchy": " > ".join(hierarchy),
                    "parent_exists": gname in groups_by_name
                })
        pf_esic_groups_clean = [
            {"groupName": g["groupName"], "parentGroupName": g.get("parentGroupName")}
            for g in pf_esic_groups
        ]
                
        return ok({
            "pf_esic_groups_in_db": pf_esic_groups_clean,
            "duties_and_taxes_ledgers": d_t_ledgers
        })


    except Exception as e:
        return ok({
            "error": str(e),
            "traceback": traceback.format_exc()
        })











