"""CSV renderer for a :class:`ReportDocument`.

Money columns are emitted as raw rounded numbers (no grouping/symbol) so the file
stays machine-computable in Excel or scripts. A few context lines (company /
period) precede the column headers, and a totals row is appended when present.
"""
import csv
from io import StringIO

from app.aman.services.export.report_document import ReportDocument


def render_csv(doc: ReportDocument) -> bytes:
    sio = StringIO()
    w = csv.writer(sio)

    if doc.company:
        w.writerow([doc.company])
    w.writerow([doc.title])
    if doc.period:
        w.writerow([doc.period])
    w.writerow([])

    w.writerow([c.label for c in doc.columns])

    def _val(row, col):
        v = row.get(col.key)
        if col.fmt == "money":
            try:
                return round(float(v or 0), 2)
            except (TypeError, ValueError):
                return v
        return "" if v is None else v

    for row in doc.rows:
        w.writerow([_val(row, c) for c in doc.columns])

    if doc.totals:
        label_key = doc.totals_label_key or doc.columns[0].key
        out = []
        for c in doc.columns:
            if c.key == label_key:
                out.append(doc.totals_label)
            elif c.key in doc.totals:
                if c.fmt == "money":
                    try:
                        out.append(round(float(doc.totals[c.key] or 0), 2))
                    except (TypeError, ValueError):
                        out.append(doc.totals[c.key])
                else:
                    out.append(doc.totals[c.key])
            else:
                out.append("")
        w.writerow(out)

    return sio.getvalue().encode("utf-8-sig")  # BOM so Excel reads UTF-8
