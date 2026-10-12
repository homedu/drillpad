#!/usr/bin/env bash
# trim.sh —— 库文件，用 source 引入，不要直接执行

# 函数已定义则不再重复加载
declare -F trim_inplace >/dev/null && return 0

trim_inplace() {
    shopt -s extglob
    # $1 是变量的名字（不带$），$2 是要裁剪的字符
    local -n ref="$1"
    local chars="${2:-[[:space:]]}"

    ref="${ref##+($chars)}"
    ref="${ref%%+($chars)}"
}
