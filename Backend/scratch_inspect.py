from pymongo import MongoClient
import os
from datetime import datetime

from app.config import settings
mongo_uri = settings.MONGO_URI
client = MongoClient(mongo_uri)
db_name = settings.DEFAULT_DB_NAME
db = client[db_name]

# 1. Inspect "Sales Bills to Make" ledger
ledger = db["ledgers"].find_one({"ledgerName": "Sales Bills to Make"})
if ledger:
    print("Ledger 'Sales Bills to Make' exists:")
    print("  ID:", ledger.get("_id"))
    print("  Parent Group Name:", ledger.get("parentGroupName"))
    print("  Opening Balance:", ledger.get("openingBalance"))
else:
    print("Ledger 'Sales Bills to Make' NOT found in DB.")

# Let's search ledgers list for any ledger with similar names
print("\nSimilar ledgers:")
for lg in db["ledgers"].find({"ledgerName": {"$regex": "Sales Bills", "$options": "i"}}):
    print(f"  {lg['ledgerName']} -> Group: {lg.get('parentGroupName')}")

# 2. Let's find why "Sales Bills to Make" is missing from Profit & Loss
# Let's trace parentGroupName up to root group
def get_parent_group_path(group_name):
    path = [group_name]
    curr = group_name
    for _ in range(10): # prevent infinite loop
        g = db["groups"].find_one({"groupName": curr})
        if not g or not g.get("parentGroupName"):
            break
        curr = g.get("parentGroupName")
        path.append(curr)
    return path

ledger_to_check = db["ledgers"].find_one({"ledgerName": "Sales Bills to Make"})
if ledger_to_check:
    print("\nParent Group Path for 'Sales Bills to Make':")
    path = get_parent_group_path(ledger_to_check.get("parentGroupName"))
    print("  -> ".join(path))
    # Let's print the nature of each group in path
    for gp_name in path:
        g = db["groups"].find_one({"groupName": gp_name})
        if g:
            print(f"    Group '{gp_name}': nature={g.get('nature')}, behaviour={g.get('behaviour')}")

# 3. Inspect "GST Sales 18%" voucher entries for discrepancy (11,064.50 vs 11,032.00)
# Let's print all vouchers touching "GST Sales 18%" in FY 2025-2026 (or FY 2024-2025? Wait, in Tally the date range is 1-Apr-25 to 31-Mar-36)
# Wait! Let's print all vouchers from 1-Apr-2025 to 31-Mar-2026 touching "GST Sales 18%"
start_dt = datetime(2025, 4, 1)
end_dt = datetime(2026, 3, 31, 23, 59, 59)
print("\nVouchers for 'GST Sales 18%' in period:")
vch_match = {
    "dates.date": {"$gte": start_dt, "$lte": end_dt},
    "ledgerEntries.ledgerName": "GST Sales 18%"
}
vchs = list(db["vouchers"].find(vch_match))
print(f"Found {len(vchs)} vouchers:")
for v in vchs:
    # Find amount for GST Sales 18%
    entry_amt = 0.0
    for e in v.get("ledgerEntries", []):
        if e.get("ledgerName") == "GST Sales 18%":
            entry_amt = float(e.get("amount") or 0)
    print(f"  Voucher: {v.get('voucherNumber')} ({v.get('voucherTypeName')}) on {v.get('dates', {}).get('date')} -> Amount: {entry_amt}")

# 4. Check stock item closing stock discrepancy (24,56,908.07 vs 23,50,740.89)
# Let's check opening stock value and transaction list in DB
print("\nOpening Stock Value:")
from_date = datetime(2025, 4, 1)
to_date = datetime(2026, 3, 31, 23, 59, 59)
# Let's calculate total opening stock value from master stockItems
masters = list(db["stockItems"].find())
open_val_total = 0.0
for m in masters:
    opening = m.get("inventory", {}).get("openingStock", {})
    val = abs(float(opening.get("value") or 0))
    open_val_total += val
print("Total Master Opening Stock Value in DB:", open_val_total)
