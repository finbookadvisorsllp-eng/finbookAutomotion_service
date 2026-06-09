"""Inventory service — stock summary, valuation (Avg cost), fast/slow movers.

Opening stock comes from ``stockItems.inventory.openingStock``; movement comes
from ``vouchers.inventoryEntries``. Closing value uses Weighted Average Cost
(matches the Tally ``stockGroups.valuationMethod`` of 'Avg. Price').
"""
from app.aman.core.serializers import money, parse_qty
from app.aman.repositories import stock_repo


def item_movements(db, fy: str) -> list[dict]:
    """Per-item opening/in/out/closing quantities + values with WAC valuation."""
    masters = stock_repo.all_stock_items(
        db, {"itemName": 1, "stockGroupName": 1, "unit.baseUnit": 1,
             "inventory.openingStock": 1, "gstSettings.gstRate": 1,
             "hsnSacDetails.hsnCode": 1, "reorderLevel": 1})
    movement = stock_repo.inventory_movement(db, fy)

    rows = []
    for i, m in enumerate(masters, start=1):
        name = m.get("itemName")
        if not name:
            continue
        opening = (m.get("inventory") or {}).get("openingStock") or {}
        open_qty = abs(parse_qty(opening.get("quantity")))
        open_val = abs(float(opening.get("value") or 0))
        mov = movement.get(name, {"inQty": 0.0, "inValue": 0.0, "outQty": 0.0,
                                  "outValue": 0.0, "txns": 0})
        in_qty, in_val = mov["inQty"], mov["inValue"]
        out_qty, out_val = mov["outQty"], mov["outValue"]
        closing_qty = round(open_qty + in_qty - out_qty, 3)

        # Weighted average cost across opening + purchases.
        avail_qty = open_qty + in_qty
        wac = (open_val + in_val) / avail_qty if avail_qty else 0.0
        closing_val = money(closing_qty * wac)

        reorder = float(m.get("reorderLevel") or 0)
        if closing_qty <= 0:
            status = "critical"
        elif reorder and closing_qty < reorder:
            status = "warning"
        else:
            status = "ok"

        rows.append({
            "id": i,
            "name": name,
            "group": m.get("stockGroupName"),
            "unit": (m.get("unit") or {}).get("baseUnit"),
            "hsn": (m.get("hsnSacDetails") or {}).get("hsnCode") or "",
            "gstRate": (m.get("gstSettings") or {}).get("gstRate") or 0,
            "opening": open_qty,
            "in": round(in_qty, 3),
            "out": round(out_qty, 3),
            "closing": closing_qty,
            "rate": money(wac),
            "value": closing_val,
            "salesValue": money(out_val),
            "txns": mov["txns"],
            "reorder": reorder,
            "status": status,
        })
    return rows


def closing_stock_value(db, fy: str) -> float:
    return money(sum(r["value"] for r in item_movements(db, fy)))


def stock_summary(db, fy: str) -> dict:
    rows = item_movements(db, fy)
    total_value = money(sum(r["value"] for r in rows))
    critical = sum(1 for r in rows if r["status"] == "critical")
    warning = sum(1 for r in rows if r["status"] == "warning")
    return {
        "items": rows,
        "summary": {
            "totalItems": len(rows),
            "totalValue": total_value,
            "criticalCount": critical,
            "warningCount": warning,
        },
    }


def fast_moving(db, fy: str, limit: int = 20) -> list[dict]:
    rows = sorted(item_movements(db, fy), key=lambda r: -r["out"])
    return [r for r in rows if r["out"] > 0][:limit]


def slow_moving(db, fy: str, limit: int = 20) -> list[dict]:
    rows = [r for r in item_movements(db, fy) if r["closing"] > 0]
    return sorted(rows, key=lambda r: r["out"])[:limit]


def valuation(db, fy: str) -> dict:
    rows = sorted(item_movements(db, fy), key=lambda r: -r["value"])
    return {"items": rows, "totalValue": money(sum(r["value"] for r in rows))}


def stock_alerts(db, fy: str) -> list[dict]:
    return [r for r in item_movements(db, fy) if r["status"] in ("critical", "warning")]


def item_performance(db, fy: str, item_name: str) -> dict:
    """Per-item ledger: vouchers touching the item over the FY."""
    from app.aman.core.serializers import fmt_date
    docs = stock_repo.stock_item_vouchers(db, fy, item_name)
    vouchers = []
    for v in docs:
        for ie in v.get("inventoryEntries", []):
            if ie.get("stockItemName") == item_name:
                vouchers.append({
                    "vchNo": v.get("voucherNumber"),
                    "date": fmt_date((v.get("dates") or {}).get("date")),
                    "type": v.get("voucherTypeName"),
                    "ledgerName": v.get("partyLedgerName") or "",
                    "qty": parse_qty(ie.get("actualQty") or ie.get("billedQty")),
                    "amount": money(abs(float(ie.get("amount") or 0))),
                })
    return {"name": item_name, "vouchers": vouchers}
