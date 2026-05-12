import React from 'react';
import SalesPanel from './SalesPanel';
import { FileText } from 'lucide-react';

const SalesInvoice = ({ isDark }) => {
  return (
    <SalesPanel 
      mode="Inbox" 
      isDark={isDark} 
      voucherType="sales_invoice" 
      title="Sales Invoice" 
      icon={FileText}
      description="Manage and process all sales invoices efficiently."
      emptyText="No Sales Invoice found"
    />
  );
};

export default SalesInvoice;
