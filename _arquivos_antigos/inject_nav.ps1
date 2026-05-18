$target_dir = "c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP"
$files = Get-ChildItem -Path $target_dir -Filter *.html

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    # Check if Mapas is already included to prevent duplicates
    if (-not $content.Contains('"mapas.html"')) {
        # Replace the specific string
        $search = '<a href="campanhas.html">Campanhas</a>'
        $replace = "<a href=`"campanhas.html`">Campanhas</a>`n            <a href=`"mapas.html`">Mapas</a>"
        
        $newContent = $content.Replace($search, $replace)
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
        Write-Host "Injected map nav into $($file.Name)"
    } else {
        Write-Host "Nav already present in $($file.Name)"
    }
}
