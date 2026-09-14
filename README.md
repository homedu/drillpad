# drillpad

### to make sure sh is end of LF (bash)
`find . -type f -name "*.sh" -exec dos2unix {} +` 

### to make sure sh is end of LF (powershell)
``Get-ChildItem -Recurse -Filter *.sh | ForEach-Object { (Get-Content $_.FullName -Raw) -replace "`r`n", "`n" | Set-Content $_.FullName -NoNewline }`` 
