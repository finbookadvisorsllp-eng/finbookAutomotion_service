"""Report-agnostic document model shared by every export renderer.

A report (any level of any report type) is reduced to a :class:`ReportDocument`
— a title, the company/period context, typed columns, rows, and an optional
totals row. The PDF / Excel / CSV renderers consume only this shape, so adding a
new exportable report is just writing a builder that returns one of these.
"""
from dataclasses import dataclass, field


@dataclass
class Column:
    key: str
    label: str
    align: str = "left"      # left | right | center
    fmt: str = "text"        # text | money | date
    width: float | None = None  # relative weight for column sizing (optional)


@dataclass
class ReportDocument:
    title: str
    columns: list[Column]
    rows: list[dict]
    company: str = ""
    period: str = ""
    subtitle: str = ""
    totals: dict | None = None          # {column_key: value}
    totals_label: str = "Total"
    totals_label_key: str | None = None  # column the label is written into
    footer: str = ""
    meta: dict = field(default_factory=dict)


def format_inr(value, decimals: int = 2) -> str:
    """Indian-grouped money string, e.g. 1234567.5 -> '12,34,567.50'.

    Negative values are wrapped the accounting way (parentheses). Used by the PDF
    and CSV display renderers; Excel keeps numbers numeric with a number format.
    """
    try:
        num = float(value or 0)
    except (TypeError, ValueError):
        return str(value)
    neg = num < 0
    num = abs(round(num, decimals))
    whole = int(num)
    frac = round(num - whole, decimals)
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        # group the head in pairs (Indian system)
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups) + "," + tail
    if decimals:
        s = f"{s}.{str(int(round(frac * (10 ** decimals)))).zfill(decimals)}"
    return f"({s})" if neg else s


def format_cell(value, fmt: str) -> str:
    """Render a single cell to display text according to its column format."""
    if value is None or value == "":
        return ""
    if fmt == "money":
        return format_inr(value)
    return str(value)
