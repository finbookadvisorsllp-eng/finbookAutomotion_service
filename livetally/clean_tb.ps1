$files = @(
  "src\pages\TrialBalance.jsx"
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
  $content = $content -replace '\bdark:hover:text-blue-\d+\b', ''
  $content = $content -replace '\bdark:text-blue-\d+\b', ''
  $content = $content -replace 'bg-white', 'bg-slate-50'
  $content = $content -replace 'bg-\[\#f4f7fb\]', 'bg-slate-50'
  $content = $content -replace '  +', ' '
  $content = $content -replace ' className=" ', ' className="'
  
  Set-Content $file $content
}
