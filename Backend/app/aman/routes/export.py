"""Generic report export route (/api/v3/export/{report}).

Renders the current drill level of any registered report to PDF / Excel / CSV.
The same ``export_response`` helper backs the per-module export routes (e.g.
``/cash-bank/export``) so file-download behaviour stays identical everywhere.
"""
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.aman.core.dependencies import get_db, get_fy
from app.aman.services import export as export_engine
from app.aman.services.financial_year import resolve_date_range, fy_label

router = APIRouter(prefix="/export", tags=["aman:export"])


def export_response(db, report: str, fy: str, fmt: str, params: dict) -> Response:
    """Build the report document and stream it back as a file download."""
    try:
        doc = export_engine.build_document(db, report, fy, params)
        content, media_type, filename = export_engine.render(doc, fmt)
    except ImportError as exc:  # reportlab / openpyxl not installed
        raise HTTPException(status_code=501,
                            detail=f"Export dependency missing: {exc}. "
                                   f"Run: pip install reportlab openpyxl")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return Response(
        content=content, media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


def collect_params(level, group, ledgerId, ledgerName, month, voucherId,
                   search, voucherType, sort, order,
                   dateFilter, fromDate, toDate, fy, category=None) -> dict:
    start, end = resolve_date_range(dateFilter, fromDate, toDate, fy)
    return {
        "level": level, "category": category, "group": group, "ledgerId": ledgerId,
        "ledgerName": ledgerName, "month": month, "voucherId": voucherId,
        "search": search, "voucherType": voucherType, "sort": sort, "order": order,
        "start": start, "end": end,
        "periodLabel": fy_label(fy) if not (fromDate and toDate) else f"{fromDate} to {toDate}",
    }


@router.get("/{report}")
async def export_report(
    report: str,
    format: str = Query("pdf"),
    level: int = Query(0),
    category: Optional[str] = Query(None),
    group: Optional[str] = Query(None),
    ledgerId: Optional[str] = Query(None),
    ledgerName: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    voucherId: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    voucherType: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    order: str = Query("asc"),
    dateFilter: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    fy: str = Depends(get_fy),
    db=Depends(get_db),
):
    params = collect_params(level, group, ledgerId, ledgerName, month, voucherId,
                            search, voucherType, sort, order, dateFilter, fromDate, toDate, fy,
                            category=category)
    return export_response(db, report, fy, format, params)
