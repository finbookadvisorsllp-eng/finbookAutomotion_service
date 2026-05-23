# Finbook AI-OCR & CSV Technical Implementation

This document provides a technical overview of how the **Sales Module** handles AI-OCR scanning and Bulk CSV imports within the Node.js backend environment.

---

## 1. AI-OCR Workflow (`ocr.service.js`)

The AI-OCR system is designed for high accuracy and seamless integration with the frontend manual form.

### **Tech Stack:**
- **Backend**: Node.js / Express
- **Storage**: **Cloudinary** (Used for secure, persistent storage of invoice PDF/Images).
- **OCR Engine**: Modular design that supports **Google Cloud Vision API** or **AWS Textract**. 
- **Mapping**: Data is mapped to a unified `formFields` object that perfectly matches the React frontend state.

### **Workflow:**
1.  **Upload**: The frontend sends a file to `POST /api/sales/ocr/extract`.
2.  **Storage**: The server streams the file buffer directly to Cloudinary.
3.  **Extraction**: The OCR engine processes the document and extracts key fields:
    -   Invoice Number & Date
    -   Party Name & GSTIN
    -   Line items (Ledger, Description, HSN, Amount)
    -   Tax Totals (CGST, SGST, IGST)
4.  **Autofill**: The server returns the extracted data to the frontend.
5.  **Review**: The React app **auto-fills** the `CreateSales` form. The user reviews/corrects the data.
6.  **Persistence**: On "Save Draft", the transaction is created in MongoDB with a link to the original document in Cloudinary for audit trails.

---

## 2. Bulk CSV Import Workflow (`csv.service.js`)

The CSV engine is built to handle large datasets with real-time validation feedback.

### **Tech Stack:**
- **Parsing**: `csv-parse` (Node.js library) for robust delimiter and quote handling.
- **Validation**: Schema-based validation that checks for:
    -   Required fields (Date, Party, Total)
    -   Data types (Numeric amounts, valid date formats)
    -   Business Logic (GST calculations matching row totals)

### **Workflow:**
1.  **Phase 1: Preview**: 
    -   User uploads a CSV.
    -   The server validates each row but **does not save** to the main collection.
    -   Returns a summary: `Total Rows`, `Valid Rows`, `Failed Rows` with specific error messages for every invalid cell.
2.  **Phase 2: Import**:
    -   Once verified, the server uses **MongoDB Bulk Write** (`insertMany` with `ordered: false`) for maximum performance.
    -   Failed rows are logged in a `CsvImportJob` record for later correction.
3.  **Audit**: Every transaction created via CSV is tagged with a `csvBatchId`, allowing for bulk deletion or status updates if an error is found later.

---

## 3. Workflow States (The State Machine)

All transactions, regardless of entry method (Manual, OCR, CSV), follow a strict lifecycle managed by `sales.service.js`:

| State | Description | Entry Methods |
| :--- | :--- | :--- |
| **Draft** | Initial state. Fully editable. | Manual, OCR, CSV |
| **Pending Review** | Locked for review by a senior accountant. | Push from Draft |
| **Approved** | Financial record finalized. Ready for export. | Approved from Review |
| **Archived** | Historic record. | Post-Approval |

---

## 4. Tally Export (`sales.service.js`)

- **Format**: Tally.ERP 9 / TallyPrime compatible **XML**.
- **Logic**: Iterates through `Approved` transactions and generates `<TALLYMESSAGE>` blocks.
- **Mapping**: Maps internal ledgers to Tally Ledger names (Party Ledger → Party, Sales Ledger → Sales, CGST/SGST → Tax Ledgers).
