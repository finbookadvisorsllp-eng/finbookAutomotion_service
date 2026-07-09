import datetime
import re
from typing import Dict, Any, Optional, List

class BusinessReportService:
    def __init__(self, db):
        self.db = db

    def _get_vch_datetime(self, doc) -> Optional[datetime.datetime]:
        dt_val = doc.get("dates", {}).get("date")
        if not dt_val:
            return None
        if isinstance(dt_val, datetime.datetime):
            return dt_val
        if isinstance(dt_val, str):
            try:
                return datetime.datetime.strptime(dt_val.split(".")[0], "%Y-%m-%d %H:%M:%S")
            except Exception:
                try:
                    return datetime.datetime.strptime(dt_val.split()[0], "%Y-%m-%d")
                except Exception:
                    pass
        return None

    async def get_ledger_balance(self, ledger_name: str) -> float:
        doc = await self.db["ledgers"].find_one({"ledgerName": ledger_name})
        if not doc:
            return 0.0
        opening_bal = doc.get("balances", {}).get("openingBalance", {})
        op_amount = float(opening_bal.get("amount") or 0.0)
        op_type = opening_bal.get("type") or "DEBIT"
        balance = op_amount if op_type == "DEBIT" else -op_amount
        
        cursor = self.db["vouchers"].find({"ledgerEntries.ledgerName": ledger_name})
        async for v in cursor:
            for entry in v.get("ledgerEntries", []):
                if entry.get("ledgerName") == ledger_name:
                    amt = float(entry.get("amount") or 0.0)
                    is_debit = entry.get("isDeemedPositive", False)
                    balance += amt if is_debit else -amt
                    
        return balance

    async def handle_business_query(self, user_message: str) -> Optional[str]:
        msg_lower = user_message.lower()
        
        # 1. Today's Sales
        if any(kw in msg_lower for kw in ["today's sales", "today sales", "sales today", "aaj ki sales", "todays sales"]):
            start_dt = datetime.datetime.combine(datetime.date.today(), datetime.time.min)
            end_dt = datetime.datetime.combine(datetime.date.today(), datetime.time.max)
            
            cursor = self.db["vouchers"].find({"voucherTypeName": {"$regex": "^sales$", "$options": "i"}})
            total = 0.0
            today_vouchers = []
            async for v in cursor:
                dt = self._get_vch_datetime(v)
                if dt and start_dt <= dt <= end_dt:
                    total += v.get("totals", {}).get("totalDebit") or 0.0
                    today_vouchers.append(v)
                    
            latest_sale = await self.db["vouchers"].find_one(
                {"voucherTypeName": {"$regex": "^sales$", "$options": "i"}},
                sort=[("dates.date", -1)]
            )
            latest_str = ""
            if latest_sale:
                dt = self._get_vch_datetime(latest_sale)
                dt_str = dt.strftime("%d-%b-%Y") if dt else "N/A"
                party = latest_sale.get("partyLedgerName") or latest_sale.get("partyName") or "N/A"
                amt = latest_sale.get("totals", {}).get("totalDebit") or 0.0
                v_num = latest_sale.get("voucherNumber") or "N/A"
                latest_str = f"\n\n*Note: No sales were recorded for today's date ({datetime.date.today().strftime('%d-%b-%Y')}). The last recorded sale was on **{dt_str}** to **{party}** for **₹{amt:,.2f}** (Voucher No: {v_num}).*"
            
            return f"### 📊 Today's Sales Summary\n\n- **Today's Sales**: ₹{total:,.2f}\n- **Invoices Created**: {len(today_vouchers)}{latest_str}"

        # 2. Top Customer
        elif any(kw in msg_lower for kw in ["top customer", "top customers", "highest sales customer", "best customer", "sabse bada customer"]):
            pipeline = [
                {"$match": {"voucherTypeName": {"$regex": "^sales$", "$options": "i"}}},
                {"$group": {
                    "_id": "$partyLedgerName",
                    "totalSales": {"$sum": "$totals.totalDebit"},
                    "invoiceCount": {"$sum": 1}
                }},
                {"$sort": {"totalSales": -1}},
                {"$limit": 5}
            ]
            cursor = self.db["vouchers"].aggregate(pipeline)
            results = await cursor.to_list(length=5)
            rows = []
            for i, r in enumerate(results):
                rows.append(f"| {i+1} | {r['_id']} | ₹ {r['totalSales']:,.2f} | {r['invoiceCount']} |")
            
            return "### 🏆 Top Customers (by Sales Volume)\n\n| Rank | Customer Name | Total Sales (₹) | Invoices |\n|---|---|---|---|\n" + "\n".join(rows)

        # 3. Most Sold Item
        elif any(kw in msg_lower for kw in ["most sold item", "most sold items", "top item", "top sold item", "highest selling item", "most selling item"]):
            pipeline = [
                {"$match": {"voucherTypeName": {"$regex": "^sales$", "$options": "i"}}},
                {"$unwind": "$inventoryEntries"},
                {"$match": {"inventoryEntries.stockItemName": {"$ne": None}}},
                {"$group": {
                    "_id": "$inventoryEntries.stockItemName",
                    "totalAmount": {"$sum": "$inventoryEntries.amount"},
                    "qtyStrings": {"$push": "$inventoryEntries.actualQty"}
                }}
            ]
            cursor = self.db["vouchers"].aggregate(pipeline)
            results = await cursor.to_list(length=100)
            
            parsed_results = []
            for r in results:
                total_qty = 0.0
                unit = "Pcs"
                for q_str in r["qtyStrings"]:
                    if q_str:
                        m = re.search(r'(\d+(?:\.\d+)?)', str(q_str))
                        if m:
                            total_qty += float(m.group(1))
                        unit_match = re.search(r'[a-zA-Z]+', str(q_str))
                        if unit_match:
                            unit = unit_match.group(0)
                parsed_results.append({
                    "item_name": r["_id"],
                    "total_qty": total_qty,
                    "unit": unit,
                    "total_amount": r["totalAmount"]
                })
                
            parsed_results.sort(key=lambda x: x["total_qty"], reverse=True)
            rows = []
            for i, it in enumerate(parsed_results[:5]):
                rows.append(f"| {i+1} | {it['item_name']} | {it['total_qty']:,.0f} {it['unit']} | ₹ {it['total_amount']:,.2f} |")
                
            return "### 📦 Most Sold Items\n\n| Rank | Item Name | Quantity Sold | Total Value (₹) |\n|---|---|---|---|\n" + "\n".join(rows)

        # 4. Outstanding Receivables
        elif any(kw in msg_lower for kw in ["outstanding receivables", "total outstanding", "outstanding balance", "receivables", "dena", "outstanding"]):
            debtors_cursor = self.db["ledgers"].find({"groupName": "Sundry Debtors"})
            debtors = await debtors_cursor.to_list(length=1000)
            
            total_outstanding = 0.0
            debtor_balances = []
            for d in debtors:
                bal = await self.get_ledger_balance(d["ledgerName"])
                if bal > 0.01:
                    total_outstanding += bal
                    debtor_balances.append({
                        "name": d["ledgerName"],
                        "balance": bal
                    })
                    
            debtor_balances.sort(key=lambda x: x["balance"], reverse=True)
            rows = []
            for i, d in enumerate(debtor_balances[:5]):
                rows.append(f"- **{d['name']}**: ₹ {d['balance']:,.2f}")
                
            return f"### 💸 Outstanding Receivables (Sundry Debtors)\n\n- **Total Outstanding Receivables**: **₹ {total_outstanding:,.2f}**\n\n**Top Debtors:**\n" + "\n".join(rows)

        # 5. Profit this month
        elif any(kw in msg_lower for kw in ["profit this month", "profit", "monthly profit", "net profit"]):
            latest_vch = await self.db["vouchers"].find_one({}, sort=[("dates.date", -1)])
            if not latest_vch:
                return "No transactions found to calculate monthly profit."
            
            dt = self._get_vch_datetime(latest_vch)
            if not dt:
                return "Could not parse transactions date."
                
            year = dt.year
            month = dt.month
            month_name = dt.strftime("%B %Y")
            
            start_dt = datetime.datetime(year, month, 1)
            if month == 12:
                end_dt = datetime.datetime(year+1, 1, 1)
            else:
                end_dt = datetime.datetime(year, month+1, 1)
                
            # Sales
            sales_total = 0.0
            cursor = self.db["vouchers"].find({"voucherTypeName": {"$regex": "^sales$", "$options": "i"}})
            async for v in cursor:
                v_dt = self._get_vch_datetime(v)
                if v_dt and start_dt <= v_dt < end_dt:
                    sales_total += v.get("totals", {}).get("totalDebit") or 0.0
                    
            # Purchases
            purchases_total = 0.0
            cursor = self.db["vouchers"].find({"voucherTypeName": {"$regex": "^purchase$", "$options": "i"}})
            async for v in cursor:
                v_dt = self._get_vch_datetime(v)
                if v_dt and start_dt <= v_dt < end_dt:
                    purchases_total += v.get("totals", {}).get("totalDebit") or 0.0
                    
            profit = sales_total - purchases_total
            return f"### 📈 Profit Summary (for {month_name})\n\n- **Total Sales**: ₹ {sales_total:,.2f}\n- **Total Purchases**: ₹ {purchases_total:,.2f}\n- **Net Profit**: **₹ {profit:,.2f}**\n\n*Note: Based on the latest active month in the database ({month_name}).*"

        # 6. Bank Balance
        elif any(kw in msg_lower for kw in ["bank balance", "total bank", "bank account balance", "bank details"]):
            banks_cursor = self.db["ledgers"].find({"groupName": {"$in": ["Bank Accounts", "Bank OD A/c"]}})
            banks = await banks_cursor.to_list(length=100)
            
            total_balance = 0.0
            bank_balances = []
            for b in banks:
                bal = await self.get_ledger_balance(b["ledgerName"])
                total_balance += bal
                bank_balances.append(f"- **{b['ledgerName']}**: ₹ {bal:,.2f}")
                
            return f"### 🏦 Bank Balances\n\n- **Total Bank Balance**: **₹ {total_balance:,.2f}**\n\n**Accounts:**\n" + "\n".join(bank_balances)

        # 7. Cash in Hand
        elif any(kw in msg_lower for kw in ["cash in hand", "cash balance", "cash in hand balance"]):
            cash_cursor = self.db["ledgers"].find({"groupName": "Cash-in-Hand"})
            cash_ledgers = await cash_cursor.to_list(length=100)
            
            total_balance = 0.0
            cash_balances = []
            for c in cash_ledgers:
                bal = await self.get_ledger_balance(c["ledgerName"])
                total_balance += bal
                cash_balances.append(f"- **{c['ledgerName']}**: ₹ {bal:,.2f}")
                
            return f"### 💵 Cash in Hand\n\n- **Total Cash Balance**: **₹ {total_balance:,.2f}**\n\n**Accounts:**\n" + "\n".join(cash_balances)

        # 8. Purchase this week
        elif any(kw in msg_lower for kw in ["purchase this week", "purchases this week", "weekly purchase", "weekly purchases"]):
            latest_vch = await self.db["vouchers"].find_one({}, sort=[("dates.date", -1)])
            if not latest_vch:
                return "No transactions found to calculate weekly purchases."
            
            dt = self._get_vch_datetime(latest_vch)
            if not dt:
                return "Could not parse transactions date."
                
            start_of_week = dt - datetime.timedelta(days=dt.weekday())
            start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_week = start_of_week + datetime.timedelta(days=7)
            
            purchase_total = 0.0
            count = 0
            cursor = self.db["vouchers"].find({"voucherTypeName": {"$regex": "^purchase$", "$options": "i"}})
            async for v in cursor:
                v_dt = self._get_vch_datetime(v)
                if v_dt and start_of_week <= v_dt < end_of_week:
                    purchase_total += v.get("totals", {}).get("totalDebit") or 0.0
                    count += 1
                    
            return f"### 🛒 Purchase Summary (for week {start_of_week.strftime('%d-%b-%Y')} to {(end_of_week - datetime.timedelta(seconds=1)).strftime('%d-%b-%Y')})\n\n- **Total Purchases**: **₹ {purchase_total:,.2f}**\n- **Invoices Received**: {count}\n\n*Note: Based on the latest active week in the database.*"

        # 9. All Stock Items List
        elif any(kw in msg_lower for kw in ["all stock item", "all stock items", "stock item list", "stock items list", "item list", "items list", "list of items", "list of item"]):
            cursor = self.db["stockItems"].find({}, {"itemName": 1})
            items = await cursor.to_list(length=1000)
            names = sorted([i["itemName"] for i in items if i.get("itemName")])
            
            rows = []
            for idx, name in enumerate(names):
                rows.append(f"{idx+1}. {name}")
                
            return f"### 📦 All Stock Items ({len(names)} total)\n\n" + "\n".join(rows)

        # 10. All Party / Ledger Names List
        elif any(kw in msg_lower for kw in ["all party", "all parties", "party ledger", "party name", "list of party", "list of parties", "party list", "ledger list", "list of ledgers", "list of ledger", "all ledger", "all ledgers"]):
            cursor = self.db["ledgers"].find({}, {"ledgerName": 1})
            ledgers = await cursor.to_list(length=2000)
            names = sorted([l["ledgerName"] for l in ledgers if l.get("ledgerName")])
            
            rows = []
            for idx, name in enumerate(names):
                rows.append(f"{idx+1}. {name}")
                
            return f"### 👥 All Ledgers / Parties ({len(names)} total)\n\n" + "\n".join(rows)

        return None
