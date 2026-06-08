"""Day Book route (/api/v3/reports/daybook) — all vouchers for a date/range."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query

from app.aman.core.dependencies import get_db, get_fy
from app.aman.core.serializers import fmt_date, iso_date, money
from app.aman.models.common import ok, paginate
from app.aman.repositories import voucher_repo
from app.aman.services.financial_year import fy_bounds

router = APIRouter(prefix="/reports", tags=["aman:reports:daybook"])


@router.get("/daybook")
async def daybook(fy: str = Depends(get_fy), date: str | None = Query(None),
                  page: int = Query(1, ge=1), limit: int = Query(100, ge=1, le=500),
                  db=Depends(get_db)):
    if date:
        try:
            start = datetime.fromisoformat(date)
            end = start + timedelta(days=1)
        except ValueError:
            start, end = fy_bounds(fy)
        match = {"dates.date": {"$gte": start, "$lt": end}}
    else:
        start, end = fy_bounds(fy)
        match = {"dates.date": {"$gte": start, "$lte": end}}

    total = voucher_repo.count(db, match)
    docs = voucher_repo.find(
        db, match,
        projection={"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
                    "dates.date": 1, "totals": 1, "narration": 1},
        sort=[("dates.date", -1)], skip=(page - 1) * limit, limit=limit)
    rows = [{
        "id": v.get("voucherNumber"),
        "voucherId": str(v.get("_id")),
        "date": fmt_date((v.get("dates") or {}).get("date")),
        "isoDate": iso_date((v.get("dates") or {}).get("date")),
        "type": v.get("voucherTypeName"),
        "party": v.get("partyLedgerName") or "",
        "amount": money((v.get("totals") or {}).get("totalDebit") or 0),
        "narration": v.get("narration") or "",
    } for v in docs]
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "date": date})
