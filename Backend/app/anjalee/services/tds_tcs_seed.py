"""
System Predefined Statutory TDS and TCS Master Data Library & Seeding Service.
Stores standard Income Tax Act statutory TDS/TCS rules centrally with versioning,
effective dates, deductee/buyer type rates, and default PAN penalty rules.
"""

from typing import Dict, Any, List
from datetime import datetime

STATUTORY_TDS_LIBRARY: List[Dict[str, Any]] = [
    {
        "_id": "sys_tds_194c",
        "tdsName": "Payment to Contractors / Sub-Contractors",
        "name": "Payment to Contractors / Sub-Contractors",
        "sectionCode": "194C",
        "section": "194C",
        "legacySectionCode": "194C",
        "statutorySectionMapping": "Section 194C of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm", "AOP / BOI", "Co-operative Society"],
        "ratesByDeducteeType": {
            "Individual/HUF": 1.0,
            "Company Resident": 2.0,
            "Partnership Firm": 2.0,
            "AOP / BOI": 2.0,
            "Co-operative Society": 2.0,
            "default": 2.0
        },
        "applicableRate": 1.0,
        "rate": 1.0,
        "thresholdLimit": 30000.0,
        "threshold": 30000.0,
        "annualAggregateThreshold": 100000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194j_a",
        "tdsName": "Fees for Technical Services / Royalty / Call Centre",
        "name": "Fees for Technical Services / Royalty / Call Centre",
        "sectionCode": "194J(a)",
        "section": "194J(a)",
        "legacySectionCode": "194J",
        "statutorySectionMapping": "Section 194J(1)(ba) of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm", "Non-Resident"],
        "ratesByDeducteeType": {
            "default": 2.0
        },
        "applicableRate": 2.0,
        "rate": 2.0,
        "thresholdLimit": 50000.0,
        "threshold": 50000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194j_b",
        "tdsName": "Professional Fees / Director Remuneration",
        "name": "Professional Fees / Director Remuneration",
        "sectionCode": "194J(b)",
        "section": "194J(b)",
        "legacySectionCode": "194J",
        "statutorySectionMapping": "Section 194J(1)(h) of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm", "Non-Resident"],
        "ratesByDeducteeType": {
            "default": 10.0
        },
        "applicableRate": 10.0,
        "rate": 10.0,
        "thresholdLimit": 50000.0,
        "threshold": 50000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194i_a",
        "tdsName": "Rent on Plant, Machinery & Equipment",
        "name": "Rent on Plant, Machinery & Equipment",
        "sectionCode": "194I(a)",
        "section": "194I(a)",
        "legacySectionCode": "194I",
        "statutorySectionMapping": "Section 194I(a) of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm"],
        "ratesByDeducteeType": {
            "default": 2.0
        },
        "applicableRate": 2.0,
        "rate": 2.0,
        "thresholdLimit": 240000.0,
        "threshold": 240000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194i_b",
        "tdsName": "Rent on Land, Building & Furniture",
        "name": "Rent on Land, Building & Furniture",
        "sectionCode": "194I(b)",
        "section": "194I(b)",
        "legacySectionCode": "194I",
        "statutorySectionMapping": "Section 194I(b) of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm"],
        "ratesByDeducteeType": {
            "default": 10.0
        },
        "applicableRate": 10.0,
        "rate": 10.0,
        "thresholdLimit": 240000.0,
        "threshold": 240000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194h",
        "tdsName": "Commission or Brokerage",
        "name": "Commission or Brokerage",
        "sectionCode": "194H",
        "section": "194H",
        "legacySectionCode": "194H",
        "statutorySectionMapping": "Section 194H of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm"],
        "ratesByDeducteeType": {
            "default": 5.0
        },
        "applicableRate": 5.0,
        "rate": 5.0,
        "thresholdLimit": 15000.0,
        "threshold": 15000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194q",
        "tdsName": "Purchase of Goods (Sec 194Q)",
        "name": "Purchase of Goods (Sec 194Q)",
        "sectionCode": "194Q",
        "section": "194Q",
        "legacySectionCode": "194Q",
        "statutorySectionMapping": "Section 194Q of Income Tax Act 1961",
        "deducteeTypes": ["Company Resident", "Individual/HUF", "Partnership Firm"],
        "ratesByDeducteeType": {
            "default": 0.1
        },
        "applicableRate": 0.1,
        "rate": 0.1,
        "thresholdLimit": 5000000.0,
        "threshold": 5000000.0,
        "defaultPanRules": {"withoutPanRate": 5.0, "section206AA": True},
        "effectiveFrom": "2021-07-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194a",
        "tdsName": "Interest Other Than Securities",
        "name": "Interest Other Than Securities",
        "sectionCode": "194A",
        "section": "194A",
        "legacySectionCode": "194A",
        "statutorySectionMapping": "Section 194A of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm"],
        "ratesByDeducteeType": {
            "default": 10.0
        },
        "applicableRate": 10.0,
        "rate": 10.0,
        "thresholdLimit": 50000.0,
        "threshold": 50000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194n",
        "tdsName": "Cash Withdrawal Exceeding Threshold",
        "name": "Cash Withdrawal Exceeding Threshold",
        "sectionCode": "194N",
        "section": "194N",
        "legacySectionCode": "194N",
        "statutorySectionMapping": "Section 194N of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm"],
        "ratesByDeducteeType": {
            "default": 2.0
        },
        "applicableRate": 2.0,
        "rate": 2.0,
        "thresholdLimit": 10000000.0,
        "threshold": 10000000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2019-09-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_194ia",
        "tdsName": "Transfer of Immovable Property",
        "name": "Transfer of Immovable Property",
        "sectionCode": "194IA",
        "section": "194IA",
        "legacySectionCode": "194IA",
        "statutorySectionMapping": "Section 194IA of Income Tax Act 1961",
        "deducteeTypes": ["Individual/HUF", "Company Resident", "Partnership Firm"],
        "ratesByDeducteeType": {
            "default": 1.0
        },
        "applicableRate": 1.0,
        "rate": 1.0,
        "thresholdLimit": 5000000.0,
        "threshold": 5000000.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2013-06-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    },
    {
        "_id": "sys_tds_195",
        "tdsName": "Other Sums Payable to Non-Resident",
        "name": "Other Sums Payable to Non-Resident",
        "sectionCode": "195",
        "section": "195",
        "legacySectionCode": "195",
        "statutorySectionMapping": "Section 195 of Income Tax Act 1961",
        "deducteeTypes": ["Non-Resident"],
        "ratesByDeducteeType": {
            "default": 20.0
        },
        "applicableRate": 20.0,
        "rate": 20.0,
        "thresholdLimit": 0.0,
        "threshold": 0.0,
        "defaultPanRules": {"withoutPanRate": 20.0, "section206AA": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tds_masters"
    }
]


