import fs from 'fs';
import path from 'path';

const dir = 'd:/finbookAutomotion_service/livetally/src/pages';
const files = [
  'ProfitLoss.jsx',
  'ProfitLoss/Breadcrumbs.jsx',
  'ProfitLoss/Level1Summary.jsx',
  'ProfitLoss/Level2LedgerBreakdown.jsx',
  'ProfitLoss/Level3StockList.jsx',
  'ProfitLoss/Level3VoucherList.jsx',
  'ProfitLoss/Level4StockItemLedger.jsx',
  'ProfitLoss/Level4VoucherDetail.jsx',
  'ProfitLoss/Level5StockItemCustomer.jsx'
];

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // We want to remove all dark: classes related to slate and white since the user's CSS handles them
  content = content.replace(/\bdark:bg-slate-\d+(?:\/\d+)?\b/g, '');
  content = content.replace(/\bdark:border-slate-\d+(?:\/\d+)?\b/g, '');
  content = content.replace(/\bdark:text-slate-\d+\b/g, '');
  content = content.replace(/\bdark:text-white\b/g, '');
  content = content.replace(/\bdark:hover:bg-slate-\d+(?:\/\d+)?\b/g, '');
  content = content.replace(/\bdark:hover:text-slate-\d+\b/g, '');
  content = content.replace(/\bdark:hover:text-white\b/g, '');
  
  // Also clean up multiple spaces left by replacement
  content = content.replace(/  +/g, ' ');
  content = content.replace(/ className=" /g, ' className="');
  content = content.replace(/ "/g, '"');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Processed', file);
});
