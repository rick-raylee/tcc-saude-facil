$homeLines = Get-Content "home.html"
$indexLines = Get-Content "index.html"

$startHome = -1; $endHome = -1;
for ($i=0; $i -lt $homeLines.Count; $i++) {
    if ($homeLines[$i] -match 'id="modalAuth"') { $startHome = $i - 3 }
    if ($startHome -ne -1 -and $i -gt $startHome -and $homeLines[$i] -match '<div id="modal2FA"') { $endHome = $i - 1; break }
}

$startIndex = -1; $endIndex = -1;
for ($i=0; $i -lt $indexLines.Count; $i++) {
    if ($indexLines[$i] -match 'MODAL DE LOGIN') { $startIndex = $i }
    if ($startIndex -ne -1 -and $i -gt $startIndex -and $indexLines[$i] -match 'MODAL 2FA') { $endIndex = $i - 1; break }
}

if ($startHome -ne -1 -and $startIndex -ne -1) {
    $newLines = @()
    for ($i=0; $i -lt $startIndex; $i++) { $newLines += $indexLines[$i] }
    for ($i=$startHome; $i -lt $endHome; $i++) { $newLines += $homeLines[$i] }
    $newLines += ""
    for ($i=$endIndex; $i -lt $indexLines.Count; $i++) { $newLines += $indexLines[$i] }
    
    $newLines | Set-Content "index.html" -Encoding UTF8
    Write-Host "SUCCESS"
} else {
    Write-Host "FAILED: $startHome, $endHome, $startIndex, $endIndex"
}
