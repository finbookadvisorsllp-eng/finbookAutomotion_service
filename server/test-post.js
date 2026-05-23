import connectDB from './src/config/db.js';
import salesService from './src/services/sales.service.js';
import mongoose from 'mongoose';

const payload = {
  "voucherType": "sales_invoice",
  "voucherNumberSeries": "Default",
  "voucherDate": "2026-05-19",
  "invoiceDate": "2026-05-19",
  "invoiceNumber": "INV-POSTMAN-002",
  "salesLedger": "General Sales",
  "gstRegistration": "Maharashtra Registration",
  "partyGstin": "23AADCB2230M1Z2",
  "partyLedger": "Sundry Debtor B",
  "consigneeLedger": "Same as Party",
  "entryTab": "with_item",
  "productLines": [
    {
      "srNo": 1,
      "stockItem": "Keyboard",
      "description": "Mechanical Wired Keyboard",
      "hsnSacCode": "84716060",
      "billQuantity": 100,
      "billRate": 1000,
      "discountPercent": 0,
      "amount": 100000,
      "rcm": false,
      "taxabilityType": "Taxable",
      "gstRate": 18
    }
  ],
  "salesLines": [],
  "additionalCharges": [],
  "tcsDetails": [
    {
      "ledgerName": "TCS on Sales",
      "assessableValue": 118000,
      "rate": 0.1,
      "amount": 118
    }
  ],
  "narration": "Sales Invoice direct API hit via Postman with TCS.",
  "status": "draft"
};

async function test() {
  await connectDB();
  try {
    const doc = await salesService.createTransaction(payload);
    console.log("SUCCESS:", doc);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await mongoose.connection.close();
  }
}

test();
