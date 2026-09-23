#!/usr/bin/env bash

set -uo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd $SCRIPT_DIR > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

##########################################################

# ============================================================================
# 停止脚本：显式 kill 掉各个 qdp 相关进程（不能只依赖 tmux kill-server / kill-session，
# 因为 qdp-server 把 SIGHUP 当作"重载配置"信号处理，收到 tmux 关闭 pty 时发出的
# SIGHUP 并不会退出，会变成孤儿进程残留）
# ============================================================================

SESSION_NAME="qdp-services"
CONFIG_PATH="../../config/nats-server.conf"

# 需要精确匹配的进程特征（和启动脚本里 pgrep -f 用的一致）
PATTERNS=(
"nats-server -c $CONFIG_PATH"
"nats reply.*quiz-list.*reply_quiz-list.sh"
"nats reply.*quiz-fetch.*reply_quiz-fetch.sh"
"nats reply.*answer-record.*reply_answer-record.sh"
"EbbinghausRec"
)

echo "--------------------------------------------------"
echo "正在清理 tmux 会话 '$SESSION_NAME' ..."
tmux kill-session -t "$SESSION_NAME" 2>/dev/null
tmux kill-server 2>/dev/null
echo "--------------------------------------------------"

# 给进程一点优雅退出的时间
sleep 2

echo "正在停止 qdp 相关进程..."

for pattern in "${PATTERNS[@]}"; do
    PIDS=$(pgrep -f "$pattern")
    if [[ -n "$PIDS" ]]; then
        echo "  -> 匹配到进程 [$pattern], PID: $PIDS, 发送 SIGTERM..."
        kill $PIDS 2>/dev/null
    else
        echo "  -> 未发现匹配 [$pattern] 的进程，跳过。"
    fi
done

# 给进程一点优雅退出的时间
sleep 2

# 二次检查，如果 SIGTERM 没杀掉（比如忽略了 TERM），用 -9 强杀
for pattern in "${PATTERNS[@]}"; do
    PIDS=$(pgrep -f "$pattern")
    if [[ -n "$PIDS" ]]; then
        echo "  -> [$pattern] 仍在运行 (PID: $PIDS)，强制 kill -9..."
        kill -9 $PIDS 2>/dev/null
    else
        echo "  -> 未发现匹配 [$pattern] 的进程。"
    fi
done

echo "完成。当前残留检查:"
ps -A | grep -E "nats-server|nats reply|EbbinghausRec" | grep -v grep || echo "  (无残留进程，清理干净)"
