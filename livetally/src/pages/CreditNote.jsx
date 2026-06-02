import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { drillDownData } from '../data/transactionsDrillDownData';

import DrillDownHeader from '../components/DrillDown/DrillDownHeader';
import Level1Monthly from '../components/DrillDown/Level1Monthly';
import Level2VoucherList from '../components/DrillDown/Level2VoucherList';
import Level3VoucherDetail from '../components/DrillDown/Level3VoucherDetail';

export default function CreditNote() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthId = searchParams.get('month');
  const voucherId = searchParams.get('voucher');

  const moduleData = drillDownData.creditNote;

  const handleMonthClick = (id) => {
    setSearchParams({ month: id });
  };

  const handleVoucherClick = (id) => {
    setSearchParams({ month: monthId, voucher: id });
  };

  const handleBack = () => {
    if (voucherId) {
      setSearchParams({ month: monthId });
    } else if (monthId) {
      setSearchParams({});
    }
  };

  const getLevel = () => {
    if (voucherId) return 3;
    if (monthId) return 2;
    return 1;
  };

  const level = getLevel();

  const getVouchersForMonth = () => {
    if (!monthId) return [];
    return moduleData.vouchers[monthId] || [];
  };

  const getVoucherDetail = () => {
    if (!voucherId) return null;
    return moduleData.voucherDetails[voucherId];
  };

  const getVoucherDetailMock = () => {
    const detail = getVoucherDetail();
    if (detail) return detail;
    return Object.values(moduleData.voucherDetails)[0];
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <DrillDownHeader 
        level={level}
        title="Credit Notes"
        totalAmount={monthId ? getVouchersForMonth().reduce((sum, v) => sum + v.amount, 0) : moduleData.total}
        onBack={handleBack}
        voucherData={getVoucherDetailMock()}
      />
      
      {level === 1 && (
        <Level1Monthly 
          months={moduleData.months} 
          onMonthClick={handleMonthClick} 
        />
      )}
      
      {level === 2 && (
        <Level2VoucherList 
          vouchers={getVouchersForMonth()} 
          onVoucherClick={handleVoucherClick} 
        />
      )}
      
      {level === 3 && (
        <Level3VoucherDetail 
          voucherData={getVoucherDetailMock()} 
        />
      )}
    </div>
  );
}
