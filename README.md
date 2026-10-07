# drillpad

### to make sure sh is end of LF (bash)
`find . -type f -name "*.sh" -exec dos2unix {} +` 

### to make sure sh is end of LF (powershell)
``Get-ChildItem -Recurse -Filter *.sh | ForEach-Object { (Get-Content $_.FullName -Raw) -replace "`r`n", "`n" | Set-Content $_.FullName -NoNewline }`` 

## deploy ##

### in root, copy /scripts to remote ###
add `export HISTCONTROL=ignoreboth` into ~/.bashrc

` export SSHPASS='password***'`

`sshpass -e rsync -av --inplace ./scripts root@192.168.1.159:/home/qmiao/qm1_share/drillpad`

### in /web_quiz, copy /dist to remote ###
`sshpass -e rsync -av --inplace ./dist root@192.168.1.159:/var/www/qdp_dist`

### in /web_quiz_editor, copy /dist to remote ###
`sshpass -e rsync -av --inplace ./dist root@192.168.1.159:/var/www/qdp_editor_dist`

## clean up ##

### clear all node_modules/ dist/ bun.lock under /web ###
`find . \( -type d \( -name node_modules -o -name dist \) -o -type f -name bun.lock \) -prune -exec rm -rf {} +`