# Quiz Drill Pad

### to make sure sh is end of LF (bash)
`find . -type f -name "*.sh" -exec dos2unix {} +` 

### to make sure sh is end of LF (powershell)
``Get-ChildItem -Recurse -Filter *.sh | ForEach-Object { (Get-Content $_.FullName -Raw) -replace "`r`n", "`n" | Set-Content $_.FullName -NoNewline }`` 

## deploy ##

add `export HISTCONTROL=ignoreboth` into ~/.bashrc
` export SSHPASS='password***'`

### in root, copy `/scripts` `/web/service_upload` `/config/topic.json` to remote `drillpad` ###
`sshpass -e rsync -av --inplace --delete ./web/web_quiz/dist root@192.168.1.159:/var/www/qdp_dist/`
`sshpass -e rsync -av --inplace --delete ./scripts           root@192.168.1.159:/home/qmiao/qm1_share/drillpad/`
`sshpass -e rsync -av --inplace ./web/service_upload         root@192.168.1.159:/home/qmiao/qm1_share/drillpad/`
`sshpass -e rsync -av --inplace ./config/topic.json          root@192.168.1.159:/home/qmiao/qm1_share/drillpad/config/topic.json`

### fetch back `users data` `config` from server ###
`sshpass -e rsync -av --inplace root@192.168.1.159:/home/qmiao/qm1_share/drillpad/users ./`
`sshpass -e rsync -av --inplace root@192.168.1.159:/home/qmiao/qm1_share/drillpad/config ./`


## clean up ##

### clear all node_modules/ dist/ bun.lock under /web ###
`find . \( -type d \( -name node_modules -o -name dist \) -o -type f -name bun.lock \) -prune -exec rm -rf {} +`

then under ***/web*** `bun install` (is same OS platform with `bun run ...`).