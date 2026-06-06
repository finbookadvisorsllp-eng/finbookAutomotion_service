const fs = require('fs');

function fixFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // Fix backgrounds that map to white when they should be dark
    content = content.replaceAll('dark:bg-slate-800', 'dark:bg-slate-100');
    content = content.replaceAll('dark:bg-slate-700', 'dark:bg-slate-100');
    content = content.replaceAll('dark:hover:bg-slate-800', 'dark:hover:bg-slate-100');
    
    // Fix text colors
    content = content.replaceAll('dark:text-slate-400', 'dark:text-slate-700');
    content = content.replaceAll('dark:text-slate-300', 'dark:text-slate-700');
    content = content.replaceAll('dark:text-slate-200', 'dark:text-slate-800');
    
    // Fix text-white on active tabs
    content = content.replaceAll('text-white shadow-md', 'text-white dark:text-slate-800 shadow-md');
    
    // In OutstandingReports.jsx, 'text-slate-800 dark:text-white' was used
    content = content.replaceAll('dark:text-white', 'dark:text-slate-800');
    
    // In OutstandingReports, change dark:text-slate-800 (if it was text-slate-800 dark:text-slate-800)
    // Actually we want dark:text-slate-800 for white text.

    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed', path);
}

fixFile('./src/components/DataTable.jsx');
fixFile('./src/pages/OutstandingReports.jsx');

