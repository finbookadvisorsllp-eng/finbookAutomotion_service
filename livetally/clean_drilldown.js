const fs = require('fs');

const files = [
  'src/components/DrillDown/Level1Monthly.jsx',
  'src/components/DrillDown/Level2VoucherList.jsx',
  'src/components/DrillDown/Level3VoucherDetail.jsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace main wrapper with glass-card
  content = content.replace(/className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col flex-1"/g, 'className="glass-card overflow-hidden flex flex-col flex-1"');
  
  // Remove all dark: classes
  content = content.replace(/dark:[A-Za-z0-9\-/\\[\]#]+/g, '');
  
  // Clean up extra spaces
  content = content.replace(/\s+/g, ' ');
  content = content.replace(/ className=" /g, ' className="');
  content = content.replace(/ " /g, '" ');

  fs.writeFileSync(file, content);
  console.log(`Cleaned ${file}`);
});
