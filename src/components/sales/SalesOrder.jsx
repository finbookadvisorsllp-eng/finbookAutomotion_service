import React from 'react';
import SalesPanel from './SalesPanel';
import { FileText } from 'lucide-react';

const SalesOrder = ({ isDark }) => {
  return (
    <SalesPanel 
      mode="Inbox" 
      isDark={isDark} 
      voucherType="sales_order" 
      title="Sales Order" 
      icon={FileText}
      description="Manage and process all sales orders efficiently."
      emptyText="No Sales Order found"
    />
  );
};

export default SalesOrder;
