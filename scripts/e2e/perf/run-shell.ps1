# Run a Django shell script against the e2e backend settings (jm_e2e). Usage: run-shell.ps1 <script.py>
param([string]$Script)
$E2E = 'C:\Users\JIVO\AppData\Local\Temp\claude\c--Users-JIVO-Desktop-JM\7b2eb89b-148c-4369-99b4-4677f8853037\scratchpad\e2e'
. "$E2E\backend-env.ps1" | Out-Null
$env:PERF_OUT = "$E2E\perf"
Set-Location C:\Users\JIVO\Desktop\JM\JIVO-JM-Backend
& .\.venv\Scripts\python.exe manage.py shell -c "exec(open(r'$Script', encoding='utf-8-sig').read())" 2>&1 | Where-Object { $_ -notmatch 'objects imported automatically' }
