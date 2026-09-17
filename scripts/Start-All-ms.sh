#!/usr/bin/env bash

# 定义会话名称和配置文件路径
SESSION_NAME="nats-server"
CONFIG_PATH="../config/nats-server.conf"
NATS_PORT=4222 # NATS 默认客户端端口，可根据你的 conf 文件修改

echo "正在检查 tmux 会话..."

# 1. 检查是否已经存在同名的 tmux 会话
tmux has-session -t "$SESSION_NAME" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "警告: tmux 会话 '$SESSION_NAME' 已经存在。"
    echo "请先使用 'tmux kill-session -t $SESSION_NAME' 关闭旧会话，或更改脚本中的 SESSION_NAME。"
    exit 1
fi

echo "正在启动 tmux 会话并运行 nats-server..."

# 2. 创建一个后台运行的 tmux 会话 (默认就是 detach 状态)
#    并在其中执行启动 nats-server 的命令
tmux new-session -d -s "$SESSION_NAME" "nats-server -c $CONFIG_PATH"

# 给服务一点启动初始化的时间
sleep 1.5

echo "--------------------------------------------------"
echo "已回到父窗口，正在检查 nats-server 启动状态..."
echo "--------------------------------------------------"

# 3. 检查 nats-server 进程是否存在
PID=$(pgrep -f "nats-server -c $CONFIG_PATH")

if [ -n "$PID" ]; then
    echo "✅ 进程检查: nats-server 正在运行! (PID: $PID)"

    # 4. 进一步检查端口是否成功监听 (需要系统安装了 ss 或 netstat)
    if command -v ss &> /dev/null; then
        PORT_CHECK=$(ss -tlnp | grep "$NATS_PORT")
    elif command -v netstat &> /dev/null; then
        PORT_CHECK=$(netstat -tlnp | grep "$NATS_PORT")
    fi

    if [ -n "$PORT_CHECK" ]; then
        echo "✅ 端口检查: 发现端口 $NATS_PORT 正在被监听，服务运行正常。"
    else
        echo "⚠️  提示: 进程虽然存在，但未探测到端口 $NATS_PORT 的监听状态。"
        echo "   这可能是因为配置文件中更改了默认端口，或者服务正在启动中。"
    fi

    echo "提示: 你可以随时运行 'tmux a -t $SESSION_NAME' 进入会话查看详细日志。"
else
    echo "❌ 错误: 未找到 nats-server 进程，启动可能失败了。"
    echo "请尝试运行 'tmux a -t $SESSION_NAME' 查看 tmux 窗口内的错误输出。"
fi

# ############################################################################

# 定义会话名称和要执行的完整命令
SESSION_NAME="reply_quiz-list"
CMD="nats reply \"quiz-list\" --command=\"./reply_quiz-list.sh\" 2>/dev/null"

echo "正在检查 tmux 会话..."

# 1. 检查是否已经存在同名的 tmux 会话
tmux has-session -t "$SESSION_NAME" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "警告: tmux 会话 '$SESSION_NAME' 已经存在。"
    echo "请先运行 'tmux kill-session -t $SESSION_NAME' 关闭旧会话。"
    exit 1
fi

echo "正在后台启动 tmux 会话并运行 nats reply quiz-list..."

# 2. 创建后台 tmux 会话并执行命令 (-d 表示后台运行，不切换屏幕)
tmux new-session -d -s "$SESSION_NAME" "$CMD"

# 给 nats 客户端连接和启动一点初始化时间
sleep 1.5

echo "--------------------------------------------------"
echo "正在检查 nats reply 进程状态..."
echo "--------------------------------------------------"

# 3. 检查进程是否存在
# 使用 pgrep -f 精确匹配命令的关键部分
PID=$(pgrep -f "nats reply.*quiz-list.*reply_quiz-list.sh")

if [ -n "$PID" ]; then
    echo "✅ 进程检查: nats reply 响应服务已成功启动并正在运行!"
    echo "   进程 PID: $PID"
    echo "   Tmux 会话: $SESSION_NAME"
    echo "提示: 你可以随时运行 'tmux a -t $SESSION_NAME' 进入会话查看交互情况。"
