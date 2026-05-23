import connectDB from '../src/config/db.js';
import purchaseService from '../src/services/purchase.service.js';
import mongoose from 'mongoose';

const payload = {
  "voucherType": "purchase_invoice",
  "voucherNumberSeries": "Default",
  "voucherDate": "2026-05-19",
  "invoiceDate": "2026-05-19",
  "invoiceNumber": "INV-PURCHASE-001",
  "purchaseLedger": "General Purchase",
  "gstRegistration": "Maharashtra Registration", // 27
  "partyGstin": "23AADCB2230M1Z2", // 23 -> Interstate!
  "partyLedger": "Sundry Creditor A",
  "consigneeLedger": "Same as Party",
  "entryTab": "with_item",
  "productLines": [
    {
      "srNo": 1,
      "stockItem": "Monitor",
      "description": "24 inch LED Monitor",
      "hsnSacCode": "84716060",
      "billQuantity": 10,
      "billRate": 8000,
      "discountPercent": 5, // 80000 - 5% = 76000
      "amount": 76000,
      "rcm": false,
      "taxabilityType": "Taxable",
      "gstRate": 18 // IGST since interstate
    }
  ],
  "purchaseLines": [],
  "additionalCharges": [
    {
      "taxableValue": 0,
      "ledgerName": "Freight Charges",
      "amount": 2000,
      "included": false
    }
  ],
  "tdsDetails": [
    {
      "ledgerName": "TDS on Purchase of Goods",
      "assessableValue": 78000,
      "rate": 0.1,
      "amount": 78
    }
  ],
  "narration": "Purchase Invoice direct API hit.",
  "status": "draft"
};

async function test() {
  await connectDB();
  try {
    const doc = await purchaseService.createTransaction(payload);
    console.log("SUCCESS:", JSON.stringify(doc, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await mongoose.connection.close();
  }
}

test();
