import requests
import pymongo
from bson import ObjectId

def test_update():
    # 1. Inspect before
    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client["finbook_23aafff9731l1z7"]
    
    doc_id = "6a7d7b70922a9946cc0ff5c2"
    doc = db["ledgers_entry"].find_one({"_id": ObjectId(doc_id)})
    if not doc:
        print("Document not found in ledgers_entry!")
        return
        
    print("Address before API update:", doc.get("partyDetails", {}).get("address"))
    
    # 2. Make mock API call
    url = "http://127.0.0.1:5000/api/v2/ledgers"
    headers = {
        "x-company-id": "6a157a2bb9b78aa66ea87159",
        "Content-Type": "application/json"
    }
    
    payload = {
        "_id": doc_id,
        "id": doc_id,
        "sourceCollection": "ledgers_entry",
        "ledgerName": "Acme Private Updated",
        "groupId": "Sundry Debtors",
        "openingBalanceAmount": 15000000.0,
        "openingBalanceType": "Dr",
        "openingBalanceDate": "2026-08-13",
        "status": "Active",
        "isBillWiseOn": True,
        "isCostCentresOn": True,
        "costCenterId": "Mumbai Branch",
        "affectsStock": False,
        "isInterestOn": False,
        "forPayroll": False,
        "isEcommOperator": False,
        "creditPeriod": "30",
        "creditLimit": "100000",
        "partyType": "Customer",
        "contactPerson": "Anjalee Bisen Updated",
        "mobile": "09301449558",
        "phone": "",
        "email": "anjaleebisen@gmail.com",
        "panNumber": "ABCDE123F",
        "address": "New Raisen Road Area",
        "addressLine2": "Indrapuri Sector C",
        "countryId": "India",
        "stateId": "Karnataka (29)",
        "cityId": "Bhopal",
        "pinCode": "434566",
        "gstApplicable": True,
        "gstin": "29ABCDE1234F1Z5",
        "gstRegistrationType": "Regular",
        "gstStateId": "Karnataka (29)",
        "gstTypeOfSupply": "Goods",
        "bankName": "SBI ",
        "branchName": "karnatka",
        "accountNumber": "30123456789",
        "ifscCode": "SBIN0000300",
        "virtualPaymentAddress": "acmer@sbi",
        "paymentFavouring": "Acme Private",
        "notes": "Testing update"
    }
    
    response = requests.post(url, json=payload, headers=headers)
    print("Response status:", response.status_code)
    print("Response body:", response.json())
    
    # 3. Inspect after
    updated_doc = db["ledgers_entry"].find_one({"_id": ObjectId(doc_id)})
    print("Address after API update:", updated_doc.get("partyDetails", {}).get("address"))
    print("add1 after API update:", updated_doc.get("add1"))
    print("add2 after API update:", updated_doc.get("add2"))
    print("city after API update:", updated_doc.get("city"))

if __name__ == "__main__":
    test_update()
