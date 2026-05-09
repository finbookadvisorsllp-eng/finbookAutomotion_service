import React from 'react';
import SalesPanel from './SalesPanel';
import { FileMinus } from 'lucide-react';

const CreditNote = ({ isDark }) => {
  return (
    <SalesPanel 
      mode="Inbox" 
      isDark={isDark} 
      voucherType="credit_note" 
      title="Credit Note (Sales Return)" 
      icon={FileMinus}
      description="Manage and process all sales return entries efficiently."
      emptyText="No Credit Note found"
    />
  );
};

export default CreditNote;
