#!/usr/bin/env bash

set -euo pipefail

fetch_u_c() {
    local pass="$1"
    if [[ -z "$pass" ]]; then
        echo "用法: fetch_u_c <密码>"
        return 1
    fi

    # 导出供 sshpass -e 读取，函数结束时自动清除
    export SSHPASS="$pass"
    trap 'unset SSHPASS' RETURN

    REMOTE="root@100.115.50.31"
    REMOTE_ROOT="/home/qmiao/qm1_share/drillpad"

    mkdir -p ./fetch

    sshpass -e rsync -av --inplace "${REMOTE}":"${REMOTE_ROOT}"/users ./fetch/
    sshpass -e rsync -av --inplace "${REMOTE}":"${REMOTE_ROOT}"/config ./fetch/
}

clear() {
    return 0
}

fetch_u_c $1
if [[ $? != 0 ]]; then
    echo "部署失败"
    exit 0
fi

clear
if [[ $? != 0 ]]; then
    echo "清理失败"
    exit 0
fi
