import React from 'react';
import PurchasePanel from './PurchasePanel';
import { FileText } from 'lucide-react';

const PurchaseInvoice = ({ isDark }) => {
  return (
    <PurchasePanel 
      mode="Inbox" 
      isDark={isDark} 
      voucherType="purchase_invoice" 
      title="Purchase Invoice" 
      icon={FileText}
      description="Manage and process all purchase invoices efficiently."
      emptyText="No Purchase Invoice found"
    />
  );
};

export default PurchaseInvoice;