STATUTORY_TCS_LIBRARY: List[Dict[str, Any]] = [
    {
        "_id": "sys_tcs_206c_1h",
        "tcsName": "Sale of Any Goods (Sec 206C 1H)",
        "name": "Sale of Any Goods (Sec 206C 1H)",
        "sectionCode": "206C(1H)",
        "section": "206C(1H)",
        "legacySectionCode": "206C(1H)",
        "statutorySectionMapping": "Section 206C(1H) of Income Tax Act 1961",
        "buyerTypes": ["Company Resident", "Individual / HUF", "Partnership Firm", "Resident Buyer"],
        "ratesByBuyerType": {
            "default": 0.1
        },
        "applicableRate": 0.1,
        "rate": 0.1,
        "thresholdLimit": 5000000.0,
        "threshold": 5000000.0,
        "defaultPanRules": {"withoutPanRate": 1.0, "section206CC": True},
        "effectiveFrom": "2020-10-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tcs_masters"
    },
    {
        "_id": "sys_tcs_206c_scrap",
        "tcsName": "Scrap Sale",
        "name": "Scrap Sale",
        "sectionCode": "206C(1)",
        "section": "206C(1)",
        "legacySectionCode": "206C",
        "statutorySectionMapping": "Section 206C(1) Scrap Sale of IT Act 1961",
        "buyerTypes": ["Company Resident", "Individual / HUF", "Partnership Firm", "Resident Buyer"],
        "ratesByBuyerType": {
            "default": 1.0
        },
        "applicableRate": 1.0,
        "rate": 1.0,
        "thresholdLimit": 0.0,
        "threshold": 0.0,
        "defaultPanRules": {"withoutPanRate": 5.0, "section206CC": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tcs_masters"
    },
    {
        "_id": "sys_tcs_206c_timber",
        "tcsName": "Timber & Forest Produce",
        "name": "Timber & Forest Produce",
        "sectionCode": "206C(1)",
        "section": "206C(1)",
        "legacySectionCode": "206C",
        "statutorySectionMapping": "Section 206C(1) Timber of IT Act 1961",
        "buyerTypes": ["Company Resident", "Individual / HUF", "Partnership Firm", "Resident Buyer"],
        "ratesByBuyerType": {
            "default": 2.5
        },
        "applicableRate": 2.5,
        "rate": 2.5,
        "thresholdLimit": 0.0,
        "threshold": 0.0,
        "defaultPanRules": {"withoutPanRate": 5.0, "section206CC": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tcs_masters"
    },
    {
        "_id": "sys_tcs_206c_liquor",
        "tcsName": "Alcoholic Liquor for Human Consumption",
        "name": "Alcoholic Liquor for Human Consumption",
        "sectionCode": "206C(1)",
        "section": "206C(1)",
        "legacySectionCode": "206C",
        "statutorySectionMapping": "Section 206C(1) Liquor of IT Act 1961",
        "buyerTypes": ["Company Resident", "Individual / HUF", "Partnership Firm", "Resident Buyer"],
        "ratesByBuyerType": {
            "default": 5.0
        },
        "applicableRate": 5.0,
        "rate": 5.0,
        "thresholdLimit": 0.0,
        "threshold": 0.0,
        "defaultPanRules": {"withoutPanRate": 10.0, "section206CC": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tcs_masters"
    },
    {
        "_id": "sys_tcs_206c_minerals",
        "tcsName": "Minerals (Coal, Lignite, Iron Ore)",
        "name": "Minerals (Coal, Lignite, Iron Ore)",
        "sectionCode": "206C(1)",
        "section": "206C(1)",
        "legacySectionCode": "206C",
        "statutorySectionMapping": "Section 206C(1) Minerals of IT Act 1961",
        "buyerTypes": ["Company Resident", "Individual / HUF", "Partnership Firm", "Resident Buyer"],
        "ratesByBuyerType": {
            "default": 1.0
        },
        "applicableRate": 1.0,
        "rate": 1.0,
        "thresholdLimit": 0.0,
        "threshold": 0.0,
        "defaultPanRules": {"withoutPanRate": 5.0, "section206CC": True},
        "effectiveFrom": "2020-04-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tcs_masters"
    },
    {
        "_id": "sys_tcs_206c_1f",
        "tcsName": "Sale of Motor Vehicles (> ₹10 Lakhs)",
        "name": "Sale of Motor Vehicles (> ₹10 Lakhs)",
        "sectionCode": "206C(1F)",
        "section": "206C(1F)",
        "legacySectionCode": "206C(1F)",
        "statutorySectionMapping": "Section 206C(1F) of IT Act 1961",
        "buyerTypes": ["Company Resident", "Individual / HUF", "Partnership Firm", "Resident Buyer"],
        "ratesByBuyerType": {
            "default": 1.0
        },
        "applicableRate": 1.0,
        "rate": 1.0,
        "thresholdLimit": 1000000.0,
        "threshold": 1000000.0,
        "defaultPanRules": {"withoutPanRate": 5.0, "section206CC": True},
        "effectiveFrom": "2016-06-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tcs_masters"
    },
    {
        "_id": "sys_tcs_206c_1g",
        "tcsName": "Foreign Remittance / Overseas Tour Package (LRS)",
        "name": "Foreign Remittance / Overseas Tour Package (LRS)",
        "sectionCode": "206C(1G)",
        "section": "206C(1G)",
        "legacySectionCode": "206C(1G)",
        "statutorySectionMapping": "Section 206C(1G) of IT Act 1961",
        "buyerTypes": ["Individual / HUF", "Resident Buyer"],
        "ratesByBuyerType": {
            "default": 5.0
        },
        "applicableRate": 5.0,
        "rate": 5.0,
        "thresholdLimit": 700000.0,
        "threshold": 700000.0,
        "defaultPanRules": {"withoutPanRate": 10.0, "section206CC": True},
        "effectiveFrom": "2020-10-01",
        "effectiveTo": "2099-12-31",
        "status": "ACTIVE",
        "version": 1,
        "isSystemPredefined": True,
        "sourceCollection": "system_tcs_masters"
    }
]


def seed_statutory_tds_tcs(db) -> Dict[str, Any]:
    """
    Seeds/upserts the system predefined statutory TDS and TCS library records into MongoDB.
    """
    tds_count = 0
    tcs_count = 0

    try:
        # 1. Upsert TDS Predefined Masters
        tds_coll = db["system_tds_masters"]
        for record in STATUTORY_TDS_LIBRARY:
            now_iso = datetime.now().isoformat()
            record_copy = dict(record)
            record_copy["auditInfo"] = {"createdAt": now_iso, "updatedAt": now_iso, "version": 1}
            tds_coll.update_one(
                {"_id": record["_id"]},
                {"$set": record_copy},
                upsert=True
            )
            tds_count += 1

        # 2. Upsert TCS Predefined Masters
        tcs_coll = db["system_tcs_masters"]
        for record in STATUTORY_TCS_LIBRARY:
            now_iso = datetime.now().isoformat()
            record_copy = dict(record)
            record_copy["auditInfo"] = {"createdAt": now_iso, "updatedAt": now_iso, "version": 1}
            tcs_coll.update_one(
                {"_id": record["_id"]},
                {"$set": record_copy},
                upsert=True
            )
            tcs_count += 1

    except Exception as e:
        print(f"Error seeding statutory TDS/TCS library: {e}")

    return {"seededTds": tds_count, "seededTcs": tcs_count}
