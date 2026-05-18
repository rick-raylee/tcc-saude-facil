$files = @("agendamento.html", "telemedicina.html", "campanhas.html", "duvidas.html", "indexHome.html")

$homeLines = Get-Content "home.html" -Encoding UTF8

$startHome = -1; $endHome = -1;
for ($i = 0; $i -lt $homeLines.Count; $i++) {
    if ($homeLines[$i] -match 'id="modalAuth" class="modal-auth"') { $startHome = $i - 3 }
    if ($startHome -ne -1 -and $i -gt $startHome -and $homeLines[$i] -match '<div id="modal2FA"') { $endHome = $i - 2; break }
}

$modalAuthStr = ""
for ($i = $startHome; $i -lt $endHome; $i++) { $modalAuthStr += $homeLines[$i] + "`r`n" }

foreach ($f in $files) {
    if (Test-Path $f) {
        $content = Get-Content $f -Encoding UTF8 -Raw
        
        # Replace nav buttons
        $content = $content -replace '<button class="btn-auth btn-login" onclick="abrirModalLogin\(\)">LOGIN</button>', '<button class="btn-auth btn-login" onclick="abrirModalAuth()">LOGIN</button>'
        $content = $content -replace '<button class="btn-auth btn-cadastro" onclick="abrirModalCadastro\(\)">CADASTRE-SE</button>', '<button class="btn-auth btn-cadastro" onclick="abrirModalAuth(); flipParaCadastro();">CADASTRE-SE</button>'
        
        # Replace modals block
        # The block starts at <!-- MODAIS DE AUTENTICAÇÃO INTEGRADOS --> or <div id="modalLogin" ... and ends before <div id="modal2FA" or </script>
        # Let's match from <div id="modalLogin" up to but not including <script
        # We need a robust regex or we just loop lines again.
        
        $lines = Get-Content $f -Encoding UTF8
        $startIndex = -1; $endIndex = -1;
        
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '<div id="modalLogin" class="modal-auth">') { 
                # check if there's a comment above it
                if ($i -gt 0 -and $lines[$i - 1] -match 'MODAIS DE') {
                    $startIndex = $i - 1
                }
                else {
                    $startIndex = $i 
                }
            }
            if ($startIndex -ne -1 -and $i -gt $startIndex -and $lines[$i] -match '<script src="api.js">|<div id="modal2FA"') { 
                $endIndex = $i 
                break 
            }
        }
        
        if ($startIndex -ne -1 -and $endIndex -ne -1) {
            $newLines = @()
            for ($i = 0; $i -lt $startIndex; $i++) { $newLines += $lines[$i] }
            
            # Since we did raw string replace for nav buttons, we should re-apply the button logic on strings or just do it line by line?
            # It's better to do the button replace on newLines as well.
            
            for ($i = $startHome; $i -lt $endHome; $i++) { $newLines += $homeLines[$i] }
            
            for ($i = $endIndex; $i -lt $lines.Count; $i++) { $newLines += $lines[$i] }
            
            # Now replace the navbar buttons inside the string array
            for ($i = 0; $i -lt $newLines.Count; $i++) {
                $newLines[$i] = $newLines[$i] -replace 'onclick="abrirModalLogin\(\)"', 'onclick="abrirModalAuth()"'
                $newLines[$i] = $newLines[$i] -replace 'onclick="abrirModalCadastro\(\)"', 'onclick="abrirModalAuth(); flipParaCadastro();"'
            }
            
            $newLines | Set-Content $f -Encoding UTF8
            Write-Host "Updated $f"
        }
        else {
            Write-Host "Skipped $f - couldn't find bounds ($startIndex, $endIndex)"
        }
    }
}
