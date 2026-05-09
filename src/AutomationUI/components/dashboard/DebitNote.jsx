import React from 'react';
import PurchasePanel from './PurchasePanel';
import { FileMinus } from 'lucide-react';

const DebitNote = ({ isDark }) => {
  return (
    <PurchasePanel 
      mode="Inbox" 
      isDark={isDark} 
      voucherType="debit_note" 
      title="Debit Note (Purchase Return)" 
      icon={FileMinus}
      description="Manage and process all purchase return entries efficiently."
      emptyText="No Debit Note found"
    />
  );
};

export default DebitNote;
