"""Tally-style PDF renderer (reportlab) for a :class:`ReportDocument`.

Layout: company name + report title + period header band, a table whose header
row repeats on every page, right-aligned money columns, a bold totals row, and a
footer carrying "Page X of Y" and the generation timestamp.
"""
from datetime import datetime
from io import BytesIO

from app.aman.services.export.report_document import ReportDocument, format_cell


def render_pdf(doc: ReportDocument) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle)
    from reportlab.pdfgen import canvas as _canvas

    page_size = landscape(A4) if len(doc.columns) > 6 else A4
    page_w, page_h = page_size
    margin = 14 * mm
    avail_w = page_w - 2 * margin

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], fontSize=15, spaceAfter=2,
                                 textColor=colors.HexColor("#0f172a"))
    company_style = ParagraphStyle("c", parent=styles["Normal"], fontSize=11, spaceAfter=1,
                                   alignment=1, textColor=colors.HexColor("#1e293b"))
    sub_style = ParagraphStyle("s", parent=styles["Normal"], fontSize=8.5, alignment=1,
                               textColor=colors.HexColor("#64748b"))
    cell_style = ParagraphStyle("cell", parent=styles["Normal"], fontSize=8, leading=10)

    # ── Header / footer painter with total page count (two-pass canvas) ──
    class NumberedCanvas(_canvas.Canvas):
        def __init__(self, *a, **kw):
            super().__init__(*a, **kw)
            self._saved = []

        def showPage(self):
            self._saved.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            n = len(self._saved)
            for state in self._saved:
                self.__dict__.update(state)
                self._draw_footer(n)
                super().showPage()
            super().save()

        def _draw_footer(self, page_count):
            self.setFont("Helvetica", 7)
            self.setFillColor(colors.HexColor("#94a3b8"))
            ts = datetime.now().strftime("%d %b %Y %H:%M")
            self.drawString(margin, 9 * mm, f"Generated {ts}")
            self.drawRightString(page_w - margin, 9 * mm,
                                 f"Page {self._pageNumber} of {page_count}")

    def _draw_header(cv, _doc):
        cv.saveState()
        y = page_h - margin
        if doc.company:
            cv.setFont("Helvetica-Bold", 12)
            cv.setFillColor(colors.HexColor("#0f172a"))
            cv.drawCentredString(page_w / 2, y, doc.company)
            y -= 14
        cv.setFont("Helvetica-Bold", 11)
        cv.setFillColor(colors.HexColor("#1d4ed8"))
        cv.drawCentredString(page_w / 2, y, doc.title)
        y -= 12
        if doc.period:
            cv.setFont("Helvetica", 8.5)
            cv.setFillColor(colors.HexColor("#64748b"))
            cv.drawCentredString(page_w / 2, y, doc.period)
        cv.restoreState()

    # ── Column widths (weight by align/fmt; text gets more room) ──
    weights = []
    for c in doc.columns:
        if c.width:
            weights.append(c.width)
        elif c.fmt == "money":
            weights.append(1.1)
        elif c.align == "left":
            weights.append(2.0)
        else:
            weights.append(1.0)
    total_w = sum(weights) or 1
    col_widths = [avail_w * w / total_w for w in weights]

    # ── Table data ──
    header = [Paragraph(f"<b>{c.label}</b>", ParagraphStyle(
        "h", parent=cell_style, textColor=colors.white,
        alignment={"right": 2, "center": 1}.get(c.align, 0))) for c in doc.columns]
    data = [header]

    for r in doc.rows:
        row = []
        for c in doc.columns:
            txt = format_cell(r.get(c.key), c.fmt)
            row.append(Paragraph(txt, ParagraphStyle(
                "d", parent=cell_style, alignment={"right": 2, "center": 1}.get(c.align, 0))))
        data.append(row)

    has_totals = bool(doc.totals)
    if has_totals:
        label_key = doc.totals_label_key or doc.columns[0].key
        trow = []
        for c in doc.columns:
            if c.key == label_key:
                val = doc.totals_label
            elif c.key in doc.totals:
                val = format_cell(doc.totals.get(c.key), c.fmt)
            else:
                val = ""
            trow.append(Paragraph(f"<b>{val}</b>", ParagraphStyle(
                "tot", parent=cell_style, alignment={"right": 2, "center": 1}.get(c.align, 0))))
        data.append(trow)

    table = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2 if has_totals else -1),
         [colors.white, colors.HexColor("#f8fafc")]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#1e293b")),
        ("GRID", (0, 1), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
    ]
    if has_totals:
        style += [
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
            ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#1e293b")),
        ]
    table.setStyle(TableStyle(style))

    buf = BytesIO()
    top_pad = 30 * mm if doc.company else 24 * mm
    frame = Frame(margin, margin, avail_w, page_h - margin - top_pad, id="body")
    template = PageTemplate(id="main", frames=[frame], onPage=_draw_header)
    pdf = BaseDocTemplate(buf, pagesize=page_size, leftMargin=margin, rightMargin=margin,
                          topMargin=margin, bottomMargin=margin, title=doc.title)
    pdf.addPageTemplates([template])
    pdf.build([table], canvasmaker=NumberedCanvas)
    return buf.getvalue()
