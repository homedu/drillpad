#!/usr/bin/env bash

set -uo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd ${SCRIPT_DIR} > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

##########################################################

SESSION="nats-reply"
WAIT=2 # 启动后等待秒数

# 新增服务只需加一行；脚本名默认 reply_<窗口名>.sh，不一致时用 "窗口名|脚本名" 指定
SERVICES=(
"quiz-list"
"qa-count"
"quiz-fetch"
"quiz-make|reply_quiz-make.sh"
"group-content-save"
"group-content-fetch"
"answer-record"
"question-fetch"
"question-delete"
)

# 拆分一项为 name / script
parse() {
    name="${1%%|*}"
    script="${1#*|}"
    [[ "$script" == "$1" ]] && script="reply_${name}.sh"
}

# ---------------------- 启动 ----------------------
start_all() {
    local item first=1
    for item in "${SERVICES[@]}"; do
        parse "$item"
        if (( first )); then
            tmux new-session -d -s "${SESSION}" -n "$name"   # 第一个窗口随 session 创建
            first=0
        else
            tmux new-window -t "${SESSION}:" -n "$name"
        fi
        tmux send-keys -t "${SESSION}:$name" \
            "nats reply \"$name\" --command=\"../$script\" 2>/dev/null" C-m
    done
}

# ---------------------- 检查 ----------------------
check_all() {
    local item pid ok=0 fail=0
    for item in "${SERVICES[@]}"; do
        parse "$item"
        pid=$(pgrep -f "nats reply.*${name}.*${script}" | xargs)

        if [[ -n "$pid" ]]; then
            echo "✅ [$name] nats reply 已启动 (PID: $pid)"
            ((ok++))
        else
            echo "❌ [$name] 未找到 nats reply 进程，启动可能失败。"
            echo "   可能原因: NATS 服务器未启动、凭证错误，或 '../$script' 不存在/无执行权限。"
            ((fail++))
        fi
    done
    echo "--------------------------------"
    echo "共 ${#SERVICES[@]} 个: 成功 $ok, 失败 $fail"
    (( fail == 0 ))
}

# ---------------------- 主流程 ----------------------
if tmux has-session -t "${SESSION}" 2>/dev/null; then
    echo "⚠️ session [${SESSION}] 已存在，跳过启动，仅检查。"
else
    start_all
    echo "⏳ 等待 ${WAIT}s ..."
    sleep "$WAIT"
fi

check_all
