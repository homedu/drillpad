#!/usr/bin/env bash
# trap_ex.sh —— 库文件，请用 source 引入，不要直接执行

# 函数已定义则不再重复加载
declare -F append_trap >/dev/null && return 0
declare -F defer_trap >/dev/null && return 0

# append_trap() {
#     local cmd="$1"
#     local sig="$2"
#     # 获取已经注册的 trap 命令
#     local existing_trap
#     existing_trap=$(trap -p "$sig" | cut -d"'" -f2)

#     # 如果之前有 trap，就用分号拼上新命令；如果没有，就直接设为新命令
#     if [[ -n "$existing_trap" ]]; then
#         trap "${existing_trap}; ${cmd}" "$sig"
#     else
#         trap "${cmd}" "$sig"
#     fi
# }

append_trap() {
    local cmd="$1" sig="$2"
    local existing_trap=""

    _get_trap() { existing_trap="$3"; }
    eval "_get_trap $(trap -p "$sig")"
    unset -f _get_trap

    if [[ -n "$existing_trap" ]]; then
        trap -- "${existing_trap}; ${cmd}" "$sig"
    else
        trap -- "${cmd}" "$sig"
    fi
}

defer_trap() {
    local cmd="$1" sig="$2"
    local existing_trap=""

    # 用一个临时函数接收 trap -p 的输出：trap -- 'cmd' SIG
    _get_trap() { existing_trap="$3"; }
    eval "_get_trap $(trap -p "$sig")"
    unset -f _get_trap

    if [[ -n "$existing_trap" ]]; then
        trap -- "${cmd}; ${existing_trap}" "$sig"
    else
        trap -- "${cmd}" "$sig"
    fi
}
