const fs = require('fs');

const path = './src/pages/CashBank/CashBankDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// The issue: dark:text-slate-400 maps to #5a5a62 (very dark). We need dark:text-slate-700 (#a0a0a8)
content = content.replaceAll('dark:text-slate-400', 'dark:text-slate-700');

// dark:text-slate-300 maps to rgba(182, 255, 0, 0.45) (translucent border). We need dark:text-slate-800 (#ffffff) or dark:text-slate-700 (#a0a0a8).
// For labels like "Account Name", it's better to use dark:text-slate-700. For amounts, dark:text-slate-800.
// Let's just use dark:text-slate-700 as a safe medium-light color.
content = content.replaceAll('dark:text-slate-300', 'dark:text-slate-700');

// dark:text-slate-200 maps to rgba(182, 255, 0, 0.25). We need dark:text-slate-800 (#ffffff)
content = content.replaceAll('dark:text-slate-200', 'dark:text-slate-800');

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
