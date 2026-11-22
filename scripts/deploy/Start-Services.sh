#!/usr/bin/env bash

set -uo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd ${SCRIPT_DIR} > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

source "../utils/check_port.sh"
source "../utils/trap_ex.sh"

##########################################################

export __ALLOWED_BY_START_SERVICES__="true"
defer_trap 'unset __ALLOWED_BY_START_SERVICES__' EXIT

##########################################################

# ============================================================================
# 单一 tmux session，内部使用多个 window 分别运行各个服务
# ============================================================================

SESSION_NAME="qdp-services"

CONFIG_PATH="../../config/nats-server.conf"
NATS_PORT=4222 # NATS 默认客户端端口，根据 conf 文件修改
NATS_WS_PORT=9222 # NATS WS 端口，根据 conf 文件修改

check_port "${NATS_PORT}" || {
    echo "❌ 请先释放端口 ${NATS_PORT} 后再运行本脚本，或者修改脚本中的 NATS_PORT 变量" >&2
    exit 1
}
check_port "${NATS_WS_PORT}" || {
    echo "❌ 请先释放端口 ${NATS_WS_PORT} 后再运行本脚本，或者修改脚本中的 NATS_WS_PORT 变量" >&2
    exit 1
}

# 窗口名 -> 启动命令 (使用普通数组，保证顺序，兼容性更好)
WINDOW_NAMES=(
"nats-server"
"ebbinghaus"
"upload-server"
)
WINDOW_CMDS=(
"nats-server -c ${CONFIG_PATH}"
"../EbbinghausRec.sh ../users/ 30"  # running *.sh with PWD step into its file directory, args should be relative to *.sh
"../../web/service_upload/svr-upload"
)

echo "正在检查 tmux 会话..."

# 1. 检查是否已经存在同名的 tmux 会话
tmux has-session -t "${SESSION_NAME}" 2>/dev/null

[[ $? -eq 0 ]] && {
    echo "❌ 警告: tmux 会话 '${SESSION_NAME}' 已经存在。"
    echo "请先使用 'tmux kill-session -t ${SESSION_NAME}' 关闭旧会话，或更改脚本中的 SESSION_NAME。"
    exit 1
}

echo "正在创建 tmux 会话 '${SESSION_NAME}' 并依次创建各个 window..."

# 2. 创建 session，同时创建第一个 window (nats-server)
tmux new-session -d -s "${SESSION_NAME}" -n "${WINDOW_NAMES[0]}" "${WINDOW_CMDS[0]}"

# 3. 给 nats-server 一点启动初始化的时间，再启动依赖它的 reply 服务
sleep 2

# 4. 依次创建剩余的 window
for i in "${!WINDOW_NAMES[@]}"; do
    if [[ "$i" -eq 0 ]]; then
        continue # 第一个 window 已经在上面创建
    fi
    tmux new-window -t "${SESSION_NAME}" -n "${WINDOW_NAMES[$i]}" "${WINDOW_CMDS[$i]}"
done

# 给各个 nats reply 客户端一点连接和启动的时间
sleep 2

echo "--------------------------------------------------"
echo "已创建所有 window, 正在逐一检查各服务启动状态..."
echo "--------------------------------------------------"

# ---------------------------------------------------------------------------
# 检查 nats-server
# ---------------------------------------------------------------------------
PID=$(pgrep -f "nats-server -c ${CONFIG_PATH}")
PID=$(printf '%s' "${PID}" | tr '\n' ' ' | tr -s ' ')

if [[ -n "${PID}" ]]; then
    echo "✅ [nats-server] 进程检查: nats-server 正在运行! (PID: ${PID})"

    if command -v ss &> /dev/null; then
        PORT_CHECK=$(ss -tlnp | grep "${NATS_PORT}")
        PORT_CHECK_WS=$(ss -tlnp | grep "${NATS_WS_PORT}")
    elif command -v netstat &> /dev/null; then
        PORT_CHECK=$(netstat -tlnp | grep "${NATS_PORT}")
        PORT_CHECK_WS=$(netstat -tlnp | grep "${NATS_WS_PORT}")
    fi

    if [[ -n "${PORT_CHECK}" && -n "${PORT_CHECK_WS}" ]]; then
        echo "✅ [nats-server] 端口检查: 端口 ${NATS_PORT} 和 ${NATS_WS_PORT} 正在被监听，服务运行正常。"
    else
        echo "⚠️  [nats-server] 提示: 进程虽然存在，但未探测到端口 ${NATS_PORT} 或 ${NATS_WS_PORT} 的监听状态。"
        echo "     可能是配置文件中更改了默认端口，或服务正在启动中。"
    fi
else
    echo "❌ [nats-server] 错误: 未找到 nats-server 进程，启动失败。"
fi

# ---------------------------------------------------------------------------
# 检查 EbbinghausRec
# ---------------------------------------------------------------------------
PID=$(pgrep -f "EbbinghausRec")
PID=$(printf '%s' "${PID}" | tr '\n' ' ' | tr -s ' ')

if [[ -n "${PID}" ]]; then
    echo "✅ [EbbinghausRec] 进程检查: EbbinghausRec.sh 响应服务已成功启动并正在运行! (PID: ${PID})"
else
    echo "❌ [EbbinghausRec] 错误: 未找到 EbbinghausRec 进程，启动可能失败了。"
    echo "   原因分析: 可能是 './EbbinghausRec.sh' 找不到/没有执行权限。"
fi

# ---------------------------------------------------------------------------
# 检查 svr-upload
# ---------------------------------------------------------------------------
PID=$(pgrep -f "svr-upload")
PID=$(printf '%s' "${PID}" | tr '\n' ' ' | tr -s ' ')

if [[ -n "${PID}" ]]; then
    echo "✅ [svr-upload] 进程检查: svr-upload 响应服务已成功启动并正在运行! (PID: ${PID})"
else
    echo "❌ [svr-upload] 错误: 未找到 svr-upload 进程，启动可能失败了。"
    echo "   原因分析: 可能是 svr-upload 找不到/没有执行权限。"
fi

# ---------------------------------------------------------------------------
# 运行 及 检查 replies
# ---------------------------------------------------------------------------

./Start-Reply.sh

echo "--------------------------------------------------"
echo "提示: 运行 'tmux attach -t ${SESSION_NAME}' 进入会话，"
echo "然后使用 Ctrl-b 加数字键(0,1,2,3) 或 Ctrl-b w 在各个 window 间切换查看日志。"
echo "--------------------------------------------------"
