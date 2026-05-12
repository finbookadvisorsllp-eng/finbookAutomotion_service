import React from 'react';
import PurchasePanel from './PurchasePanel';
import { ShoppingCart } from 'lucide-react';

const PurchaseOrder = ({ isDark }) => {
  return (
    <PurchasePanel 
      mode="Inbox" 
      isDark={isDark} 
      voucherType="purchase_order" 
      title="Purchase Order" 
      icon={ShoppingCart}
      description="Manage and process all purchase orders efficiently."
      emptyText="No Purchase Order found"
    />
  );
};

export default PurchaseOrder;
