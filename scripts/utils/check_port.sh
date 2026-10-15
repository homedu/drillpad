#!/usr/bin/env bash
# check_port.sh —— 库文件，用 source 引入，不要直接执行

# 函数已定义则不再重复加载
declare -F check_port >/dev/null && return 0

check_port() {
    local PORT="$1"
    if command -v ss >/dev/null 2>&1; then
        if ss -tuln | awk '{print $5}' | grep -qE "[:.]${PORT}$"; then
            echo "错误：端口 ${PORT} 已被占用！" >&2
            return 1
        fi
    elif command -v lsof >/dev/null 2>&1; then
        if lsof -i :"${PORT}" >/dev/null 2>&1; then
            echo "错误：端口 ${PORT} 已被占用！" >&2
            return 1
        fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -tuln | awk '{print $4}' | grep -qE "[:.]${PORT}$"; then
            echo "错误：端口 ${PORT} 已被占用！" >&2
            return 1
        fi
    else
        echo "错误：找不到 ss / lsof / netstat, 无法检测端口占用情况" >&2
        return 1
    fi
    return 0
}
