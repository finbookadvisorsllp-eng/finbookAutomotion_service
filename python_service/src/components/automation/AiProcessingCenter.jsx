import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Send,
  FileSpreadsheet, Image, ChevronRight, ChevronLeft, RefreshCw, Check,
  Search, Filter, Info, Eye, Edit2, MoreVertical, Plus, X, FolderOpen, Scan,
  SlidersHorizontal, Download, LayoutList, Grid, Database, Calendar, ArrowLeft,
  Settings, CheckCircle, ShieldAlert, Brain, ZoomIn, ZoomOut, Maximize2, Minimize2,
  ChevronDown, ChevronUp, ArrowUpDown, CheckSquare, Square, Trash, ListFilter, PlayCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// --- High-Fidelity Simulated Invoice / Statement Document Canvas ---
function SimulatedInvoicePage({ doc, pageNum, viewType, zoom, pageRef }) {
  const isImage = viewType === 'image';

  // If there is a real uploaded file URL, render it directly!
  if (doc.fileUrl) {
    if (doc.fileType === 'pdf') {
      return (
        <div
          ref={pageRef}
          className="bg-white border border-slate-200 rounded-lg shadow-md shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            width: '210mm',
            minHeight: '297mm',
            zoom: zoom / 100,
            transformOrigin: 'top center'
          }}
        >
          <iframe
            src={doc.fileUrl}
            title={doc.filename}
            className="w-full h-full border-0"
            style={{
              minHeight: '297mm',
            }}
          />
        </div>
      );
    } else {
      return (
        <div
          ref={pageRef}
          className="bg-white border border-slate-200 rounded-lg shadow-md shrink-0 flex items-center justify-center overflow-hidden p-2"
          style={{
            width: '210mm',
            minHeight: '297mm',
            zoom: zoom / 100,
            transformOrigin: 'top center'
          }}
        >
          <img
            src={doc.fileUrl}
            alt={doc.filename}
            className="w-full h-auto max-h-full object-contain"
          />
        </div>
      );
    }
  }

  if (doc.category === 'Bank Statement') {
    return (
      <div
        ref={pageRef}
        className={`bg-white text-slate-800 p-10 border shadow-md font-mono relative shrink-0 transition-transform ${isImage ? 'filter grayscale contrast-125 rotate-[0.1deg] border-slate-350 bg-slate-50' : 'border-slate-200'}`}
        style={{
          width: '210mm',
          minHeight: '297mm',
          zoom: zoom / 100,
          transformOrigin: 'top center'
        }}
      >
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">METROPOLITAN CHARTERED BANK</h1>
            <p className="text-[10px] text-slate-500 font-sans">Corporate Banking Division, Connaught Place, New Delhi</p>
            <p className="text-[9px] text-slate-400 font-sans mt-0.5">IFSC: METR0000827 | MICR: 110240002</p>
          </div>
          <div className="text-right">
            <h2 className="text-base font-extrabold text-slate-800 font-sans">ACCOUNT STATEMENT</h2>
            <p className="text-[10px] font-sans text-slate-600 mt-1">Period: 01-06-2026 to 19-06-2026</p>
            <p className="text-[9px] text-slate-400 font-sans mt-0.5">Page {pageNum} of {doc.pages || 1}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-[11px] mb-6 border border-slate-200 p-3 bg-slate-50">
          <div>
            <p className="text-slate-400 font-sans uppercase text-[8px] font-bold">Account Holder:</p>
            <p className="font-bold text-slate-900">FINBOOK ADVISORS LLP</p>
            <p className="text-slate-600 font-sans">405, Premium Tower, Vijay Nagar</p>
            <p className="text-slate-600 font-sans">Indore, MP - 452010</p>
          </div>
          <div className="text-right font-sans">
            <p className="text-slate-400 uppercase text-[8px] font-bold">Account Summary:</p>
            <p><span className="text-slate-500">Account No:</span> <span className="font-bold font-mono">100928374829</span></p>
            <p><span className="text-slate-500">Account Type:</span> <span className="font-bold font-mono">Current Account</span></p>
            <p><span className="text-slate-500">Currency:</span> <span className="font-bold">INR</span></p>
          </div>
        </div>

        {pageNum === 1 ? (
          <div>
            <table className="w-full text-left text-[11px] border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-600 font-sans uppercase text-[8.5px] font-bold bg-slate-100">
                  <th className="py-2 px-1">Date</th>
                  <th className="py-2 px-1">Particulars / Narration</th>
                  <th className="py-2 px-1 text-center">Chq/Ref</th>
                  <th className="py-2 px-1 text-right">Withdrawal (Dr)</th>
                  <th className="py-2 px-1 text-right">Deposit (Cr)</th>
                  <th className="py-2 px-1 text-right pr-2">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {doc.items && doc.items.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="py-2 px-1 font-sans">{item.date}</td>
                    <td className="py-2 px-1 text-slate-900 font-sans font-medium text-[10.5px] max-w-[200px] truncate" title={item.particulars}>{item.particulars}</td>
                    <td className="py-2 px-1 text-center text-slate-500">{item.chqNo || '—'}</td>
                    <td className="py-2 px-1 text-right font-semibold text-rose-600 font-sans">{item.debit > 0 ? `₹${item.debit.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="py-2 px-1 text-right font-semibold text-emerald-600 font-sans">{item.credit > 0 ? `₹${item.credit.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="py-2 px-1 text-right font-bold pr-2 font-sans">₹{(item.balance || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4 font-sans text-slate-600 text-[11px]">
            <h3 className="font-bold text-slate-800 text-xs font-mono border-b pb-1">RECONCILIATION & STATUTORY NOTICES (Page {pageNum})</h3>
            <p>
              Please examine this statement immediately. Any discrepancy or error should be reported to the bank within 15 days of receipt of statement, failing which it will be assumed that the transactions recorded in the statement are correct.
            </p>
            <p>
              All deposits made via cheque are subject to realization. Service charges have been debited as per standard bank tariff rules. Interest calculations on average daily balance have been credited where applicable.
            </p>
            <div className="border border-slate-200 p-3 rounded-lg bg-slate-50 mt-10">
              <h4 className="font-bold text-slate-700 font-mono text-[9px] mb-2 uppercase">Key Transaction Metrics:</h4>
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="border-r border-slate-200">
                  <p className="text-[8.5px] text-slate-400">Total Dr Count</p>
                  <p className="text-base font-bold text-rose-600">14</p>
                </div>
                <div className="border-r border-slate-200">
                  <p className="text-[8.5px] text-slate-400">Total Cr Count</p>
                  <p className="text-base font-bold text-emerald-600">22</p>
                </div>
                <div>
                  <p className="text-[8.5px] text-slate-400">Uncleared Funds</p>
                  <p className="text-base font-bold text-slate-800">₹0.00</p>
                </div>
              </div>
            </div>
            <div className="mt-24 border-t border-slate-200 pt-10 text-center text-[9px] text-slate-400 font-mono uppercase">
              * This is a computer generated statement and does not require a physical signature. *
            </div>
          </div>
        )}
      </div>
    );
  }

  if (doc.category === 'Payment' || doc.category === 'Receipt') {
    const isPayment = doc.category === 'Payment';
    return (
      <div
        ref={pageRef}
        className={`bg-white text-slate-800 p-10 border shadow-md font-mono relative shrink-0 transition-transform ${isImage ? 'filter grayscale contrast-125 rotate-[-0.1deg] border-slate-350 bg-slate-50' : 'border-slate-200'}`}
        style={{
          width: '210mm',
          minHeight: '297mm',
          zoom: zoom / 100,
          transformOrigin: 'top center'
        }}
      >
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-base font-bold text-slate-900 font-sans">FINBOOK ADVISORS LLP</h1>
            <p className="text-[10px] text-slate-500 font-sans">405, Premium Tower, Vijay Nagar, Indore, MP</p>
            <p className="text-[10px] text-slate-500 font-sans">GSTIN: 23AAFFB1293K1Z4</p>
          </div>
          <div className="text-right border-2 border-slate-900 p-2 bg-slate-50">
            <h2 className="text-sm font-extrabold tracking-widest font-sans">{isPayment ? 'PAYMENT VOUCHER' : 'RECEIPT VOUCHER'}</h2>
            <p className="text-[10px] font-sans mt-0.5">Voucher No: <span className="font-bold">{doc.docNo || 'PAY-001'}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-[11px] mb-8">
          <div>
            <p className="mb-1"><span className="text-slate-500">Date:</span> <span className="font-bold">{doc.docDate || '19-06-2026'}</span></p>
            <p><span className="text-slate-500">{isPayment ? 'Paid To:' : 'Received From:'}</span> <span className="font-bold text-slate-900">{doc.partyLedger || 'ABC Traders'}</span></p>
          </div>
          <div className="text-right">
            <p className="mb-1"><span className="text-slate-500">Bank/Cash A/c:</span> <span className="font-bold">{doc.bankLedger || 'HDFC Bank A/c'}</span></p>
            {doc.refNo && <p><span className="text-slate-500">Cheque/Ref No:</span> <span className="font-bold">{doc.refNo}</span></p>}
          </div>
        </div>

        {pageNum === 1 ? (
          <div className="space-y-6">
            <div className="border border-slate-800 p-4 bg-slate-50">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-600 font-bold uppercase text-[8.5px] pb-2">
                    <th className="text-left">Particulars</th>
                    <th className="text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-4">
                      <p className="font-bold text-slate-900">{isPayment ? 'Payment Account Debit:' : 'Receipt Account Credit:'}</p>
                      <p className="text-slate-500 italic mt-1 font-sans text-[10.5px]">{doc.narration || 'Being amount paid against invoice'}</p>
                    </td>
                    <td className="py-4 text-right font-black text-xs text-slate-900 font-sans">
                      ₹ {(doc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-right text-[8.5px] uppercase">TOTAL VALUE</td>
                    <td className="py-2 text-right font-black text-slate-900 font-sans">
                      ₹ {(doc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-[11px] font-sans">
              <span className="text-slate-400 uppercase text-[8px] font-bold block mb-1">Amount in Words:</span>
              <span className="font-bold text-slate-800 capitalize italic text-[11px]">
                Indian Rupees {(doc.amount || 0).toLocaleString('en-IN')} Only
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-20 font-sans">
              <div>
                <div className="border-b border-slate-400 w-48 h-8" />
                <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">Receiver's Signature</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="border-b border-slate-400 w-48 h-8" />
                <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">Authorized Signatory</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 font-sans text-slate-600 text-[11px]">
            <h3 className="font-bold text-slate-800 text-xs font-mono border-b pb-1">VOUCHER AUDIT LOGS & SUGGESTIONS (Page {pageNum})</h3>
            <p>
              This voucher has been verified against transaction history. Ledger allocations are auto-suggested based on compliance rules.
            </p>
            <div className="border border-slate-200 p-4 rounded-lg bg-slate-50 mt-6 font-mono text-[9.5px] space-y-1">
              <p className="font-bold mb-2">Internal Verification Details:</p>
              <p><span className="text-slate-400">Created By:</span> Admin User</p>
              <p><span className="text-slate-400">Extracted Status:</span> Matches Bank Feed</p>
              <p><span className="text-slate-400">Audit Status:</span> Compliant with Section 194C</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (doc.category === 'Contra') {
    return (
      <div
        ref={pageRef}
        className={`bg-white text-slate-800 p-10 border shadow-md font-mono relative shrink-0 transition-transform ${isImage ? 'filter grayscale contrast-125 rotate-[0.2deg] border-slate-350 bg-slate-50' : 'border-slate-200'}`}
        style={{
          width: '210mm',
          minHeight: '297mm',
          zoom: zoom / 100,
          transformOrigin: 'top center'
        }}
      >
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-base font-bold text-slate-900 font-sans">FINBOOK ADVISORS LLP</h1>
            <p className="text-[10px] text-slate-500 font-sans">Indore, MP, India</p>
          </div>
          <div className="text-right border-2 border-slate-900 p-2 bg-slate-50">
            <h2 className="text-sm font-extrabold tracking-widest font-sans">CONTRA VOUCHER</h2>
            <p className="text-[10px] font-sans mt-0.5">Voucher No: <span className="font-bold">{doc.docNo || 'CON-001'}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-[11px] mb-8">
          <div>
            <p className="mb-1"><span className="text-slate-500">Date:</span> <span className="font-bold">{doc.docDate || '19-06-2026'}</span></p>
            <p><span className="text-slate-500">Source (From):</span> <span className="font-bold text-rose-600">{doc.fromLedger || 'Cash A/c'}</span></p>
          </div>
          <div className="text-right">
            <p className="mb-1"><span className="text-slate-500">Destination (To):</span> <span className="font-bold text-emerald-600">{doc.toLedger || 'State Bank of India'}</span></p>
            <p><span className="text-slate-500">Currency:</span> <span className="font-bold">{doc.currency || 'INR'}</span></p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-slate-800 p-4 bg-slate-50">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-600 font-bold uppercase text-[8.5px] pb-2">
                  <th className="text-left">Particulars</th>
                  <th className="text-right">Debit / Credit Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-4">
                    <p className="font-bold text-slate-900">Transfer from {doc.fromLedger} to {doc.toLedger}</p>
                    <p className="text-slate-400 italic mt-1 font-sans text-[10.5px]">{doc.narration || 'Cash deposit/withdrawal bank entry'}</p>
                  </td>
                  <td className="py-4 text-right font-black text-xs text-slate-900 font-sans">
                    ₹ {(doc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-bold text-right text-[8.5px] uppercase">TOTAL VALUE</td>
                  <td className="py-2 text-right font-black text-slate-900 font-sans">
                    ₹ {(doc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-[11px] font-sans">
            <span className="text-slate-400 uppercase text-[8px] font-bold block mb-1">Amount in Words:</span>
            <span className="font-bold text-slate-800 capitalize italic text-[11px]">
              Rupees {(doc.amount || 0).toLocaleString('en-IN')} Only
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-20 font-sans">
            <div>
              <div className="border-b border-slate-400 w-48 h-8" />
              <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">Prepared By</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="border-b border-slate-400 w-48 h-8" />
              <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">Manager Approval</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isInterState = doc.placeOfSupply && !doc.placeOfSupply.includes("Madhya Pradesh") && !doc.placeOfSupply.includes("23");
  const taxable = doc.taxableAmount || 0;
  const tax = doc.taxAmount || 0;
  const cgst = isInterState ? 0 : tax / 2;
  const sgst = isInterState ? 0 : tax / 2;
  const igst = isInterState ? tax : 0;

  return (
    <div
      ref={pageRef}
      className={`bg-white text-slate-800 p-10 border shadow-md font-mono relative shrink-0 transition-transform ${isImage ? 'filter grayscale contrast-125 rotate-[0.15deg] border-slate-350 bg-slate-50 shadow-inner' : 'border-slate-200'}`}
      style={{
        width: '210mm',
        minHeight: '297mm',
        zoom: zoom / 100,
        transformOrigin: 'top center'
      }}
    >
      {pageNum === 1 ? (
        <div className="flex flex-col justify-between h-full min-h-[265mm]">
          <div>
            <div className="flex justify-between items-start border-b border-slate-300 pb-6 mb-6">
              <div>
                <div className="inline-flex items-center justify-center h-10 w-10 bg-slate-900 text-white font-bold rounded-lg mb-2 text-base font-sans">
                  {doc.vendor ? doc.vendor.charAt(0) : 'V'}
                </div>
                <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase font-sans">{doc.vendor || 'Supplier Company'}</h1>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5 font-sans">102 Business Plaza, Sector 4, Noida, UP - 201301</p>
                <p className="text-[10px] text-slate-500 font-sans">GSTIN: <span className="font-bold font-mono">{doc.gstin || '09AAAAA1111A1Z5'}</span></p>
              </div>

              <div className="text-right">
                <h2 className="text-lg font-black text-slate-900 tracking-wide uppercase font-sans">{doc.category || 'TAX INVOICE'}</h2>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] mt-4 text-left font-sans">
                  <span className="text-slate-400">Invoice No:</span>
                  <span className="font-bold font-mono text-right">{doc.docNo || 'INV-2026-001'}</span>
                  <span className="text-slate-400">Date:</span>
                  <span className="font-bold font-mono text-right">{doc.docDate || '19-06-2026'}</span>
                  {doc.refNo && (
                    <>
                      <span className="text-slate-400">Ref PO No:</span>
                      <span className="font-bold font-mono text-right">{doc.refNo}</span>
                    </>
                  )}
                  {doc.dueDate && (
                    <>
                      <span className="text-slate-400">Due Date:</span>
                      <span className="font-bold font-mono text-right">{doc.dueDate}</span>
                    </>
                  )}
                  <span className="text-slate-400">Place of Supply:</span>
                  <span className="font-bold font-mono text-right">{doc.placeOfSupply || 'Uttar Pradesh (09)'}</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 p-3 mb-6 bg-slate-50">
              <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-sans">Billed To (Recipient):</h3>
              <p className="font-black text-slate-900 text-xs font-sans">FINBOOK ADVISORS LLP</p>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">405, Premium Tower, Vijay Nagar, Indore, Madhya Pradesh - 452010</p>
              <p className="text-[10px] text-slate-600 font-sans">GSTIN: <span className="font-bold font-mono">23AAFFB1293K1Z4</span></p>
            </div>

            <table className="w-full text-left text-[11px] border-collapse font-mono mb-6">
              <thead>
                <tr className="border-b border-slate-800 text-slate-600 font-bold uppercase text-[8.5px] bg-slate-100">
                  <th className="py-2 px-1 w-8 text-center">#</th>
                  <th className="py-2 px-2">Item Description</th>
                  <th className="py-2 px-1 text-center">HSN</th>
                  <th className="py-2 px-1 text-center w-12">Qty</th>
                  <th className="py-2 px-2 text-right w-20">Rate</th>
                  <th className="py-2 px-1 text-center w-12">Tax %</th>
                  <th className="py-2 px-2 text-right w-24 pr-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {doc.items && doc.items.map((item, idx) => {
                  const itemAmt = (item.qty || 0) * (item.rate || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-2 text-slate-900 font-semibold font-sans">{item.name || 'Financial Items'}</td>
                      <td className="py-2 text-center text-slate-500">{item.hsn || '8471'}</td>
                      <td className="py-2 text-center">{item.qty !== undefined ? item.qty : 1}</td>
                      <td className="py-2 px-2 text-right font-sans font-sans">₹{(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 text-center">{item.taxRate !== undefined ? `${item.taxRate}%` : '18%'}</td>
                      <td className="py-2 px-2 text-right font-bold pr-2 font-sans font-sans">₹{itemAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-between items-start pt-4 border-t border-slate-350">
              <div className="text-[9.5px] text-slate-400 max-w-xs font-sans space-y-1">
                <p className="font-bold uppercase text-[8.5px] font-mono text-slate-500">Declaration & Terms:</p>
                <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
              </div>

              <div className="w-80 font-sans text-[11px] space-y-1 text-right font-medium text-slate-600">
                <div className="flex justify-between">
                  <span>Taxable Value (Before Tax)</span>
                  <span className="font-mono font-bold text-slate-800">₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {!isInterState ? (
                  <>
                    <div className="flex justify-between">
                      <span>Central GST (CGST @ 9%)</span>
                      <span className="font-mono font-bold text-slate-800">₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>State GST (SGST @ 9%)</span>
                      <span className="font-mono font-bold text-slate-800">₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>Integrated GST (IGST @ 18%)</span>
                    <span className="font-mono font-bold text-slate-800">₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {doc.roundOff !== 0 && (
                  <div className="flex justify-between">
                    <span>Round Off</span>
                    <span className="font-mono font-bold text-slate-800">₹{(doc.roundOff || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black border-t pt-2 border-slate-800 text-slate-900">
                  <span>GRAND TOTAL</span>
                  <span className="font-mono text-blue-700 font-black text-sm">₹{(doc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end border-t border-slate-200 pt-8 font-sans">
            <div>
              <p className="text-[9.5px] text-slate-400">Total in Words:</p>
              <p className="text-[10px] font-bold italic text-slate-800 mt-1 capitalize font-sans">
                Indian Rupees {doc.amount ? (doc.amount).toLocaleString('en-IN') : 'Zero'} Only
              </p>
            </div>
            <div className="text-right">
              <p className="text-[8.5px] text-slate-400 uppercase font-bold font-sans">For {doc.vendor || 'Supplier Co'}</p>
              <div className="h-8 w-32 border-b border-slate-300 ml-auto my-1.5" />
              <p className="text-[8.5px] text-slate-500 font-bold uppercase font-sans">Authorized Signatory</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 font-sans text-[11px] text-slate-600">
          <h2 className="text-xs font-bold text-slate-800 border-b pb-1 font-mono uppercase">INVOICE ANNEXURE & REMARKS (Page {pageNum} of {doc.pages})</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-700">1. Standard Terms & Conditions:</h3>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-500 text-[10px]">
                <li>Payment is due within 30 days of invoice date. Delayed payments accrue interest at 18% per annum.</li>
                <li>Any disputes regarding quantities or rate discrepancy must be notified in writing within 7 business days of delivery.</li>
                <li>All shipments are FOB Origin unless otherwise specified. Title passes to the buyer upon handoff to the common carrier.</li>
                <li>All transactions are subject to Lucknow/Noida judicial jurisdictions only.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-700">2. Wire Transfer Instructions:</h3>
              <p className="text-slate-500 mt-1 text-[10px]">Please direct electronic payments to the following bank account. Mention Invoice number <b>{doc.docNo}</b> in payment remarks:</p>
              <table className="mt-2 text-[10.5px] font-mono border border-slate-200 p-2 bg-slate-50 rounded">
                <tbody>
                  <tr>
                    <td className="pr-4 text-slate-400">Bank Name:</td>
                    <td className="font-bold text-slate-800">State Bank of India</td>
                  </tr>
                  <tr>
                    <td className="pr-4 text-slate-400">Account Name:</td>
                    <td className="font-bold text-slate-800">{doc.vendor || 'Supplier Company'}</td>
                  </tr>
                  <tr>
                    <td className="pr-4 text-slate-400">Account No:</td>
                    <td className="font-bold text-slate-800">30948291024</td>
                  </tr>
                  <tr>
                    <td className="pr-4 text-slate-400">IFSC Code:</td>
                    <td className="font-bold text-slate-800 font-mono">SBIN0001827</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-28 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400 font-mono">
              <p>Invoice Annexure Ref: ANN-INV-{doc.docNo || '001'}</p>
              <p>Generated: 19-06-2026 10:30 AM</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AiProcessingCenter() {
  const location = useLocation();
  const navigate = useNavigate();
  const passedDocId = location.state?.selectedDocId;

  // --- Mock Database (Synchronized with BulkUploadPanel) ---
  const defaultDocs = [
    {
      id: 'doc-1',
      filename: 'INV-001.pdf',
      fileType: 'pdf',
      category: 'Sales Invoice',
      uploadDate: '19-06-2026 10:30 AM',
      vendor: 'ABC Traders',
      docNo: 'INV-001',
      refNo: 'PO-12345',
      docDate: '19-06-2026',
      dueDate: '19-07-2026',
      partyLedger: 'ABC Traders (Sundry Debtors)',
      salesLedger: 'Sales (18%)',
      gstin: '22AAAAA1111A125',
      currency: 'INR',
      placeOfSupply: 'Madhya Pradesh (23)',
      narration: 'Sales Invoice Against PO-12345',
      items: [
        { id: 1, name: 'Product A', hsn: '8471', qty: 10, rate: 1000.00, taxRate: 18 },
        { id: 2, name: 'Product B', hsn: '8504', qty: 5, rate: 1400.00, taxRate: 18 }
      ],
      taxableAmount: 20060.00,
      taxAmount: 3060.00,
      roundOff: 0.00,
      amount: 23120.00,
      confidence: 98,
      status: 'Approved',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-2',
      filename: 'INV-002.pdf',
      fileType: 'pdf',
      category: 'Sales Invoice',
      uploadDate: '19-06-2026 10:25 AM',
      vendor: 'XYZ Enterprises',
      docNo: 'INV-002',
      refNo: 'PO-56789',
      docDate: '19-06-2026',
      dueDate: '19-07-2026',
      partyLedger: 'XYZ Enterprises (Sundry Debtors)',
      salesLedger: 'Sales (18%)',
      gstin: '22BBBBB2222B2Z6',
      currency: 'INR',
      placeOfSupply: 'Maharashtra (27)',
      narration: 'Sales Invoice Against PO-56789',
      items: [
        { id: 1, name: 'Service Fee', hsn: '9983', qty: 1, rate: 13500.00, taxRate: 18 }
      ],
      taxableAmount: 13500.00,
      taxAmount: 2430.00,
      roundOff: 0.00,
      amount: 15930.00,
      confidence: 96,
      status: 'Pending Approval',
      createdBy: 'Operator 1'
    },
    {
      id: 'doc-3',
      filename: 'Purchase_001.xlsx',
      fileType: 'excel',
      category: 'Purchase Invoice',
      uploadDate: '19-06-2026 10:20 AM',
      vendor: 'PQR Solutions',
      docNo: 'PI-001',
      refNo: 'CH-9081',
      docDate: '18-06-2026',
      dueDate: '18-07-2026',
      partyLedger: 'PQR Solutions (Sundry Creditors)',
      purchaseLedger: 'Purchase (18%)',
      gstin: '22CCCCC3333C3Z7',
      currency: 'INR',
      placeOfSupply: 'Delhi (07)',
      narration: 'Purchase of hardware parts',
      items: [
        { id: 1, name: 'Memory Module 16GB', hsn: '8473', qty: 20, rate: 1900.00, taxRate: 18 },
        { id: 2, name: 'SSD Core 500GB', hsn: '8473', qty: 2, rate: 3800.00, taxRate: 18 }
      ],
      taxableAmount: 38000.00,
      taxAmount: 7680.00,
      roundOff: 0.00,
      amount: 45680.00,
      confidence: 97,
      status: 'Approved',
      createdBy: 'System AI'
    },
    {
      id: 'doc-4',
      filename: 'PAY-001.pdf',
      fileType: 'pdf',
      category: 'Payment',
      uploadDate: '19-06-2026 10:15 AM',
      vendor: 'ABC Traders',
      docNo: 'PAY-001',
      refNo: 'TXN-87612',
      docDate: '19-06-2026',
      partyLedger: 'ABC Traders (Sundry Creditors)',
      bankLedger: 'HDFC Bank A/c',
      amount: 10000.00,
      currency: 'INR',
      narration: 'Paid invoice amount balance',
      items: [],
      confidence: 95,
      status: 'Posted',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-5',
      filename: 'REC-001.pdf',
      fileType: 'pdf',
      category: 'Receipt',
      uploadDate: '19-06-2026 10:10 AM',
      vendor: 'LMN Industries',
      docNo: 'REC-001',
      refNo: 'TXN-90817',
      docDate: '19-06-2026',
      partyLedger: 'LMN Industries (Sundry Debtors)',
      bankLedger: 'SBI Bank A/c',
      amount: 8500.00,
      currency: 'INR',
      narration: 'Received advance payment',
      items: [],
      confidence: 98,
      status: 'Approved',
      createdBy: 'Operator 1'
    },
    {
      id: 'doc-6',
      filename: 'CON-001.pdf',
      fileType: 'pdf',
      category: 'Contra',
      uploadDate: '19-06-2026 10:05 AM',
      vendor: 'Cash Account',
      docNo: 'CON-001',
      docDate: '19-06-2026',
      fromLedger: 'Cash A/c',
      toLedger: 'State Bank of India',
      amount: 12000.00,
      currency: 'INR',
      narration: 'Cash deposited in SBI Bank',
      items: [],
      confidence: 93,
      status: 'Draft',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-8',
      filename: 'CN-001.pdf',
      fileType: 'pdf',
      category: 'Credit Note',
      uploadDate: '19-06-2026 09:55 AM',
      vendor: 'XYZ Enterprises',
      docNo: 'CN-001',
      refNo: 'INV-001',
      docDate: '19-06-2026',
      partyLedger: 'XYZ Enterprises (Sundry Debtors)',
      salesLedger: 'Sales Return',
      gstin: '22BBBBB2222B2Z6',
      amount: 2500.00,
      currency: 'INR',
      narration: 'Credit note for damaged goods refund',
      items: [
        { id: 1, name: 'Product Refund', qty: 1, rate: 2500.00, taxRate: 0 }
      ],
      confidence: 97,
      status: 'Approved',
      createdBy: 'Operator 1'
    },
    {
      id: 'doc-9',
      filename: 'DN-001.pdf',
      fileType: 'pdf',
      category: 'Debit Note',
      uploadDate: '19-06-2026 09:50 AM',
      vendor: 'ABC Traders',
      docNo: 'DN-001',
      refNo: 'PI-001',
      docDate: '18-06-2026',
      partyLedger: 'ABC Traders (Sundry Creditors)',
      purchaseLedger: 'Purchase Return',
      gstin: '22AAAAA1111A1Z5',
      amount: 1250.00,
      currency: 'INR',
      narration: 'Debit note for discount adjustments',
      items: [
        { id: 1, name: 'Price Adjustment', qty: 1, rate: 1250.00, taxRate: 0 }
      ],
      confidence: 80,
      status: 'Failed',
      createdBy: 'System AI'
    },
    {
      id: 'doc-10',
      filename: 'Bank_Stmt_01.xlsx',
      fileType: 'excel',
      category: 'Bank Statement',
      uploadDate: '19-06-2026 09:45 AM',
      vendor: 'State Bank of India',
      docNo: 'BS-001',
      docDate: '19-06-2026',
      amount: 0.00,
      currency: 'INR',
      narration: 'SBI Bank Statement reconciliation',
      items: [
        { id: 1, date: '19-06-2026', particulars: 'NEFT Outward XYZ', chqNo: '—', debit: 15000.00, credit: 0.00, balance: 85000.00 },
        { id: 2, date: '19-06-2026', particulars: 'Interest Credit', chqNo: '—', debit: 0.00, credit: 1250.00, balance: 86250.00 }
      ],
      confidence: 99,
      status: 'Posted',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-11',
      filename: 'INV-003.pdf',
      fileType: 'pdf',
      category: 'Sales Invoice',
      uploadDate: '18-06-2026 04:30 PM',
      vendor: 'XYZ Enterprises',
      docNo: 'INV-003',
      refNo: 'PO-5011',
      docDate: '18-06-2026',
      dueDate: '18-07-2026',
      partyLedger: 'XYZ Enterprises (Sundry Debtors)',
      salesLedger: 'Sales (18%)',
      gstin: '22BBBBB2222B2Z6',
      currency: 'INR',
      placeOfSupply: 'Maharashtra (27)',
      narration: 'Invoice for IT Consultancy services',
      items: [
        { id: 1, name: 'Cloud Migration Consultancy', qty: 10, rate: 4210.00, taxRate: 0 }
      ],
      taxableAmount: 42100.00,
      taxAmount: 0.00,
      roundOff: 0.00,
      amount: 42100.00,
      confidence: 98,
      status: 'Approved',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-12',
      filename: 'Purchase_002.xlsx',
      fileType: 'excel',
      category: 'Purchase Invoice',
      uploadDate: '18-06-2026 02:15 PM',
      vendor: 'PQR Solutions',
      docNo: 'PI-002',
      refNo: 'CH-9098',
      docDate: '17-06-2026',
      dueDate: '17-07-2026',
      partyLedger: 'PQR Solutions (Sundry Creditors)',
      purchaseLedger: 'Purchase (18%)',
      gstin: '22CCCCC3333C3Z7',
      currency: 'INR',
      placeOfSupply: 'Delhi (07)',
      narration: 'Hardware items acquisition',
      items: [
        { id: 1, name: 'LED Monitor 24in', qty: 10, rate: 3412.00, taxRate: 0 }
      ],
      taxableAmount: 34120.00,
      taxAmount: 0.00,
      roundOff: 0.00,
      amount: 34120.00,
      confidence: 95,
      status: 'Pending Approval',
      createdBy: 'Operator 1'
    },
    {
      id: 'doc-13',
      filename: 'PAY-002.pdf',
      fileType: 'pdf',
      category: 'Payment',
      uploadDate: '18-06-2026 01:00 PM',
      vendor: 'LMN Industries',
      docNo: 'PAY-002',
      refNo: 'TXN-0988',
      docDate: '18-06-2026',
      partyLedger: 'LMN Industries (Sundry Creditors)',
      bankLedger: 'SBI Bank A/c',
      amount: 7200.00,
      currency: 'INR',
      narration: 'Office maintenance payout',
      items: [],
      confidence: 96,
      status: 'Posted',
      createdBy: 'System AI'
    },
    {
      id: 'doc-14',
      filename: 'REC-002.pdf',
      fileType: 'pdf',
      category: 'Receipt',
      uploadDate: '18-06-2026 11:30 AM',
      vendor: 'ABC Traders',
      docNo: 'REC-002',
      refNo: 'TXN-9011',
      docDate: '18-06-2026',
      partyLedger: 'ABC Traders (Sundry Debtors)',
      bankLedger: 'HDFC Bank A/c',
      amount: 19500.00,
      currency: 'INR',
      narration: 'Partial payment received',
      items: [],
      confidence: 94,
      status: 'Draft',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-15',
      filename: 'CON-002.pdf',
      fileType: 'pdf',
      category: 'Contra',
      uploadDate: '18-06-2026 10:45 AM',
      vendor: 'State Bank of India',
      docNo: 'CON-002',
      docDate: '18-06-2026',
      fromLedger: 'State Bank of India',
      toLedger: 'Cash A/c',
      amount: 50000.00,
      currency: 'INR',
      narration: 'Cash withdrawal from SBI Bank',
      items: [],
      confidence: 99,
      status: 'Approved',
      createdBy: 'Operator 1'
    }
  ];

  // Load and Sync LocalStorage State
  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem('fb_bulk_documents');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((doc, idx) => {
          let normalizedStatus = doc.status;
          if (doc.status === 'Under Review' || doc.status === 'Draft' || doc.status === 'Ready For Review' || doc.status === 'Pending Approval' || !doc.status) {
            normalizedStatus = 'Pending Approval';
          } else if (doc.status === 'Posted' || doc.status === 'Approved') {
            normalizedStatus = 'Approved';
          } else if (doc.status === 'Failed' || doc.status === 'Rejected') {
            normalizedStatus = 'Rejected';
          } else if (doc.status === 'Processing') {
            normalizedStatus = 'Processing';
          }
          return {
            ...doc,
            pages: doc.pages || (idx % 3 === 0 ? 2 : 1),
            status: normalizedStatus
          };
        });
      } catch (e) {
        console.error('Error loading documents from localStorage', e);
      }
    }
    return defaultDocs;
  });

  const syncDocuments = (updated) => {
    setDocuments(updated);
    localStorage.setItem('fb_bulk_documents', JSON.stringify(updated));
  };

  // --- Component States ---
  const [viewMode, setViewMode] = useState(() => {
    return passedDocId ? 'review' : 'queue';
  });
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeWorkspaceDocId, setActiveWorkspaceDocId] = useState(null);
  const [checkedWorkspaceIds, setCheckedWorkspaceIds] = useState([]); // Selected row IDs in Queue table
  const [activeRightTab, setActiveRightTab] = useState('ai-preview');

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Sorting state
  const [sortColumn, setSortColumn] = useState('uploadDate');
  const [sortDirection, setSortDirection] = useState('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Document Viewer specific states
  const [viewerMode, setViewerMode] = useState('pdf'); // 'pdf' or 'image'
  const [zoom, setZoom] = useState(75);
  const [currentViewerPage, setCurrentViewerPage] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50); // Panel split percent for Left Panel
  const [isDragging, setIsDragging] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('viewer'); // 'viewer' or 'form'
  const [isMobile, setIsMobile] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Sales Invoice');
  const [uploadFiles, setUploadFiles] = useState([]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const containerRef = useRef(null);
  const viewerContainerRef = useRef(null);

  // Simulated background worker for documents in 'Processing' status
  useEffect(() => {
    const processingDocs = documents.filter(d => d.status === 'Processing');
    if (processingDocs.length > 0) {
      const timer = setTimeout(() => {
        const updated = documents.map(d => {
          if (d.status === 'Processing') {
            const randomAmount = parseFloat((Math.random() * 45000 + 5000).toFixed(2));
            const randomDocNo = 'INV-' + Math.floor(Math.random() * 900 + 100);
            
            let partyName = 'ABC Traders';
            let partyLedger = 'ABC Traders (Sundry Debtors)';
            let salesLedger = 'Sales (18%)';
            let purchaseLedger = 'Purchase A/c';
            let fromLedger = 'State Bank of India';
            let toLedger = 'Cash A/c';

            if (d.category === 'Sales Invoice') {
              const names = ['ABC Traders', 'XYZ Enterprises', 'LMN Industries'];
              partyName = names[Math.floor(Math.random() * names.length)];
              partyLedger = `${partyName} (Sundry Debtors)`;
            } else if (d.category === 'Purchase Invoice') {
              const names = ['PQR Solutions', 'Global Suppliers', 'Matrix Corp'];
              partyName = names[Math.floor(Math.random() * names.length)];
              partyLedger = `${partyName} (Sundry Creditors)`;
            } else if (d.category === 'Payment') {
              partyName = 'State Bank of India';
              fromLedger = 'State Bank of India';
              toLedger = 'Cash A/c';
            } else if (d.category === 'Receipt') {
              partyName = 'Cash Account';
              fromLedger = 'Cash A/c';
              toLedger = 'State Bank of India';
            } else if (d.category === 'Contra') {
              partyName = 'HDFC Bank';
              fromLedger = 'State Bank of India';
              toLedger = 'HDFC Bank';
            } else if (d.category === 'Credit Note') {
              partyName = 'ABC Traders';
              partyLedger = 'ABC Traders (Sundry Debtors)';
            } else if (d.category === 'Debit Note') {
              partyName = 'PQR Solutions';
              partyLedger = 'PQR Solutions (Sundry Creditors)';
            }

            return {
              ...d,
              status: 'Pending Approval',
              confidence: Math.floor(Math.random() * 15) + 85,
              vendor: partyName,
              docNo: randomDocNo,
              docDate: '23-06-2026',
              dueDate: '23-07-2026',
              amount: randomAmount,
              partyLedger,
              salesLedger,
              purchaseLedger,
              fromLedger,
              toLedger,
              taxableAmount: parseFloat((randomAmount * 0.85).toFixed(2)),
              taxAmount: parseFloat((randomAmount * 0.15).toFixed(2)),
              roundOff: 0.00,
              items: [
                { id: 1, name: 'AI Consultation & Processing', hsn: '9983', qty: 1, rate: parseFloat((randomAmount * 0.85).toFixed(2)), taxRate: 18 }
              ]
            };
          }
          return d;
        });
        syncDocuments(updated);
        processingDocs.forEach(d => {
          toast.success(`AI Extraction complete for "${d.filename}"!`);
        });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [documents]);

  const handleUploadAndProcess = () => {
    if (uploadFiles.length === 0) return;
    const newDocs = uploadFiles.map((file, idx) => {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const docId = 'doc-' + Date.now() + '-' + idx;
      let fileUrl = '';
      try {
        fileUrl = URL.createObjectURL(file);
      } catch (e) {
        console.error('Error generating blob URL', e);
      }
      return {
        id: docId,
        filename: file.name,
        fileType: isPdf ? 'pdf' : 'image',
        fileUrl: fileUrl,
        category: uploadCategory,
        uploadDate: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).replace(/\//g, '-'),
        vendor: 'Pending OCR...',
        docNo: 'Pending OCR...',
        refNo: '',
        docDate: '',
        dueDate: '',
        partyLedger: '',
        salesLedger: 'Sales A/c',
        purchaseLedger: 'Purchase A/c',
        fromLedger: '',
        toLedger: '',
        gstin: '',
        currency: 'INR',
        placeOfSupply: 'State supplied',
        narration: `Simulated OCR processing for ${file.name}`,
        items: [],
        taxableAmount: 0,
        taxAmount: 0,
        roundOff: 0,
        amount: 0,
        confidence: 0,
        status: 'Processing',
        createdBy: 'Operator 1',
        pages: 1
      };
    });
    const updated = [...newDocs, ...documents];
    syncDocuments(updated);
    toast.success(`Started AI extraction for ${uploadFiles.length} file(s)`);
    setIsUploadModalOpen(false);
    setUploadFiles([]);
  };

  // Categories horizontal navigation tab list
  const tabCategories = [
    'All',
    'Sales Invoice',
    'Purchase Invoice',
    'Payment',
    'Receipt',
    'Contra',
    'Credit Note',
    'Debit Note',
    'Bank Statement'
  ];

  // Draggable Splitter Effect
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.max(25, Math.min(75, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Read Router selection state on mount
  useEffect(() => {
    if (passedDocId) {
      const doc = documents.find(d => d.id === passedDocId);
      if (doc) {
        setActiveWorkspaceDocId(passedDocId);
        setActiveCategory(doc.category);
        setViewMode('review');
      }
    } else if (documents.length > 0 && !activeWorkspaceDocId) {
      setActiveWorkspaceDocId(documents[0].id);
    }
  }, [passedDocId, documents]);

  // Compute active document object
  const activeDoc = useMemo(() => {
    return documents.find(d => d.id === activeWorkspaceDocId) || documents[0];
  }, [documents, activeWorkspaceDocId]);

  // Filtered and Sorted documents for Table Queue & Review Carousel
  const filteredAndSortedDocs = useMemo(() => {
    let result = documents.filter(doc => {
      // Search
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = query === '' ||
        doc.filename?.toLowerCase().includes(query) ||
        doc.vendor?.toLowerCase().includes(query) ||
        doc.docNo?.toLowerCase().includes(query);

      // Category Tab
      const matchesCategoryTab = activeCategory === 'All' || doc.category === activeCategory;

      // Status Filter
      const matchesStatus = statusFilter === 'All' || doc.status === statusFilter;

      return matchesSearch && matchesCategoryTab && matchesStatus;
    });

    // Sorting
    if (sortColumn) {
      result.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (sortColumn === 'amount') {
          valA = parseFloat(valA || 0);
          valB = parseFloat(valB || 0);
        } else if (sortColumn === 'pages') {
          valA = parseInt(valA || 1);
          valB = parseInt(valB || 1);
        } else if (sortColumn === 'confidence') {
          valA = parseInt(valA || 0);
          valB = parseInt(valB || 0);
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [documents, searchQuery, activeCategory, statusFilter, sortColumn, sortDirection]);

  // Paginated docs for table
  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedDocs.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedDocs, currentPage, pageSize]);

  const totalPagesCount = Math.ceil(filteredAndSortedDocs.length / pageSize) || 1;

  // Reset page if filters shrink the count
  useEffect(() => {
    if (currentPage > totalPagesCount) {
      setCurrentPage(1);
    }
  }, [totalPagesCount, currentPage]);

  // Icon mapping helper
  const getDocIcon = (fileType) => {
    if (fileType === 'excel' || fileType === 'csv') {
      return <FileSpreadsheet className="text-emerald-500 shrink-0" size={13} />;
    }
    if (fileType === 'image') {
      return <Image className="text-blue-500 shrink-0" size={13} />;
    }
    return <FileText className="text-blue-500 shrink-0" size={13} />;
  };

  // Field change updates inside forms (persists to localStorage)
  const handleFieldChange = (field, val) => {
    if (!activeDoc) return;
    const updated = documents.map(d => {
      if (d.id === activeDoc.id) {
        const u = { ...d, [field]: val };

        // Recalculate amount if item attributes are changed (for invoice types)
        if (field === 'items') {
          if (activeDoc.category === 'Bank Statement') {
            // bank statement totals are bank ledger reconciliation lists
          } else {
            const taxable = val.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0)), 0);
            const tax = val.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0) * (parseFloat(item.taxRate || 0) / 100)), 0);
            u.taxableAmount = taxable;
            u.taxAmount = tax;
            u.amount = taxable + tax + (parseFloat(u.roundOff || 0));
          }
        }
        return u;
      }
      return d;
    });
    syncDocuments(updated);
  };

  // --- Dynamic Items List helpers ---
  const handleAddItem = () => {
    if (!activeDoc) return;
    const updatedItems = [
      ...(activeDoc.items || []),
      { id: Date.now(), name: 'New Item', qty: 1, rate: 0.00, taxRate: 18 }
    ];
    handleFieldChange('items', updatedItems);
  };

  const handleDeleteItem = (itemId) => {
    if (!activeDoc) return;
    const updatedItems = (activeDoc.items || []).filter(item => item.id !== itemId);
    handleFieldChange('items', updatedItems);
  };

  const handleItemPropertyChange = (itemId, prop, val) => {
    if (!activeDoc) return;
    const updatedItems = (activeDoc.items || []).map(item => {
      if (item.id === itemId) {
        return { ...item, [prop]: val };
      }
      return item;
    });
    handleFieldChange('items', updatedItems);
  };

  // --- Bank Statement transaction additions ---
  const handleAddBankTransaction = () => {
    if (!activeDoc) return;
    const updatedItems = [
      ...(activeDoc.items || []),
      { id: Date.now(), date: '19-06-2026', particulars: 'New TransactionParticulars', chqNo: '—', debit: 0.00, credit: 0.00, balance: 0.00 }
    ];
    handleFieldChange('items', updatedItems);
  };

  // --- Bulk selectors ---
  const handleWorkspaceSelectAll = (e) => {
    if (e.target.checked) {
      setCheckedWorkspaceIds(paginatedDocs.map(d => d.id));
    } else {
      setCheckedWorkspaceIds([]);
    }
  };

  const handleWorkspaceSelectRow = (id) => {
    setCheckedWorkspaceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Page Scroll Snapping inside viewer
  const pageRefs = useRef([]);
  const scrollToPage = (pageNum) => {
    if (pageRefs.current[pageNum]) {
      pageRefs.current[pageNum].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setCurrentViewerPage(pageNum);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(200, prev + 10));
  const handleZoomOut = () => setZoom(prev => Math.max(50, prev - 10));

  const calculateFitWidthZoom = () => {
    if (viewerContainerRef.current) {
      const containerWidth = viewerContainerRef.current.clientWidth;
      const padding = isMobile ? 32 : 48; // p-4 is 16px (32px total), p-6 is 24px (48px total)
      const availableWidth = containerWidth - padding;
      const pageWidthPx = 794; // 210mm in pixels
      const calculatedZoom = Math.floor((availableWidth / pageWidthPx) * 100);
      return Math.max(30, Math.min(200, calculatedZoom));
    }
    return 75;
  };

  const handleFitWidth = () => {
    const fitZoom = calculateFitWidthZoom();
    setZoom(fitZoom);
  };

  // Auto-fit document width when entering review mode, changing document, adjusting split panels, or resizing window
  useEffect(() => {
    if (viewMode === 'review' && activeWorkspaceDocId) {
      const timer = setTimeout(() => {
        handleFitWidth();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewMode, activeWorkspaceDocId, leftWidth, isMobile]);

  useEffect(() => {
    if (viewMode === 'review') {
      const handleWindowResize = () => {
        handleFitWidth();
      };
      window.addEventListener('resize', handleWindowResize);
      return () => window.removeEventListener('resize', handleWindowResize);
    }
  }, [viewMode, activeWorkspaceDocId]);

  const handlePrevPage = () => {
    if (currentViewerPage > 1) {
      scrollToPage(currentViewerPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentViewerPage < (activeDoc?.pages || 1)) {
      scrollToPage(currentViewerPage + 1);
    }
  };

  const handlePrevDoc = () => {
    if (filteredAndSortedDocs.length === 0) return;
    const idx = filteredAndSortedDocs.findIndex(d => d.id === activeDoc.id);
    let nextIdx = idx - 1;
    if (nextIdx < 0) nextIdx = filteredAndSortedDocs.length - 1;
    setActiveWorkspaceDocId(filteredAndSortedDocs[nextIdx].id);
    setCurrentViewerPage(1);
  };

  const handleNextDoc = () => {
    if (filteredAndSortedDocs.length === 0) return;
    const idx = filteredAndSortedDocs.findIndex(d => d.id === activeDoc.id);
    let nextIdx = idx + 1;
    if (nextIdx >= filteredAndSortedDocs.length) nextIdx = 0;
    setActiveWorkspaceDocId(filteredAndSortedDocs[nextIdx].id);
    setCurrentViewerPage(1);
  };

  // --- Action Button triggers ---
  const handleActionApprove = () => {
    if (!activeDoc) return;
    const updated = documents.map(d => d.id === activeDoc.id ? { ...d, status: 'Approved' } : d);
    syncDocuments(updated);
    toast.success(`Approved voucher "${activeDoc.filename}" successfully`);
  };

  const handleActionReject = () => {
    if (!activeDoc) return;
    const updated = documents.map(d => d.id === activeDoc.id ? { ...d, status: 'Rejected' } : d);
    syncDocuments(updated);
    toast.error(`Rejected voucher "${activeDoc.filename}" successfully`);
  };

  const handleActionPushToTally = () => {
    if (!activeDoc) return;
    const updated = documents.map(d => d.id === activeDoc.id ? { ...d, status: 'Approved' } : d); // Match approved status
    syncDocuments(updated);
    toast.success(`Voucher "${activeDoc.filename}" posted to Tally server!`);
  };

  const handleActionSaveDraft = () => {
    if (!activeDoc) return;
    toast.success(`Saved draft of "${activeDoc.filename}"`);
  };

  // --- Dynamic Styles ---
  const getCategoryStyles = (cat) => {
    const stylesMap = {
      'Sales Invoice': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/15 dark:text-emerald-400 dark:border-emerald-800',
      'Purchase Invoice': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/15 dark:text-blue-400 dark:border-blue-800',
      'Payment': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/15 dark:text-amber-400 dark:border-amber-800',
      'Receipt': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/15 dark:text-teal-400 dark:border-teal-800',
      'Contra': 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800',
      'Credit Note': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/15 dark:text-sky-400 dark:border-sky-800',
      'Debit Note': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/15 dark:text-red-400 dark:border-red-800',
      'Bank Statement': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/15 dark:text-indigo-400 dark:border-indigo-800'
    };
    return stylesMap[cat] || 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full overflow-hidden text-[11px] text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-950/10 ${viewMode === 'queue' ? 'gap-2' : 'gap-0'}`}
    >
      {viewMode === 'queue' ? (
        // ==========================================
        // STEP 1: DOCUMENT QUEUE TABLE VIEW
        // ==========================================
        <div className="flex flex-col gap-3 flex-grow p-4 overflow-hidden">

          {/* Title Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2 border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Brain className="text-blue-500" size={16} />
                <span>OCR Upload</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded text-[9.5px] font-extrabold uppercase">
                  Document Queue
                </span>
              </h2>
              <p className="text-slate-400 dark:text-slate-500 text-[10px] mt-0.5 font-medium">Verify and approve automatically extracted accounting documents.</p>
            </div>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-1.5 font-bold shadow-xs text-[11px] cursor-pointer"
            >
              <UploadCloud size={13} />
              <span>Upload Documents</span>
            </button>
          </div>

          {/* --- TOP TABS CATEGORIES NAVIGATION BAR --- */}
          <div className="flex items-center gap-4.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0 pb-1.5 pt-0.5">
            {tabCategories.map((catName) => {
              const isActive = activeCategory === catName;
              return (
                <button
                  key={catName}
                  onClick={() => {
                    setActiveCategory(catName);
                    setCurrentPage(1);
                  }}
                  className={`pb-1 text-[11px] font-bold tracking-wide whitespace-nowrap transition-all uppercase border-b-2 -mb-2 flex items-center gap-1.5 ${
                    isActive
                      ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <span>{catName}</span>
                </button>
              );
            })}
          </div>

          {/* Table Toolbar controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-3xs shrink-0">
            {/* Search and Filters */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search document, party, invoice no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 rounded-lg border pl-8 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <ListFilter size={13} className="text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                >
                  <option value="All">All Statuses</option>
                  <option value="Processing">Processing</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Selection Info and Bulk Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {filteredAndSortedDocs.length} Total Documents
              </span>

              {checkedWorkspaceIds.length > 0 && (
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-2 py-1 rounded-lg">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 mr-2">{checkedWorkspaceIds.length} Selected</span>

                  <button
                    onClick={() => {
                      const updated = documents.map(d => checkedWorkspaceIds.includes(d.id) ? { ...d, status: 'Approved' } : d);
                      syncDocuments(updated);
                      setCheckedWorkspaceIds([]);
                      toast.success(`Approved ${checkedWorkspaceIds.length} vouchers successfully`);
                    }}
                    className="h-6 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1"
                  >
                    <Check size={10} />
                    <span>Approve</span>
                  </button>

                  <button
                    onClick={() => {
                      const updated = documents.map(d => checkedWorkspaceIds.includes(d.id) ? { ...d, status: 'Rejected' } : d);
                      syncDocuments(updated);
                      setCheckedWorkspaceIds([]);
                      toast.error(`Rejected ${checkedWorkspaceIds.length} vouchers`);
                    }}
                    className="h-6 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold flex items-center gap-1"
                  >
                    <X size={10} />
                    <span>Reject</span>
                  </button>

                  <button
                    onClick={() => {
                      const updated = documents.filter(d => !checkedWorkspaceIds.includes(d.id));
                      syncDocuments(updated);
                      setCheckedWorkspaceIds([]);
                      toast.success(`Deleted selected documents`);
                    }}
                    className="h-6 px-2 bg-slate-600 hover:bg-slate-700 text-white rounded text-[10px] font-bold flex items-center gap-1"
                  >
                    <Trash size={10} />
                    <span>Delete</span>
                  </button>

                  <button
                    onClick={() => setCheckedWorkspaceIds([])}
                    className="text-slate-400 hover:text-slate-600 text-[10px] font-bold ml-1"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-grow border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-3xs flex flex-col">
            <div className="flex-grow overflow-auto">
              <table className="w-full text-left border-collapse text-[11px] min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 font-bold uppercase select-none sticky top-0 z-10">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-350 dark:border-slate-750 text-blue-600 cursor-pointer h-3.5 w-3.5"
                        checked={paginatedDocs.length > 0 && paginatedDocs.every(d => checkedWorkspaceIds.includes(d.id))}
                        onChange={handleWorkspaceSelectAll}
                      />
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('filename')}>
                      <div className="flex items-center gap-1">
                        <span>Document Name</span>
                        <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('category')}>
                      <div className="flex items-center gap-1">
                        <span>Document Type</span>
                        <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-center" onClick={() => handleSort('pages')}>
                      <div className="flex items-center gap-1 justify-center">
                        <span>Pages</span>
                        <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('uploadDate')}>
                      <div className="flex items-center gap-1">
                        <span>Upload Date</span>
                        <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('vendor')}>
                      <div className="flex items-center gap-1">
                        <span>Party Name</span>
                        <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('docNo')}>
                      <div className="flex items-center gap-1">
                        <span>Invoice Number</span>
                        <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-right" onClick={() => handleSort('amount')}>
                      <div className="flex items-center gap-1 justify-end">
                        <span>Amount</span>
                        <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-center" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1 justify-center">
                        <span>Status</span>
                        <ArrowUpDown size={10} />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800/80">
                  {paginatedDocs.length > 0 ? (
                    paginatedDocs.map((doc) => {
                      const isChecked = checkedWorkspaceIds.includes(doc.id);
                      return (
                        <tr
                          key={doc.id}
                          onClick={() => {
                            setActiveWorkspaceDocId(doc.id);
                            setViewMode('review');
                          }}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-slate-350 dark:border-slate-750 text-blue-600 cursor-pointer h-3.5 w-3.5"
                              checked={isChecked}
                              onChange={() => handleWorkspaceSelectRow(doc.id)}
                            />
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-150">
                            <div className="flex items-center gap-2">
                              {getDocIcon(doc.fileType)}
                              <span title={doc.filename}>{doc.filename}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase border ${getCategoryStyles(doc.category)}`}>
                              {doc.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold">{doc.pages || 1} {doc.pages === 1 ? 'Page' : 'Pages'}</td>
                          <td className="py-3 px-3 font-semibold text-slate-400 dark:text-slate-500">{doc.uploadDate}</td>
                          <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={doc.vendor}>
                            {doc.vendor || '—'}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold">{doc.docNo || '—'}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                            ₹ {(doc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${
                              doc.status === 'Approved' ? 'bg-green-50/70 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-400' :
                              doc.status === 'Rejected' ? 'bg-red-50/70 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400' :
                              doc.status === 'Processing' ? 'bg-amber-50/70 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400 animate-pulse' :
                              'bg-blue-50/70 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-400'
                            }`}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setActiveWorkspaceDocId(doc.id);
                                setViewMode('review');
                              }}
                              className="p-1 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-blue-600 dark:text-blue-400 transition"
                              title="Review Document"
                            >
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500 font-semibold">
                        No documents match the filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 border rounded px-2 outline-none text-[10.5px] bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-850 font-bold"
                >
                  <option value={5}>5 Rows</option>
                  <option value={10}>10 Rows</option>
                  <option value={25}>25 Rows</option>
                  <option value={50}>50 Rows</option>
                </select>
              </div>

              <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                Showing {filteredAndSortedDocs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredAndSortedDocs.length)} of {filteredAndSortedDocs.length} documents
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-7 w-7 border rounded flex items-center justify-center bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: totalPagesCount }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 w-7 rounded flex items-center justify-center font-bold text-[10.5px] border transition ${
                      currentPage === pageNum
                        ? 'bg-blue-600 border-blue-600 text-white shadow-3xs'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPagesCount}
                  onClick={() => setCurrentPage(prev => Math.min(totalPagesCount, prev + 1))}
                  className="h-7 w-7 border rounded flex items-center justify-center bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ==========================================
        // STEP 2: OPEN REVIEW WORKSPACE VIEW
        // ==========================================
        activeDoc ? (
          <div className="flex flex-col flex-grow overflow-hidden select-none">

            {/* Top Review Header Toolbar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 px-4 py-2 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('queue')}
                  className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center bg-white dark:bg-slate-900 font-bold gap-1 text-[11px]"
                  title="Back to Document Listing"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Queue</span>
                </button>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[12px] text-slate-900 dark:text-white truncate max-w-[200px]" title={activeDoc.filename}>
                      {activeDoc.filename}
                    </h3>
                    <span className={`px-2 py-0.2 rounded-full text-[8.5px] font-black border uppercase tracking-wider ${
                      activeDoc.status === 'Approved' ? 'bg-green-50/70 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-900 dark:text-green-400' :
                      activeDoc.status === 'Rejected' ? 'bg-red-50/70 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400' :
                      activeDoc.status === 'Processing' ? 'bg-amber-50/70 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400 animate-pulse' :
                      'bg-blue-50/70 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-400'
                    }`}>
                      {activeDoc.status}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-slate-400 font-bold mt-0.5 flex items-center gap-1.5 font-sans">
                    <span>{activeDoc.category}</span>
                    <span>•</span>
                    <span>{activeDoc.pages || 1} {activeDoc.pages === 1 ? 'Page' : 'Pages'}</span>
                    <span>•</span>
                    <span>Uploaded: {activeDoc.uploadDate}</span>
                  </div>
                </div>
              </div>

              {/* Actions Header Bar */}
              <div className="flex items-center gap-2">
                {/* Carousel controls */}
                <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 mr-1.5">
                  <button
                    onClick={handlePrevDoc}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 transition"
                    title="Previous Document"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-[9px] font-bold text-slate-400 px-1 font-mono">
                    {filteredAndSortedDocs.findIndex(d => d.id === activeDoc.id) + 1} / {filteredAndSortedDocs.length}
                  </span>
                  <button
                    onClick={handleNextDoc}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 transition"
                    title="Next Document"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

                <button
                  onClick={handleActionSaveDraft}
                  className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition font-bold shadow-3xs text-[11px]"
                >
                  Save Draft
                </button>

                <button
                  onClick={() => toast.loading('Re-extracting details with AI OCR engines...')}
                  className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition font-bold shadow-3xs text-[11px]"
                >
                  Reprocess OCR
                </button>

                <button
                  onClick={handleActionReject}
                  className="h-8.5 px-3 border border-rose-200 hover:bg-rose-50 hover:text-rose-700 bg-white text-rose-600 dark:bg-slate-900 dark:border-rose-900/60 dark:hover:bg-rose-950/20 dark:text-rose-400 rounded-lg transition font-bold shadow-3xs text-[11px]"
                >
                  Reject Voucher
                </button>

                <button
                  onClick={handleActionApprove}
                  className="h-8.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1.5 font-bold shadow-xs text-[11px]"
                >
                  <Check size={13} />
                  <span>Approve</span>
                </button>

                <button
                  onClick={handleActionPushToTally}
                  className="h-8.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1.5 font-bold shadow-xs text-[11px]"
                >
                  <Send size={13} />
                  <span>Push to Tally</span>
                </button>
              </div>
            </div>

            {/* Mobile Workspace Toggle Tabs */}
            <div className="flex md:hidden border-b border-slate-200 bg-slate-100 dark:bg-slate-900 dark:border-slate-800 p-1 shrink-0">
              <button
                onClick={() => setActiveMobileTab('viewer')}
                className={`flex-1 py-1.5 text-center font-bold rounded-lg text-xs transition ${
                  activeMobileTab === 'viewer'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-3xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Document Viewer
              </button>
              <button
                onClick={() => setActiveMobileTab('form')}
                className={`flex-1 py-1.5 text-center font-bold rounded-lg text-xs transition ${
                  activeMobileTab === 'form'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-3xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Accounting Form
              </button>
            </div>

            {/* Main Side-by-Side Content Workspace */}
            <div className="flex-grow flex items-stretch overflow-hidden relative">

              {/* --- LEFT SIDE: Document Viewer --- */}
              <div
                className="flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden"
                style={{
                  width: isMobile ? '100%' : `${leftWidth}%`,
                  display: isMobile ? (activeMobileTab === 'viewer' ? 'flex' : 'none') : 'flex',
                }}
              >
                {/* Document Viewer Toolbar */}
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 px-3 py-1.5 flex items-center justify-between gap-3 shrink-0 text-[10px] font-sans">
                  {/* PDF/Image toggles */}
                  <div className="flex bg-slate-200 dark:bg-slate-850 p-0.5 rounded-lg border border-slate-300 dark:border-slate-800">
                    <button
                      onClick={() => setViewerMode('pdf')}
                      className={`px-2.5 py-1 rounded font-extrabold transition-all uppercase tracking-wider ${
                        viewerMode === 'pdf'
                          ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-3xs'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      PDF View
                    </button>
                    <button
                      onClick={() => setViewerMode('image')}
                      className={`px-2.5 py-1 rounded font-extrabold transition-all uppercase tracking-wider ${
                        viewerMode === 'image'
                          ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-3xs'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      Image View
                    </button>
                  </div>

                  {/* Zoom controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleZoomOut}
                      className="h-6 w-6 border border-slate-200 dark:border-slate-850 rounded bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center font-bold"
                      title="Zoom Out"
                    >
                      <ZoomOut size={11} />
                    </button>
                    <span className="w-12 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                      {zoom}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="h-6 w-6 border border-slate-200 dark:border-slate-850 rounded bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center font-bold"
                      title="Zoom In"
                    >
                      <ZoomIn size={11} />
                    </button>
                    <button
                      onClick={handleFitWidth}
                      className="h-6 px-2 border border-slate-200 dark:border-slate-850 rounded bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center font-bold"
                      title="Fit Width"
                    >
                      Fit Width
                    </button>
                  </div>

                  {/* Pages controls */}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentViewerPage === 1}
                      onClick={handlePrevPage}
                      className="h-6 w-6 border border-slate-200 dark:border-slate-850 rounded bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"
                      title="Previous Page"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span className="font-bold text-slate-600 dark:text-slate-300 font-mono">
                      Page {currentViewerPage} of {activeDoc.pages || 1}
                    </span>
                    <button
                      disabled={currentViewerPage === (activeDoc.pages || 1)}
                      onClick={handleNextPage}
                      className="h-6 w-6 border border-slate-200 dark:border-slate-850 rounded bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center"
                      title="Next Page"
                    >
                      <ChevronRight size={12} />
                    </button>

                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

                    <button
                      onClick={() => setIsFullScreen(true)}
                      className="h-6 w-6 border border-slate-200 dark:border-slate-850 rounded bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center"
                      title="Full Screen Mode"
                    >
                      <Maximize2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Simulated Paper Canvas */}
                <div
                  ref={viewerContainerRef}
                  className="flex-grow overflow-auto p-4 md:p-6 flex flex-col items-center gap-4 scroll-smooth select-none bg-slate-200/60 dark:bg-slate-900/40 relative themed-scrollbar"
                  onScroll={(e) => {
                    // Update active page based on scroll position of pages
                    const scrollTop = e.currentTarget.scrollTop;
                    const pageHeight = 1000; // rough estimation
                    const pageIndex = Math.floor((scrollTop + pageHeight/2) / pageHeight) + 1;
                    const clamped = Math.max(1, Math.min(activeDoc.pages || 1, pageIndex));
                    if (clamped !== currentViewerPage) {
                      setCurrentViewerPage(clamped);
                    }
                  }}
                >
                  {Array.from({ length: activeDoc.pages || 1 }, (_, i) => i + 1).map((pageNum) => (
                    <SimulatedInvoicePage
                      key={pageNum}
                      doc={activeDoc}
                      pageNum={pageNum}
                      viewType={viewerMode}
                      zoom={zoom}
                      pageRef={(el) => (pageRefs.current[pageNum] = el)}
                    />
                  ))}
                </div>
              </div>

              {/* --- RESIZABLE DRAG SPLITTER (Tablet Resizing) --- */}
              <div
                onMouseDown={handleMouseDown}
                className="hidden md:block w-1.5 shrink-0 bg-slate-200 dark:bg-slate-800 hover:bg-blue-500 dark:hover:bg-blue-600 cursor-col-resize select-none transition-colors duration-150 h-full relative z-30"
              />
              <div
                className="flex flex-col bg-white dark:bg-slate-900 p-4 flex-grow overflow-hidden relative z-10"
                style={{
                  width: isMobile ? '100%' : `${100 - leftWidth}%`,
                  display: isMobile ? (activeMobileTab === 'form' ? 'flex' : 'none') : 'flex',
                }}
              >
                <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100 dark:border-slate-800 shrink-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{activeDoc.category} Entry Form</span>
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800 rounded text-[9.5px] font-extrabold uppercase">
                      AI Extracted
                    </span>
                  </h3>
                  <div className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 flex items-center gap-1 font-bold text-[10px] text-emerald-700">
                    <CheckCircle2 size={11} />
                    <span>Score {activeDoc.confidence}%</span>
                  </div>
                </div>

                <div className="flex-grow overflow-y-auto pr-1">
                  {/* Voucher Category Form Switcher */}
                  <div className="space-y-3.5 pr-1 font-sans">

                    {/* CATEGORY 1: SALES INVOICE & CREDIT NOTE FORM */}
                    {(activeDoc.category === 'Sales Invoice' || activeDoc.category === 'Credit Note') && (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Invoice No. *</label>
                            <input
                              type="text"
                              value={activeDoc.docNo || ''}
                              onChange={(e) => handleFieldChange('docNo', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Reference No.</label>
                            <input
                              type="text"
                              value={activeDoc.refNo || ''}
                              onChange={(e) => handleFieldChange('refNo', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Invoice Date *</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={activeDoc.docDate || ''}
                                onChange={(e) => handleFieldChange('docDate', e.target.value)}
                                className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                              />
                              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Due Date</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={activeDoc.dueDate || ''}
                                onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                                className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                              />
                              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Party Ledger *</label>
                            <div className="flex items-center gap-1">
                              <select
                                value={activeDoc.partyLedger || ''}
                                onChange={(e) => handleFieldChange('partyLedger', e.target.value)}
                                className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                              >
                                <option value="ABC Traders (Sundry Debtors)">ABC Traders (Sundry Debtors)</option>
                                <option value="XYZ Enterprises (Sundry Debtors)">XYZ Enterprises (Sundry Debtors)</option>
                                <option value="LMN Industries (Sundry Debtors)">LMN Industries (Sundry Debtors)</option>
                              </select>
                              <button type="button" onClick={() => toast.info('Add new Ledger account')} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Sales Ledger *</label>
                            <div className="flex items-center gap-1">
                              <select
                                value={activeDoc.salesLedger || ''}
                                onChange={(e) => handleFieldChange('salesLedger', e.target.value)}
                                className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                              >
                                <option value="Sales (18%)">Sales (18%)</option>
                                <option value="Sales Return">Sales Return</option>
                                <option value="General Income">General Income</option>
                              </select>
                              <button type="button" onClick={() => toast.info('Add new Ledger account')} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">GSTIN</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={activeDoc.gstin || ''}
                                onChange={(e) => handleFieldChange('gstin', e.target.value)}
                                className="w-full h-8 rounded-lg border pl-3 pr-14 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-mono font-bold"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.2 rounded border border-emerald-100/50">
                                ✓ Valid
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Currency</label>
                            <input
                              type="text"
                              value={activeDoc.currency || 'INR'}
                              onChange={(e) => handleFieldChange('currency', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Place of Supply</label>
                            <select
                              value={activeDoc.placeOfSupply || ''}
                              onChange={(e) => handleFieldChange('placeOfSupply', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            >
                              <option value="Madhya Pradesh (23)">Madhya Pradesh (23)</option>
                              <option value="Maharashtra (27)">Maharashtra (27)</option>
                              <option value="Delhi (07)">Delhi (07)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Narration</label>
                            <input
                              type="text"
                              value={activeDoc.narration || ''}
                              onChange={(e) => handleFieldChange('narration', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CATEGORY 2: PURCHASE INVOICE & DEBIT NOTE FORM */}
                    {(activeDoc.category === 'Purchase Invoice' || activeDoc.category === 'Debit Note') && (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Purchase Invoice No. *</label>
                            <input
                              type="text"
                              value={activeDoc.docNo || ''}
                              onChange={(e) => handleFieldChange('docNo', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Reference No.</label>
                            <input
                              type="text"
                              value={activeDoc.refNo || ''}
                              onChange={(e) => handleFieldChange('refNo', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Purchase Date *</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={activeDoc.docDate || ''}
                                onChange={(e) => handleFieldChange('docDate', e.target.value)}
                                className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                              />
                              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Due Date</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={activeDoc.dueDate || ''}
                                onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                                className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                              />
                              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Party Ledger (Supplier) *</label>
                            <div className="flex items-center gap-1">
                              <select
                                value={activeDoc.partyLedger || ''}
                                onChange={(e) => handleFieldChange('partyLedger', e.target.value)}
                                className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                              >
                                <option value="PQR Solutions (Sundry Creditors)">PQR Solutions (Sundry Creditors)</option>
                                <option value="ABC Traders (Sundry Creditors)">ABC Traders (Sundry Creditors)</option>
                                <option value="XYZ Enterprises (Sundry Creditors)">XYZ Enterprises (Sundry Creditors)</option>
                              </select>
                              <button type="button" onClick={() => toast.info('Add new Ledger account')} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Purchase Ledger *</label>
                            <div className="flex items-center gap-1">
                              <select
                                value={activeDoc.purchaseLedger || ''}
                                onChange={(e) => handleFieldChange('purchaseLedger', e.target.value)}
                                className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                              >
                                <option value="Purchase (18%)">Purchase (18%)</option>
                                <option value="Purchase Return">Purchase Return</option>
                                <option value="General Expenses">General Expenses</option>
                              </select>
                              <button type="button" onClick={() => toast.info('Add new Ledger account')} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Supplier GSTIN</label>
                            <input
                              type="text"
                              value={activeDoc.gstin || ''}
                              onChange={(e) => handleFieldChange('gstin', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Currency</label>
                            <input
                              type="text"
                              value={activeDoc.currency || 'INR'}
                              onChange={(e) => handleFieldChange('currency', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Narration</label>
                          <input
                            type="text"
                            value={activeDoc.narration || ''}
                            onChange={(e) => handleFieldChange('narration', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* CATEGORY 3: PAYMENT / RECEIPT VOUCHERS FORM */}
                    {(activeDoc.category === 'Payment' || activeDoc.category === 'Receipt') && (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Voucher No. *</label>
                            <input
                              type="text"
                              value={activeDoc.docNo || ''}
                              onChange={(e) => handleFieldChange('docNo', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Ref/Txn No.</label>
                            <input
                              type="text"
                              value={activeDoc.refNo || ''}
                              onChange={(e) => handleFieldChange('refNo', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Voucher Date *</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={activeDoc.docDate || ''}
                                onChange={(e) => handleFieldChange('docDate', e.target.value)}
                                className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                              />
                              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Currency</label>
                            <input
                              type="text"
                              value={activeDoc.currency || 'INR'}
                              onChange={(e) => handleFieldChange('currency', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Party Ledger *</label>
                            <select
                              value={activeDoc.partyLedger || ''}
                              onChange={(e) => handleFieldChange('partyLedger', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            >
                              <option value="ABC Traders (Sundry Creditors)">ABC Traders (Sundry Creditors)</option>
                              <option value="LMN Industries (Sundry Debtors)">LMN Industries (Sundry Debtors)</option>
                              <option value="XYZ Enterprises (Sundry Debtors)">XYZ Enterprises (Sundry Debtors)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Bank / Cash Ledger *</label>
                            <select
                              value={activeDoc.bankLedger || ''}
                              onChange={(e) => handleFieldChange('bankLedger', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            >
                              <option value="HDFC Bank A/c">HDFC Bank A/c</option>
                              <option value="SBI Bank A/c">SBI Bank A/c</option>
                              <option value="Cash A/c">Cash A/c</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Amount (₹) *</label>
                            <input
                              type="number"
                              value={activeDoc.amount || 0}
                              onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Narration</label>
                            <input
                              type="text"
                              value={activeDoc.narration || ''}
                              onChange={(e) => handleFieldChange('narration', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CATEGORY 4: CONTRA VOUCHERS FORM */}
                    {activeDoc.category === 'Contra' && (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Contra Voucher No. *</label>
                            <input
                              type="text"
                              value={activeDoc.docNo || ''}
                              onChange={(e) => handleFieldChange('docNo', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Voucher Date</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={activeDoc.docDate || ''}
                                onChange={(e) => handleFieldChange('docDate', e.target.value)}
                                className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                              />
                              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">From Account (Source) *</label>
                            <select
                              value={activeDoc.fromLedger || ''}
                              onChange={(e) => handleFieldChange('fromLedger', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            >
                              <option value="Cash A/c">Cash A/c</option>
                              <option value="State Bank of India">State Bank of India</option>
                              <option value="HDFC Bank A/c">HDFC Bank A/c</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">To Account (Destination) *</label>
                            <select
                              value={activeDoc.toLedger || ''}
                              onChange={(e) => handleFieldChange('toLedger', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            >
                              <option value="State Bank of India">State Bank of India</option>
                              <option value="Cash A/c">Cash A/c</option>
                              <option value="HDFC Bank A/c">HDFC Bank A/c</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Amount (₹) *</label>
                            <input
                              type="number"
                              value={activeDoc.amount || 0}
                              onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Narration</label>
                            <input
                              type="text"
                              value={activeDoc.narration || ''}
                              onChange={(e) => handleFieldChange('narration', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CATEGORY 6: BANK STATEMENT / BANKING FORM */}
                    {activeDoc.category === 'Bank Statement' && (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Statement Bank *</label>
                            <input
                              type="text"
                              value={activeDoc.vendor || ''}
                              onChange={(e) => handleFieldChange('vendor', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/45 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Reconciliation Date</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={activeDoc.docDate || ''}
                                onChange={(e) => handleFieldChange('docDate', e.target.value)}
                                className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                              />
                              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Banking Narration</label>
                          <input
                            type="text"
                            value={activeDoc.narration || ''}
                            onChange={(e) => handleFieldChange('narration', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* --- ITEM DETAILS TABLE (Only for Invoices & Statements) --- */}
                    {activeDoc.items && activeDoc.items.length > 0 && (
                      <div className="mt-4.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wide">
                          Items / Particulars Breakdown
                        </h4>

                        <div className="border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-slate-50/70 dark:bg-slate-950/40 border-b text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 font-bold uppercase">
                                <th className="py-1.5 px-2 w-8 text-center">#</th>
                                <th className="py-1.5 px-2">Item Name / Particulars</th>
                                {activeDoc.category === 'Bank Statement' ? (
                                  <>
                                    <th className="py-1.5 px-2 text-right">Debit</th>
                                    <th className="py-1.5 px-2 text-right">Credit</th>
                                    <th className="py-1.5 px-2 text-right pr-3">Balance</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="py-1.5 px-2">HSN/SAC</th>
                                    <th className="py-1.5 px-2 w-14 text-center">Qty</th>
                                    <th className="py-1.5 px-2 w-20 text-right">Rate</th>
                                    <th className="py-1.5 px-2 w-14 text-center">Tax %</th>
                                    <th className="py-1.5 px-2 text-right">Tax Amt</th>
                                    <th className="py-1.5 px-2 text-right w-24 pr-3">Amount</th>
                                  </>
                                )}
                                <th className="py-1.5 px-2 w-8 text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/85">
                              {activeDoc.items.map((item, idx) => {
                                const amount = (item.qty || 0) * (item.rate || 0);
                                const taxAmt = amount * ((item.taxRate || 0) / 100);
                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                                    <td className="py-1.5 px-2 text-center text-slate-400 font-bold">{idx + 1}</td>

                                    <td className="py-1 px-2">
                                      <input
                                        type="text"
                                        value={item.name || item.particulars || ''}
                                        onChange={(e) => handleItemPropertyChange(item.id, item.particulars ? 'particulars' : 'name', e.target.value)}
                                        className="w-full h-7 border rounded px-1.5 text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                      />
                                    </td>

                                    {activeDoc.category === 'Bank Statement' ? (
                                      <>
                                        <td className="py-1 px-2">
                                          <input
                                            type="number"
                                            value={item.debit || 0}
                                            onChange={(e) => handleItemPropertyChange(item.id, 'debit', parseFloat(e.target.value) || 0)}
                                            className="w-full h-7 border rounded px-1.5 text-right text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 font-bold text-rose-600"
                                          />
                                        </td>
                                        <td className="py-1 px-2">
                                          <input
                                            type="number"
                                            value={item.credit || 0}
                                            onChange={(e) => handleItemPropertyChange(item.id, 'credit', parseFloat(e.target.value) || 0)}
                                            className="w-full h-7 border rounded px-1.5 text-right text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 font-bold text-emerald-600"
                                          />
                                        </td>
                                        <td className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-200 pr-3">
                                          ₹ {(item.balance || 0).toLocaleString()}
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td className="py-1 px-2 w-20">
                                          <input
                                            type="text"
                                            value={item.hsn || ''}
                                            onChange={(e) => handleItemPropertyChange(item.id, 'hsn', e.target.value)}
                                            className="w-full h-7 border rounded px-1.5 text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 font-mono"
                                          />
                                        </td>
                                        <td className="py-1 px-1.5">
                                          <input
                                            type="number"
                                            value={item.qty || 0}
                                            onChange={(e) => handleItemPropertyChange(item.id, 'qty', parseInt(e.target.value) || 0)}
                                            className="w-full h-7 border rounded px-1 text-center text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                          />
                                        </td>
                                        <td className="py-1 px-1.5">
                                          <input
                                            type="number"
                                            value={item.rate || 0}
                                            onChange={(e) => handleItemPropertyChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                            className="w-full h-7 border rounded px-1 text-right text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                          />
                                        </td>
                                        <td className="py-1 px-1.5">
                                          <select
                                            value={item.taxRate || 0}
                                            onChange={(e) => handleItemPropertyChange(item.id, 'taxRate', parseInt(e.target.value) || 0)}
                                            className="w-full h-7 border rounded text-center text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 font-bold"
                                          >
                                            <option value="0">0%</option>
                                            <option value="5">5%</option>
                                            <option value="12">12%</option>
                                            <option value="18">18%</option>
                                            <option value="28">28%</option>
                                          </select>
                                        </td>
                                        <td className="py-1 px-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                                          ₹ {taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100 pr-3">
                                          ₹ {(amount + taxAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                      </>
                                    )}

                                    <td className="py-1 px-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-1 hover:text-rose-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
                                        title="Delete Item"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={activeDoc.category === 'Bank Statement' ? handleAddBankTransaction : handleAddItem}
                            className="px-2.5 py-1 border border-slate-200 dark:border-slate-850 text-[10px] font-bold text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded flex items-center gap-1 shadow-3xs bg-white dark:bg-slate-900"
                          >
                            <Plus size={11} />
                            <span>Add Row</span>
                          </button>

                          {activeDoc.category !== 'Bank Statement' && (
                            <button
                              type="button"
                              onClick={() => toast.info('Discount ledger field added')}
                              className="px-2.5 py-1 border border-slate-200 dark:border-slate-850 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded flex items-center gap-1 shadow-3xs bg-white dark:bg-slate-900"
                            >
                              <Plus size={11} />
                              <span>Add Discount</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* --- BILL SUMMARY BLOCK --- */}
                    {activeDoc.category !== 'Bank Statement' && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 flex justify-between items-start text-xs">
                        <div className="text-[10px] text-slate-400">
                          * All values auto-recalculate based on item values.
                        </div>

                        <div className="w-64 space-y-1.5 text-right font-medium">
                          <div className="flex justify-between items-center text-slate-500">
                            <span>Total Amount (Before Tax)</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                              ₹ {(activeDoc.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-500">
                            <span>Total Tax Amount</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                              ₹ {(activeDoc.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-500">
                            <span>Round Off</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                              ₹ {(activeDoc.roundOff || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm font-bold border-t pt-1.5 border-slate-800 text-slate-950 dark:text-white">
                            <span>Grand Total</span>
                            <span className="text-blue-600 dark:text-blue-400 font-black font-mono">
                              ₹ {(activeDoc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Form Action Buttons removed (consolidated in the top header toolbar) */}
              </div>

            </div>

            {/* --- FULLSCREEN PORTAL MODE OVERLAY --- */}
            {isFullScreen && (
              <div className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col p-4 backdrop-blur-xs">
                <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-t-xl border-b border-slate-700 select-none">
                  <div className="flex items-center gap-3 font-sans text-xs">
                    <FileText size={16} />
                    <span className="font-bold">{activeDoc.filename}</span>
                    <span className="text-[10px] text-slate-400">({currentViewerPage} of {activeDoc.pages || 1} Pages)</span>
                  </div>
                  <button
                    onClick={() => setIsFullScreen(false)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold text-xs"
                  >
                    <Minimize2 size={13} />
                    <span>Exit Full Screen</span>
                  </button>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto p-8 flex flex-col items-center gap-6 rounded-b-xl scroll-smooth">
                  {Array.from({ length: activeDoc.pages || 1 }, (_, i) => i + 1).map((pageNum) => (
                    <SimulatedInvoicePage
                      key={pageNum}
                      doc={activeDoc}
                      pageNum={pageNum}
                      viewType={viewerMode}
                      zoom={zoom}
                      pageRef={(el) => (pageRefs.current[pageNum] = el)}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center p-12">
            <div className="text-center max-w-sm font-sans">
              <Info size={32} className="mx-auto text-slate-350 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No documents found</h3>
              <p className="text-slate-400 dark:text-slate-500 mt-1 text-[11px]">
                No documents are currently queueing for AI processing. Go to the Bulk Upload tab to upload files.
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Upload Documents
              </button>
            </div>
          </div>
        )
      )}

      {/* Upload Documents Popup Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsUploadModalOpen(false);
                setUploadFiles([]);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col font-sans text-slate-800 dark:text-slate-100 z-10"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-150 dark:border-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UploadCloud size={16} className="text-blue-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Upload Documents for AI OCR</h3>
                </div>
                <button
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadFiles([]);
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4">
                {/* Voucher Category Selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Voucher / Category Type</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-800 px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:border-blue-500"
                  >
                    <option value="Sales Invoice">Sales Invoice</option>
                    <option value="Purchase Invoice">Purchase Invoice</option>
                    <option value="Payment">Payment</option>
                    <option value="Receipt">Receipt</option>
                    <option value="Contra">Contra</option>
                    <option value="Credit Note">Credit Note</option>
                    <option value="Debit Note">Debit Note</option>
                  </select>
                </div>

                {/* Drag and Drop Zone */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Select Files</label>
                  <div
                    onClick={() => document.getElementById('popup-file-input').click()}
                    className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-600 rounded-xl p-6 flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-950/20 cursor-pointer transition"
                  >
                    <UploadCloud size={24} className="text-slate-400 dark:text-slate-600" />
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Drag & Drop files here, or <span className="text-blue-500">Browse</span></span>
                    <span className="text-[9px] text-slate-400">Supports PDF, PNG, JPG, JPEG (Max 25MB)</span>
                    <input
                      id="popup-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          setUploadFiles(Array.from(e.target.files));
                        }
                      }}
                    />
                  </div>
                </div>

                {/* File List */}
                {uploadFiles.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Selected Files ({uploadFiles.length})</label>
                    {uploadFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-955/40 p-2 rounded-lg border border-slate-200/50 dark:border-slate-850">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={13} className="text-blue-500 shrink-0" />
                          <span className="text-[10.5px] font-bold truncate text-slate-700 dark:text-slate-300">{file.name}</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-slate-150 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadFiles([]);
                  }}
                  className="h-8 px-3 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={uploadFiles.length === 0}
                  onClick={handleUploadAndProcess}
                  className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <PlayCircle size={13} />
                  <span>Start AI Processing</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