else
    echo "❌ 错误: 未找到 nats reply 进程，启动可能失败了。"
    echo "原因分析: 可能是 NATS 服务器未启动、凭证错误、或者 './reply_quiz-list.sh' 找不到/没有执行权限。"
    echo "请尝试运行 'tmux a -t $SESSION_NAME' 查看 tmux 窗口内的错误输出。"
fi

# ############################################################################

# 定义会话名称和要执行的完整命令
SESSION_NAME="reply_quiz-fetch"
CMD="nats reply \"quiz-fetch\" --command=\"./reply_quiz-fetch.sh\" 2>/dev/null"

echo "正在检查 tmux 会话..."

# 1. 检查是否已经存在同名的 tmux 会话
tmux has-session -t "$SESSION_NAME" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "警告: tmux 会话 '$SESSION_NAME' 已经存在。"
    echo "请先运行 'tmux kill-session -t $SESSION_NAME' 关闭旧会话。"
    exit 1
fi

echo "正在后台启动 tmux 会话并运行 nats reply quiz-fetch..."

# 2. 创建后台 tmux 会话并执行命令 (-d 表示后台运行，不切换屏幕)
tmux new-session -d -s "$SESSION_NAME" "$CMD"

# 给 nats 客户端连接和启动一点初始化时间
sleep 1.5

echo "--------------------------------------------------"
echo "正在检查 nats reply 进程状态..."
echo "--------------------------------------------------"

# 3. 检查进程是否存在
# 使用 pgrep -f 精确匹配命令的关键部分
PID=$(pgrep -f "nats reply.*quiz-fetch.*reply_quiz-fetch.sh")

if [ -n "$PID" ]; then
    echo "✅ 进程检查: nats reply 响应服务已成功启动并正在运行!"
    echo "   进程 PID: $PID"
    echo "   Tmux 会话: $SESSION_NAME"
    echo "提示: 你可以随时运行 'tmux a -t $SESSION_NAME' 进入会话查看交互情况。"
else
    echo "❌ 错误: 未找到 nats reply 进程，启动可能失败了。"
    echo "原因分析: 可能是 NATS 服务器未启动、凭证错误、或者 './reply_quiz-fetch.sh' 找不到/没有执行权限。"
    echo "请尝试运行 'tmux a -t $SESSION_NAME' 查看 tmux 窗口内的错误输出。"
fi

# ############################################################################

# 定义会话名称和要执行的完整命令
SESSION_NAME="reply_answer-record"
CMD="nats reply \"answer-record\" --command=\"./reply_answer-record.sh\" 2>/dev/null"

echo "正在检查 tmux 会话..."

# 1. 检查是否已经存在同名的 tmux 会话
tmux has-session -t "$SESSION_NAME" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "警告: tmux 会话 '$SESSION_NAME' 已经存在。"
    echo "请先运行 'tmux kill-session -t $SESSION_NAME' 关闭旧会话。"
    exit 1
fi

echo "正在后台启动 tmux 会话并运行 nats reply answer-record ..."

# 2. 创建后台 tmux 会话并执行命令 (-d 表示后台运行，不切换屏幕)
tmux new-session -d -s "$SESSION_NAME" "$CMD"

# 给 nats 客户端连接和启动一点初始化时间
sleep 1.5

echo "--------------------------------------------------"
echo "正在检查 nats reply 进程状态..."
echo "--------------------------------------------------"

# 3. 检查进程是否存在
# 使用 pgrep -f 精确匹配命令的关键部分
PID=$(pgrep -f "nats reply.*answer-record.*reply_answer-record.sh")

if [ -n "$PID" ]; then
    echo "✅ 进程检查: nats reply 响应服务已成功启动并正在运行!"
    echo "   进程 PID: $PID"
    echo "   Tmux 会话: $SESSION_NAME"
    echo "提示: 你可以随时运行 'tmux a -t $SESSION_NAME' 进入会话查看交互情况。"
else
    echo "❌ 错误: 未找到 nats reply 进程，启动可能失败了。"
    echo "原因分析: 可能是 NATS 服务器未启动、凭证错误、或者 './reply_answer-record.sh' 找不到/没有执行权限。"
    echo "请尝试运行 'tmux a -t $SESSION_NAME' 查看 tmux 窗口内的错误输出。"
fi
