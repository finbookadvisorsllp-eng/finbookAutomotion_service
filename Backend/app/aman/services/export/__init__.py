"""Reusable export engine.

``render(doc, fmt)`` turns a :class:`ReportDocument` into downloadable bytes
(PDF / Excel / CSV). ``build_document(db, report, fy, params)`` dispatches through
the :data:`REPORT_BUILDERS` registry so any report can become exportable by
registering a builder that maps its current drill level to a ReportDocument.

Cash & Bank is wired here as the first consumer; Trial Balance, P&L, Balance
Sheet, Outstanding, Sales and Purchase plug in the same way.
"""
import re
from datetime import datetime

from app.aman.services.export.report_document import Column, ReportDocument


# ─────────────────────────── render dispatch ───────────────────────────
def _filename(doc: ReportDocument, ext: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", (doc.title or "report")).strip("_").lower()
    return f"{slug}_{datetime.now().strftime('%Y%m%d')}.{ext}"


def render(doc: ReportDocument, fmt: str) -> tuple[bytes, str, str]:
    """Return ``(content_bytes, media_type, filename)`` for the requested format."""
    fmt = (fmt or "pdf").lower()
    if fmt == "pdf":
        from app.aman.services.export.pdf import render_pdf
        return render_pdf(doc), "application/pdf", _filename(doc, "pdf")
    if fmt in ("xlsx", "excel", "xls"):
        from app.aman.services.export.excel import render_excel
        return (render_excel(doc),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                _filename(doc, "xlsx"))
    if fmt == "csv":
        from app.aman.services.export.csv_ import render_csv
        return render_csv(doc), "text/csv", _filename(doc, "csv")
    raise ValueError(f"Unsupported export format: {fmt!r} (use pdf | xlsx | csv)")


def _company_name(db) -> str:
    try:
        c = db["companies"].find_one({}, {"companyName": 1, "basicCompantFormalName": 1})
        if c:
            return (c.get("basicCompantFormalName") or c.get("companyName") or "").strip()
    except Exception:
        pass
    return ""


# ─────────────────────────── Cash & Bank builder ───────────────────────────
def build_cashbank_export_document(db, fy: str, params: dict) -> ReportDocument:
    """Map the Cash & Bank drill-down level (full, unpaginated) to a document."""
    from app.aman.services import cashbank_drilldown_service as svc

    level = int(params.get("level") or 0)
    company = _company_name(db)
    period = params.get("periodLabel") or fy

    # Export the entire filtered set (no pagination) for the current level.
    p = dict(params)
    p["page"] = 1
    p["limit"] = 0
    result = svc.drilldown(db, fy, level, p)
    data = result.get("data") or {}

    money = "money"
    if level <= 0:
        # Top level is the category overview; export the selected tab's ledgers.
        cat = (params.get("category") or "cash").lower()
        block = (data.get("bank") if cat == "bank" else data.get("cash")) or {}
        cols = [Column("name", "Account Name"), Column("group", "Group"),
                Column("opening", "Opening", "right", money),
                Column("receipts", "Receipts", "right", money),
                Column("payments", "Payments", "right", money),
                Column("closing", "Closing", "right", money)]
        title = "Bank Accounts" if cat == "bank" else "Cash Accounts"
        return ReportDocument(title, cols, block.get("rows", []), company=company, period=period,
                              totals=block.get("totals"), totals_label="Total")

    if level == 1:
        grp = (data.get("group") or {}).get("name")
        cols = [Column("name", "Ledger"), Column("group", "Group"),
                Column("opening", "Opening", "right", money),
                Column("receipts", "Receipts", "right", money),
                Column("payments", "Payments", "right", money),
                Column("closing", "Closing", "right", money)]
        title = f"Cash & Bank — {grp}" if grp else "Cash & Bank — All Accounts"
        return ReportDocument(title, cols, data.get("rows", []), company=company, period=period,
                              totals=data.get("totals"), totals_label="Total")

    if level == 2:
        ledger = (data.get("ledger") or {}).get("name", "")
        cols = [Column("month", "Month"),
                Column("opening", "Opening", "right", money),
                Column("receipts", "Receipts", "right", money),
                Column("payments", "Payments", "right", money),
                Column("closing", "Closing", "right", money)]
        return ReportDocument(f"{ledger} — Monthly Summary", cols, data.get("rows", []),
                              company=company, period=period,
                              totals=data.get("totals"), totals_label="Total")

    if level == 3:
        ledger = (data.get("ledger") or {}).get("name", "")
        plabel = (data.get("period") or {}).get("label")
        rows = [{"particulars": "Opening Balance", "running": data.get("opening", 0)}]
        rows += data.get("rows", [])
        cols = [Column("date", "Date"), Column("voucherNo", "Vch No"),
                Column("type", "Type"), Column("particulars", "Particulars"),
                Column("party", "Party"), Column("ref", "Ref"),
                Column("receipts", "Receipts", "right", money),
                Column("payments", "Payments", "right", money),
                Column("running", "Balance", "right", money)]
        totals = data.get("totals") or {}
        totals = {"receipts": totals.get("receipts"), "payments": totals.get("payments"),
                  "running": totals.get("closing")}
        return ReportDocument(f"{ledger} — Statement", cols, rows, company=company,
                              period=plabel or period, totals=totals,
                              totals_label="Closing Balance", totals_label_key="particulars")

    # level 4 — voucher detail (accounting entries)
    detail = data or {}
    entries = [{"drcr": "Dr" if e.get("isDr") else "Cr",
                "account": e.get("ledgerName"),
                "debit": e.get("amount") if e.get("isDr") else None,
                "credit": None if e.get("isDr") else e.get("amount")}
               for e in detail.get("entries", [])]
    cols = [Column("drcr", "Dr/Cr"), Column("account", "Account"),
            Column("debit", "Debit", "right", "money"),
            Column("credit", "Credit", "right", "money")]
    dr_total = sum(float(e.get("amount") or 0) for e in detail.get("entries", []) if e.get("isDr"))
    cr_total = sum(float(e.get("amount") or 0) for e in detail.get("entries", []) if not e.get("isDr"))
    return ReportDocument(
        f"Voucher {detail.get('voucherNo', '')}", cols, entries, company=company,
        period=f"{detail.get('type', '')} · {detail.get('date', '')}",
        totals={"debit": round(dr_total, 2), "credit": round(cr_total, 2)},
        totals_label="Total", totals_label_key="account")


def build_sales_export_document(db, fy: str, params: dict) -> ReportDocument:
    """Map the Sales Register drill level (full, unpaginated) to a document.

    Uses the same :func:`sales_register_service.drilldown` engine as the UI, so
    exported figures always reconcile with the screen for the current
    groupBy / measure / date-range / company.
    """
    from app.aman.services import sales_register_service as sreg

    level = int(params.get("level") or 0)
    group_by = params.get("groupBy") or "month"
    measure = "net" if params.get("measure") == "net" else "gross"
    doc_title = sreg.report_config(params.get("report")).get("title", "Sales Register")
    company = _company_name(db)
    period = params.get("periodLabel") or fy
    money = "money"

    p = dict(params)
    p["page"] = 1
    p["limit"] = 0  # export the entire filtered set
    result = sreg.drilldown(db, fy, level, p)
    data = result.get("data") or {}

    if level == 2:  # voucher detail — accounting entries
        entries = [{"drcr": "Dr" if e.get("isDr") else "Cr", "account": e.get("ledgerName"),
                    "debit": e.get("amount") if e.get("isDr") else None,
                    "credit": None if e.get("isDr") else e.get("amount")}
                   for e in data.get("entries", [])]
        cols = [Column("drcr", "Dr/Cr"), Column("account", "Account"),
                Column("debit", "Debit", "right", money), Column("credit", "Credit", "right", money)]
        dr = sum(float(e.get("amount") or 0) for e in data.get("entries", []) if e.get("isDr"))
        cr = sum(float(e.get("amount") or 0) for e in data.get("entries", []) if not e.get("isDr"))
        return ReportDocument(f"{doc_title} · Voucher {data.get('voucherNo', '')}", cols, entries,
                              company=company, period=f"{data.get('type', '')} · {data.get('date', '')}",
                              totals={"debit": round(dr, 2), "credit": round(cr, 2)},
                              totals_label="Total", totals_label_key="account")

    if level == 1:  # vouchers behind one group row
        cols = [Column("number", "Voucher No"), Column("date", "Date"),
                Column("party", "Customer"), Column("type", "Voucher Type"),
                Column("amount", measure.title(), "right", money)]
        title = f"{doc_title} — {data.get('label') or ''}".strip(" —")
        return ReportDocument(title or doc_title, cols, data.get("rows", []), company=company,
                              period=period, totals={"amount": (data.get("totals") or {}).get("total")},
                              totals_label="Total", totals_label_key="number")

    # level 0 — the register itself
    if group_by == "bill":
        cols = [Column("number", "Voucher No"), Column("date", "Date"),
                Column("party", "Customer"),
                Column("amount", measure.title(), "right", money)]
    elif group_by == "stockItem":
        cols = [Column("name", "Stock Item"), Column("qty", "Quantity", "right"),
                Column("rate", "Rate", "right", money), Column("amount", "Amount", "right", money)]
    else:
        label = {"month": "Month", "ledger": "Ledger", "voucherType": "Voucher Type",
                 "ledgerGroup": "Ledger Group", "stockGroup": "Stock Group",
                 "stockCategory": "Stock Category"}.get(group_by, "Group")
        cols = [Column("name", label), Column("amount", f"Value ({measure.title()})", "right", money)]
    totals_key = "number" if group_by == "bill" else "name"
    return ReportDocument(f"{doc_title} — {group_by.title()}", cols, data.get("rows", []),
                          company=company, period=period,
                          totals={"amount": data.get("total")},
                          totals_label="Total", totals_label_key=totals_key)


def build_purchase_export_document(db, fy: str, params: dict) -> ReportDocument:
    """Map the Purchase Register drill level (full, unpaginated) to a document.

    Uses the same :func:`purchase_register_service.drilldown` engine as the UI, so
    exported figures always reconcile with the screen for the current
    groupBy / measure / date-range / company.
    """
    from app.aman.services import purchase_register_service as preg

    level = int(params.get("level") or 0)
    group_by = params.get("groupBy") or "month"
    measure = "net" if params.get("measure") == "net" else "gross"
    doc_title = preg.report_config(params.get("report")).get("title", "Purchase Register")
    company = _company_name(db)
    period = params.get("periodLabel") or fy
    money = "money"

    p = dict(params)
    p["page"] = 1
    p["limit"] = 0  # export the entire filtered set
    result = preg.drilldown(db, fy, level, p)
    data = result.get("data") or {}

    if level == 2:  # voucher detail — accounting entries
        entries = [{"drcr": "Dr" if e.get("isDr") else "Cr", "account": e.get("ledgerName"),
                    "debit": e.get("amount") if e.get("isDr") else None,
                    "credit": None if e.get("isDr") else e.get("amount")}
                   for e in data.get("entries", [])]
        cols = [Column("drcr", "Dr/Cr"), Column("account", "Account"),
                Column("debit", "Debit", "right", money), Column("credit", "Credit", "right", money)]
        dr = sum(float(e.get("amount") or 0) for e in data.get("entries", []) if e.get("isDr"))
        cr = sum(float(e.get("amount") or 0) for e in data.get("entries", []) if not e.get("isDr"))
        return ReportDocument(f"{doc_title} · Voucher {data.get('voucherNo', '')}", cols, entries,
                              company=company, period=f"{data.get('type', '')} · {data.get('date', '')}",
                              totals={"debit": round(dr, 2), "credit": round(cr, 2)},
                              totals_label="Total", totals_label_key="account")

    if level == 1:  # vouchers behind one group row
        cols = [Column("number", "Voucher No"), Column("date", "Date"),
                Column("party", "Vendor"), Column("type", "Voucher Type"),
                Column("amount", measure.title(), "right", money)]
        title = f"{doc_title} — {data.get('label') or ''}".strip(" —")
        return ReportDocument(title or doc_title, cols, data.get("rows", []), company=company,
                              period=period, totals={"amount": (data.get("totals") or {}).get("total")},
                              totals_label="Total", totals_label_key="number")

    # level 0 — the register itself
    if group_by == "bill":
        cols = [Column("number", "Voucher No"), Column("date", "Date"),
                Column("party", "Vendor"),
                Column("amount", measure.title(), "right", money)]
    elif group_by == "stockItem":
        cols = [Column("name", "Stock Item"), Column("qty", "Quantity", "right"),
                Column("rate", "Rate", "right", money), Column("amount", "Amount", "right", money)]
    else:
        label = {"month": "Month", "ledger": "Ledger", "voucherType": "Voucher Type",
                 "ledgerGroup": "Ledger Group", "stockGroup": "Stock Group",
                 "stockCategory": "Stock Category"}.get(group_by, "Group")
        cols = [Column("name", label), Column("amount", f"Value ({measure.title()})", "right", money)]
    totals_key = "number" if group_by == "bill" else "name"
    return ReportDocument(f"{doc_title} — {group_by.title()}", cols, data.get("rows", []),
                          company=company, period=period,
                          totals={"amount": data.get("total")},
                          totals_label="Total", totals_label_key=totals_key)


REPORT_BUILDERS = {
    "cash-bank": build_cashbank_export_document,
    "sales": build_sales_export_document,
    "purchase": build_purchase_export_document,
}


def build_document(db, report: str, fy: str, params: dict) -> ReportDocument:
    builder = REPORT_BUILDERS.get(report)
    if not builder:
        raise ValueError(f"No export builder registered for report {report!r}")
    return builder(db, fy, params)
