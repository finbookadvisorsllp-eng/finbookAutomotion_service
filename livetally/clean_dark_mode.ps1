$files = @(
  "src\pages\ProfitLoss.jsx",
  "src\pages\ProfitLoss\Breadcrumbs.jsx",
  "src\pages\ProfitLoss\Level1Summary.jsx",
  "src\pages\ProfitLoss\Level2LedgerBreakdown.jsx",
  "src\pages\ProfitLoss\Level3StockList.jsx",
  "src\pages\ProfitLoss\Level3VoucherList.jsx",
  "src\pages\ProfitLoss\Level4StockItemLedger.jsx",
  "src\pages\ProfitLoss\Level4VoucherDetail.jsx",
  "src\pages\ProfitLoss\Level5StockItemCustomer.jsx"
)

foreach ($file in $files) {
  $content = Get-Content $file -Raw
  $content = $content -replace '\bdark:bg-slate-\d+(?:\/\d+)?\b', ''
  $content = $content -replace '\bdark:border-slate-\d+(?:\/\d+)?\b', ''
  $content = $content -replace '\bdark:text-slate-\d+\b', ''
  $content = $content -replace '\bdark:text-white\b', ''
  $content = $content -replace '\bdark:hover:bg-slate-\d+(?:\/\d+)?\b', ''
  $content = $content -replace '\bdark:hover:text-slate-\d+\b', ''
  $content = $content -replace '\bdark:hover:text-white\b', ''
  $content = $content -replace '  +', ' '
  $content = $content -replace ' className=" ', ' className="'
  
  Set-Content $file $content
}
