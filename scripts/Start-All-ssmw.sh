#!/usr/bin/env bash

set -euo pipefail

# ============================================================================
# 单一 tmux session，内部使用多个 window 分别运行各个服务
# ============================================================================

SESSION_NAME="nats-services"
CONFIG_PATH="../config/nats-server.conf"
NATS_PORT=4222 # NATS 默认客户端端口，可根据你的 conf 文件修改

# 窗口名 -> 启动命令 (使用普通数组，保证顺序，兼容性更好)
WINDOW_NAMES=("nats-server" "quiz-list" "quiz-fetch" "answer-record")
WINDOW_CMDS=(
"nats-server -c $CONFIG_PATH"
"nats reply \"quiz-list\" --command=\"./reply_quiz-list.sh\" 2>/dev/null"
"nats reply \"quiz-fetch\" --command=\"./reply_quiz-fetch.sh\" 2>/dev/null"
"nats reply \"answer-record\" --command=\"./reply_answer-record.sh\" 2>/dev/null"
)

echo "正在检查 tmux 会话..."

# 1. 检查是否已经存在同名的 tmux 会话
tmux has-session -t "$SESSION_NAME" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "警告: tmux 会话 '$SESSION_NAME' 已经存在。"
    echo "请先使用 'tmux kill-session -t $SESSION_NAME' 关闭旧会话，或更改脚本中的 SESSION_NAME。"
    exit 1
fi

echo "正在创建 tmux 会话 '$SESSION_NAME' 并依次创建各个 window..."

# 2. 创建 session，同时创建第一个 window (nats-server)
tmux new-session -d -s "$SESSION_NAME" -n "${WINDOW_NAMES[0]}" "${WINDOW_CMDS[0]}"

# 3. 给 nats-server 一点启动初始化的时间，再启动依赖它的 reply 服务
sleep 1.5

# 4. 依次创建剩余的 window
for i in "${!WINDOW_NAMES[@]}"; do
    if [ "$i" -eq 0 ]; then
        continue # 第一个 window 已经在上面创建
    fi
    tmux new-window -t "$SESSION_NAME" -n "${WINDOW_NAMES[$i]}" "${WINDOW_CMDS[$i]}"
done

# 给各个 nats reply 客户端一点连接和启动的时间
sleep 1.5

echo "--------------------------------------------------"
echo "已创建所有 window, 正在逐一检查各服务启动状态..."
echo "--------------------------------------------------"

# ---------------------------------------------------------------------------
# 检查 nats-server
# ---------------------------------------------------------------------------
PID=$(pgrep -f "nats-server -c $CONFIG_PATH")

if [ -n "$PID" ]; then
    echo "✅ [nats-server] 进程检查: nats-server 正在运行! (PID: $PID)"

    if command -v ss &> /dev/null; then
        PORT_CHECK=$(ss -tlnp | grep "$NATS_PORT")
    elif command -v netstat &> /dev/null; then
        PORT_CHECK=$(netstat -tlnp | grep "$NATS_PORT")
    fi

    if [ -n "$PORT_CHECK" ]; then
        echo "✅ [nats-server] 端口检查: 发现端口 $NATS_PORT 正在被监听，服务运行正常。"
    else
        echo "⚠️  [nats-server] 提示: 进程虽然存在，但未探测到端口 $NATS_PORT 的监听状态。"
        echo "   这可能是因为配置文件中更改了默认端口，或者服务正在启动中。"
    fi
else
    echo "❌ [nats-server] 错误: 未找到 nats-server 进程，启动可能失败了。"
fi

# ---------------------------------------------------------------------------
# 检查 reply quiz-list
# ---------------------------------------------------------------------------
PID=$(pgrep -f "nats reply.*quiz-list.*reply_quiz-list.sh")

if [ -n "$PID" ]; then
    echo "✅ [quiz-list] 进程检查: nats reply 响应服务已成功启动并正在运行! (PID: $PID)"
else
    echo "❌ [quiz-list] 错误: 未找到 nats reply 进程，启动可能失败了。"
    echo "   原因分析: 可能是 NATS 服务器未启动、凭证错误、或者 './reply_quiz-list.sh' 找不到/没有执行权限。"
fi

# ---------------------------------------------------------------------------
# 检查 reply quiz-fetch
# ---------------------------------------------------------------------------
PID=$(pgrep -f "nats reply.*quiz-fetch.*reply_quiz-fetch.sh")

if [ -n "$PID" ]; then
    echo "✅ [quiz-fetch] 进程检查: nats reply 响应服务已成功启动并正在运行! (PID: $PID)"
else
    echo "❌ [quiz-fetch] 错误: 未找到 nats reply 进程，启动可能失败了。"
    echo "   原因分析: 可能是 NATS 服务器未启动、凭证错误、或者 './reply_quiz-fetch.sh' 找不到/没有执行权限。"
fi

# ---------------------------------------------------------------------------
# 检查 reply answer-record
# ---------------------------------------------------------------------------
PID=$(pgrep -f "nats reply.*answer-record.*reply_answer-record.sh")

if [ -n "$PID" ]; then
    echo "✅ [answer-record] 进程检查: nats reply 响应服务已成功启动并正在运行! (PID: $PID)"
else
    echo "❌ [answer-record] 错误: 未找到 nats reply 进程，启动可能失败了。"
    echo "   原因分析: 可能是 NATS 服务器未启动、凭证错误、或者 './reply_answer-record.sh' 找不到/没有执行权限。"
fi

echo "--------------------------------------------------"
echo "提示: 你可以运行 'tmux attach -t $SESSION_NAME' 进入会话，"
echo "然后使用 Ctrl-b 加数字键(0,1,2,3) 或 Ctrl-b w 在各个 window 间切换查看日志。"
echo "--------------------------------------------------"
