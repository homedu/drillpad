#!/usr/bin/env bash

set -uo pipefail

##########################################################

if [[ "${__ALLOWED_BY_STOP_SERVICES__:-false}" != "true" ]]; then
    echo "❌ 错误: 该脚本禁止直接在命令行独立运行！"
    exit 1
fi

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd ${SCRIPT_DIR} > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

##########################################################

TOPIC_CFG="../../config/topic.json"
if [[ -f "$TOPIC_CFG" ]]; then
    if ! command -v jq &> /dev/null; then
        echo "错误: 未找到 'jq' 命令"
        exit 1
    fi
    export $(jq -r 'to_entries | .[] | "\(.key)=\(.value)"' "$TOPIC_CFG" | tr -d '\r' | xargs)
else
    echo "错误: 未找到配置文件 $TOPIC_CFG"
    exit 1
fi

##########################################################

SESSION="nats-reply"
TIMEOUT=5 # 等待优雅退出的最长秒数

echo "--------------------------------------------------"
echo "正在清理 tmux 会话 '${SESSION}' ..."
echo "--------------------------------------------------"

# 与启动脚本保持一致：脚本名默认 reply_<窗口名>.sh，不一致时用 "窗口名|脚本名"
SERVICES=(
"${T_QUIZ_FETCH}"
"${T_QUIZ_LIST}"
"${T_ANS_REC}"
"${T_QA_COUNT}"
"${T_QUIZ_MAKE}|reply_quiz-make.sh"
"${T_QUESTION_FETCH}"
"${T_QUESTION_DELETE}"
"${T_QUESTION_RATE}"
"${T_GROUP_CONTENT_SAVE}"
"${T_GROUP_CONTENT_FETCH}"
"${T_GROUPS_CONTENT_FETCH}"
"${T_GROUP_LIST}"
)

parse() {
    name="${1%%|*}"
    script="${1#*|}"
    [[ "$script" == "$1" ]] && script="reply_${name}.sh"
}

# 返回某个服务当前存活的 PID（一行）
pids_of() {
    parse "$1"
    pgrep -f "nats reply.*${name}.*${script}" | xargs
}

# 仍有进程存活的服务数量
alive_count() {
    local n=0 item
    for item in "${SERVICES[@]}"; do
        [[ -n "$(pids_of "$item")" ]] && ((n++))
    done
    echo "$n"
}

# ---------------------- 退出 ----------------------
stop_all() {
    local item i pid

    # 1. 向每个窗口发送 Ctrl-C，优雅退出
    if tmux has-session -t "${SESSION}" 2>/dev/null; then
        for item in "${SERVICES[@]}"; do
            parse "$item"
            tmux send-keys -t "${SESSION}:$name" C-c 2>/dev/null
        done
    else
        echo "⚠️ session [${SESSION}] 不存在，仅清理残留进程。"
    fi

    # 2. 轮询等待，全部退出就提前结束
    echo "⏳ 等待进程退出 (最多 ${TIMEOUT}s) ..."
    for ((i = 0; i < TIMEOUT; i++)); do
        (( $(alive_count) == 0 )) && break
        sleep 1
    done

    # 3. 关闭 tmux session（窗口里的 shell 一并结束）
    tmux kill-session -t "${SESSION}" 2>/dev/null

    # 4. 仍未退出的进程强制 kill -9
    for item in "${SERVICES[@]}"; do
        pid=$(pids_of "$item")
        if [[ -n "$pid" ]]; then
            parse "$item"
            echo "🔪 [$name] 未能优雅退出，强制终止 (PID: $pid)"
            kill -9 $pid 2>/dev/null
        fi
    done
    sleep 1
}

# ---------------------- 检查是否退出干净 ----------------------
check_clean() {
    local item pid clean=0 dirty=0

    for item in "${SERVICES[@]}"; do
        parse "$item"
        pid=$(pids_of "$item")
        if [[ -z "$pid" ]]; then
            echo "✅ [$name] 已退出"
            ((clean++))
        else
            echo "❌ [$name] 仍有残留进程 (PID: $pid)"
            ((dirty++))
        fi
    done

    # tmux session 是否已清理
    if tmux has-session -t "${SESSION}" 2>/dev/null; then
        echo "❌ tmux session [${SESSION}] 仍然存在"
        ((dirty++))
    else
        echo "✅ tmux session [${SESSION}] 已关闭"
    fi

    echo "--------------------------------"
    echo "共 ${#SERVICES[@]} 个服务: 已退出 $clean, 残留 $dirty"
    (( dirty == 0 ))
}

# ---------------------- 主流程 ----------------------
stop_all

check_clean && echo "🎉 全部退出干净" || echo "⚠️  存在残留，请手动检查 (ps aux | grep 'nats reply')"
