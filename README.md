# drillpad

### to make sure sh is end of LF (bash)
`find . -type f -name "*.sh" -exec dos2unix {} +` 

### to make sure sh is end of LF (powershell)
``Get-ChildItem -Recurse -Filter *.sh | ForEach-Object { (Get-Content $_.FullName -Raw) -replace "`r`n", "`n" | Set-Content $_.FullName -NoNewline }`` 

### put /script/ to remote ###
add `export HISTCONTROL=ignoreboth` into ~/.bashrc

` export SSHPASS='password***'`

`sshpass -e rsync -av --inplace ./scripts root@192.168.1.159:/home/qmiao/qm1_share/drillpad`