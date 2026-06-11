"""Financial-Year utilities (Indian FY: 1 Apr -> 31 Mar).

A FY is identified by the string ``"2025-2026"`` (start year - end year).
``dates.date`` on a voucher is the accounting date used for all FY filtering.
"""
import re
from datetime import datetime

_FY_RE = re.compile(r"^(\d{4})-(\d{4})$")
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
# Months in Indian FY display order (Apr first).
FY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]


def is_valid_fy(fy: str) -> bool:
    m = _FY_RE.match(fy or "")
    if not m:
        return False
    a, b = int(m.group(1)), int(m.group(2))
    return b == a + 1


def fy_bounds(fy: str) -> tuple[datetime, datetime]:
    """Return (start, end) datetimes for the FY, inclusive of the last second."""
    if not is_valid_fy(fy):
        raise ValueError(f"Invalid financial year: {fy}")
    start_year = int(fy.split("-")[0])
    start = datetime(start_year, 4, 1, 0, 0, 0)
    end = datetime(start_year + 1, 3, 31, 23, 59, 59, 999000)
    return start, end


def fy_label(fy: str) -> str:
    """'2025-2026' -> '01/04/2025 - 31/03/2026' (matches the UI year picker)."""
    start, end = fy_bounds(fy)
    return f"01/04/{start.year} - 31/03/{end.year}"


def fy_of_date(d: datetime) -> str:
    """Return the FY string a given date falls into."""
    if d.month >= 4:
        return f"{d.year}-{d.year + 1}"
    return f"{d.year - 1}-{d.year}"


def current_fy(today: datetime | None = None) -> str:
    return fy_of_date(today or datetime.now())


def prev_fy(fy: str) -> str:
    start_year = int(fy.split("-")[0])
    return f"{start_year - 1}-{start_year}"


def date_filter(fy: str, field: str = "dates.date") -> dict:
    """Mongo match clause for a FY range on the given date field."""
    start, end = fy_bounds(fy)
    return {field: {"$gte": start, "$lte": end}}


def list_financial_years(db) -> list[dict]:
    """Derive selectable FYs from the min/max voucher date in the tenant DB.

    Falls back to a sensible default window if the collection is empty.
    Returns ``[{id, label}]`` ordered oldest -> newest (UI expects this).
    """
    try:
        first = db["vouchers"].find_one({"dates.date": {"$ne": None}}, sort=[("dates.date", 1)])
        last = db["vouchers"].find_one({"dates.date": {"$ne": None}}, sort=[("dates.date", -1)])
    except Exception:
        first = last = None

    if first and last and first.get("dates", {}).get("date") and last.get("dates", {}).get("date"):
        start_fy = int(fy_of_date(first["dates"]["date"]).split("-")[0])
        end_fy = int(fy_of_date(last["dates"]["date"]).split("-")[0])
    else:
        now_year = datetime.now().year
        start_fy, end_fy = now_year - 2, now_year

    years = []
    for y in range(start_fy, end_fy + 1):
        fy = f"{y}-{y + 1}"
        years.append({"id": fy, "label": fy_label(fy)})
    return years


def month_buckets(fy: str) -> list[dict]:
    """Ordered month bucket descriptors for a FY: [{id:'Apr 25', month:4, year:2025}]."""
    start, _ = fy_bounds(fy)
    buckets = []
    for m in FY_MONTH_ORDER:
        year = start.year if m >= 4 else start.year + 1
        buckets.append({
            "id": f"{_MONTHS[m - 1]} {str(year)[2:]}",
            "label": f"{_MONTHS[m - 1]} {str(year)[2:]}",
            "month": m,
            "year": year,
        })
    return buckets


def date_range_filter(start: datetime, end: datetime, field: str = "dates.date") -> dict:
    """Mongo match clause for an arbitrary date range on the given date field."""
    return {field: {"$gte": start, "$lte": end}}


def resolve_date_range(
    date_filter_str: str | None = None,
    from_date_str: str | None = None,
    to_date_str: str | None = None,
    fy: str | None = None
) -> tuple[datetime, datetime]:
    """
    Resolves date range into inclusive (start_datetime, end_datetime) based on the filter.
    Defaults to FY range if no filter is provided.
    """
    from datetime import time, timedelta
    now = datetime.now()

    if date_filter_str == "today":
        start = datetime.combine(now.date(), time.min)
        end = datetime.combine(now.date(), time.max)
        return start, end

    elif date_filter_str == "this_month":
        start = datetime(now.year, now.month, 1, 0, 0, 0)
        if now.month == 12:
            end = datetime(now.year, 12, 31, 23, 59, 59, 999000)
        else:
            next_month = datetime(now.year, now.month + 1, 1)
            end = next_month - timedelta(microseconds=1000)
        return start, end

    elif date_filter_str == "this_quarter":
        m = now.month
        if m in (4, 5, 6):
            q_start_month = 4
            q_end_month = 6
            q_year = now.year
        elif m in (7, 8, 9):
            q_start_month = 7
            q_end_month = 9
            q_year = now.year
        elif m in (10, 11, 12):
            q_start_month = 10
            q_end_month = 12
            q_year = now.year
        else:  # 1, 2, 3
            q_start_month = 1
            q_end_month = 3
            q_year = now.year

        start = datetime(q_year, q_start_month, 1, 0, 0, 0)
        if q_end_month == 12:
            end = datetime(q_year, 12, 31, 23, 59, 59, 999000)
        else:
            next_month = datetime(q_year, q_end_month + 1, 1)
            end = next_month - timedelta(microseconds=1000)
        return start, end

    elif date_filter_str == "this_financial_year":
        fy_str = fy_of_date(now)
        return fy_bounds(fy_str)

    elif date_filter_str == "custom" or (from_date_str and to_date_str):
        if from_date_str and to_date_str:
            try:
                start = datetime.strptime(from_date_str, "%Y-%m-%d")
                end = datetime.strptime(to_date_str, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999000)
                return start, end
            except ValueError:
                pass
        fy_str = fy or fy_of_date(now)
        return fy_bounds(fy_str)

    else:
        fy_str = fy or fy_of_date(now)
        return fy_bounds(fy_str)

