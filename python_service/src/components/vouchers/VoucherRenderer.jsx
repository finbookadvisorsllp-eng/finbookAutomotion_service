import React from 'react';
import CreateSales from '../sales/CreateSales';
import CreatePurchase from '../purchase/CreatePurchase';
import CreateFundFlow from './CreateFundFlow';

export default function VoucherRenderer({ voucherType, initialData, isDark, onBack, onSaveSuccess, onVoucherTypeChange, isOcrMode }) {
  const typeLower = (voucherType || '').toLowerCase();

  // Route to Sales components
  if (typeLower.includes('sales') || typeLower.includes('credit_note') || typeLower.includes('credit note')) {
    const effectiveType = typeLower.includes('credit')
      ? 'credit_note'
      : typeLower.includes('order')
        ? 'sales_order'
        : 'sales_invoice';
    return (
      <CreateSales
        isDark={isDark}
        voucherType={effectiveType}
        onBack={onBack}
        onSaveSuccess={onSaveSuccess}
        onVoucherTypeChange={onVoucherTypeChange}
        initialData={initialData}
        isOcrMode={isOcrMode}
      />
    );
  }

  // Route to Purchase components
  if (typeLower.includes('purchase') || typeLower.includes('debit_note') || typeLower.includes('debit note')) {
    const effectiveType = typeLower.includes('debit')
      ? 'debit_note'
      : typeLower.includes('order')
        ? 'purchase_order'
        : 'purchase_invoice';
    return (
      <CreatePurchase
        isDark={isDark}
        voucherType={effectiveType}
        onBack={onBack}
        onSaveSuccess={onSaveSuccess}
        onVoucherTypeChange={onVoucherTypeChange}
        initialData={initialData}
        isOcrMode={isOcrMode}
      />
    );
  }

  // Route to Payment, Receipt, Contra, Journal components
  const effectiveType = typeLower.includes('contra')
    ? 'contra'
    : (typeLower.includes('receipt') || typeLower.includes('bank_payment'))
      ? 'bank_payment'
      : (typeLower.includes('payment') || typeLower.includes('cash_payment'))
        ? 'cash_payment'
        : typeLower; // Handles 'journal' or other custom types

  return (
    <CreateFundFlow
      isDark={isDark}
      voucherType={effectiveType}
      onBack={onBack}
      onSaveSuccess={onSaveSuccess}
      onVoucherTypeChange={onVoucherTypeChange}
      initialData={initialData}
      isOcrMode={isOcrMode}
    />
  );
}
