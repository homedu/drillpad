# Quiz Drill Pad

### to make sure sh is end of LF (bash)

`find . -type f -name "*.sh" -exec dos2unix {} +`

### to make sure sh is end of LF (powershell)

``Get-ChildItem -Recurse -Filter *.sh | ForEach-Object { (Get-Content $_.FullName -Raw) -replace "`r`n", "`n" | Set-Content $_.FullName -NoNewline }``

## deploy

add `export HISTCONTROL=ignoreboth` into ~/.bashrc
`export SSHPASS='***password***'`

## clean up

### clear all node_modules/ dist/ bun.lock under /web

`find . \( -type d \( -name node_modules -o -name dist \) -o -type f -name bun.lock \) -prune -exec rm -rf {} +`

then under _**/web**_ `bun install` (is same OS platform with `bun run ...`).
