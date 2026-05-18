@echo off
:: PORTAL SAUDE FACIL - START SCRIPT
:: Versao simplificada para evitar erros de encoding no CMD Windows

echo ============================================================
echo   PORTAL SAUDE FACIL - INICIALIZANDO...
echo ============================================================
echo.

:: 1. Limpeza de porta 5001
echo [1/4] Liberando a porta 5001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5001') do (
    taskkill /F /PID %%a /T >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: 2. Localizar Python
echo [2/4] Verificando Python...
set PY_CMD=python
py --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=py
)
echo [OK] Usando: %PY_CMD%

:: 3. Dependencias
echo [3/4] Validando bibliotecas...
cd backend
%PY_CMD% -m pip install -r requirements.txt --quiet
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Falha ao validar bibliotecas.
)
echo [OK] Ambiente pronto.

:: 4. Iniciar Servidor
echo [4/4] LIGANDO O SERVIDOR...
echo ------------------------------------------------------------
echo Mantenha esta janela aberta para o sistema funcionar.
echo ------------------------------------------------------------
echo.

:: Inicia o servidor em uma nova janela para facilitar a leitura de logs
start "SERVIDOR FLASK" cmd /k "%PY_CMD% app.py"

echo.
echo [INFO] Aguardando inicializacao...
timeout /t 5 /nobreak >nul
start http://127.0.0.1:5001/

echo.
echo ============================================================
echo   SISTEMA ONLINE. 
echo ============================================================
pause
