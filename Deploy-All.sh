#!/usr/bin/env bash

set -euo pipefail

deploy_all() {
    local pass="$1"
    if [[ -z "$pass" ]]; then
        echo "用法: deploy_all <密码>"
        return 1
    fi

    # 导出供 sshpass -e 读取，函数结束时自动清除
    export SSHPASS="$pass"
    trap 'unset SSHPASS' RETURN

    REMOTE="root@192.168.1.159"
    ROOT="/home/qmiao/qm1_share/drillpad"

    # 'EOF' 加了单引号会阻止本地 Bash 解析任何 $ 变量；去掉单引号，本地变量会在发送给远程服务器之前先被替换成具体的值
    sshpass -e ssh -o StrictHostKeyChecking=no "${REMOTE}" << EOF
        echo "远程主机名: \$(hostname)"
        echo "远程初始目录: \$(pwd)"
        cd "${ROOT}"
        mkdir -p /var/www/qdp_dist
        mkdir -p ./config
        mkdir -p ./web/service_upload
        cd "${ROOT}"/scripts/deploy && ./Stop-Services.sh
EOF

    sshpass -e rsync -av --inplace --delete ./web/web_quiz/dist    "${REMOTE}":/var/www/qdp_dist/
    sshpass -e rsync -av --inplace --delete ./scripts              "${REMOTE}":"${ROOT}"/
    sshpass -e rsync -av --inplace ./config/topic.json             "${REMOTE}":"${ROOT}"/config/
    sshpass -e rsync -av --inplace ./web/service_upload/svr-upload "${REMOTE}":"${ROOT}"/web/service_upload/

    sshpass -e ssh -o StrictHostKeyChecking=no "${REMOTE}" << EOF
        cd "${ROOT}"/scripts/deploy && ./Start-Services.sh --upload-server && systemctl restart caddy
EOF
}

deploy_all $1

if [[ $? != 0 ]]; then
    echo "部署失败"
fi
