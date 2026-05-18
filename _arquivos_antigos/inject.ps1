$files = @(
    "index.html",
    "indexHome.html",
    "agendamento.html",
    "campanhas.html",
    "duvidas.html",
    "telemedicina.html",
    "termos.html",
    "privacidade.html"
)

$target_dir = "c:\Users\ricar\Desktop\tcc ricardo\TCC CEEP"

foreach ($f in $files) {
    $path = Join-Path -Path $target_dir -ChildPath $f
    if (Test-Path $path) {
        $content = Get-Content -Path $path -Raw -Encoding UTF8
        # Simple replace case-insensitive
        if (-not $content.Contains('cookie-consent.js')) {
            $newContent = $content -ireplace '</body>', "    <script src=`"cookie-consent.js`" defer></script>`n</body>"
            Set-Content -Path $path -Value $newContent -Encoding UTF8 -NoNewline
            Write-Host "Injected into $f"
        } else {
            Write-Host "Already injected in $f"
        }
    } else {
        Write-Host "File not found: $f"
    }
}
