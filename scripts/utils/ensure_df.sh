#!/usr/bin/env bash
# ensure_df.sh —— 库文件，请用 source 引入，不要直接执行

# 函数已定义则不再重复加载
declare -F ensure_file >/dev/null && return 0

# 用法: ensure_file "NAME=路径"
# 要求: = 两侧必须紧挨着，不允许有空白字符
ensure_file() {
    local _ef_arg="$1" _ef_name _ef_path _ef_dir

    # 参数个数检查：ensure_file FILE = path（未加引号）会被拆成 3 个参数
    if [[ $# -ne 1 ]]; then
        echo "错误: 需要且只能有 1 个参数 NAME=路径，且 = 两侧不能有空格（含空格的路径请整体加引号）" >&2
        return 2
    fi

    if [[ "$_ef_arg" != *=* ]]; then
        echo "错误: 参数格式应为 NAME=路径，例如 FILE=../test/abc.txt" >&2
        return 2
    fi

    _ef_name="${_ef_arg%%=*}"
    _ef_path="${_ef_arg#*=}"

    # = 左侧：变量名末尾不能有空白
    if [[ "$_ef_name" =~ [[:space:]]$ ]]; then
        echo "错误: '=' 左侧不能有空白字符: '$_ef_arg'" >&2
        return 2
    fi

    # 校验变量名（同时能拦住开头空白、非法字符）
    if [[ ! "$_ef_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo "错误: 非法的变量名: '$_ef_name'" >&2
        return 2
    fi

    # = 右侧：路径开头结尾不能是空白
    if [[ "$_ef_path" =~ ^[[:space:]]|[[:space:]]$ ]]; then
        echo "错误: '=' 右侧不能有空白字符: '$_ef_arg'" >&2
        return 2
    fi

    # 去掉两端引号
    _ef_path="${_ef_path#[\"\']}"
    _ef_path="${_ef_path%[\"\']}"

    if [[ -z "$_ef_path" ]]; then
        echo "错误: 路径为空" >&2
        return 2
    fi

    # 去引号后再检查一次，防止 FILE=" abc.txt" 这类写法
    if [[ "$_ef_path" =~ ^[[:space:]] ]]; then
        echo "错误: 路径不能以空白字符开头: '$_ef_path'" >&2
        return 2
    fi

    # 不存在才创建
    if [[ ! -e "$_ef_path" ]]; then
        _ef_dir="$(dirname -- "$_ef_path")"
        if ! mkdir -p -- "$_ef_dir" 2>/dev/null; then
            echo "错误: 无法创建目录: $_ef_dir" >&2
            return 1
        fi
        if ! touch -- "$_ef_path" 2>/dev/null; then
            echo "错误: 无法创建文件: $_ef_path" >&2
            return 1
        fi
    fi

    printf -v "$_ef_name" '%s' "$_ef_path"
}

# 函数已定义则不再重复加载
declare -F ensure_dir >/dev/null && return 0

# 用法: ensure_dir NAME=目录路径
# 作用: 1) 目录不存在则创建（含父目录）；已存在则不动
#       2) 成功后在当前 shell 中执行 NAME=目录路径
# 要求: = 两侧必须紧挨着，不允许有空白字符
ensure_dir() {
    local _ed_arg="$1" _ed_name _ed_path

    # 参数个数检查：ensure_dir DIR = path（未加引号）会被拆成 3 个参数
    if [[ $# -ne 1 ]]; then
        echo "错误: 需要且只能有 1 个参数 NAME=路径，且 = 两侧不能有空格（含空格的路径请整体加引号）" >&2
        return 2
    fi

    if [[ "$_ed_arg" != *=* ]]; then
        echo "错误: 参数格式应为 NAME=路径，例如 DIR=../test/out" >&2
        return 2
    fi

    _ed_name="${_ed_arg%%=*}"
    _ed_path="${_ed_arg#*=}"

    # = 左侧：变量名末尾不能有空白
    if [[ "$_ed_name" =~ [[:space:]]$ ]]; then
        echo "错误: '=' 左侧不能有空白字符: '$_ed_arg'" >&2
        return 2
    fi

    # 校验变量名
    if [[ ! "$_ed_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo "错误: 非法的变量名: '$_ed_name'" >&2
        return 2
    fi

    # = 右侧：路径开头不能是空白
    if [[ "$_ed_path" =~ ^[[:space:]] ]]; then
        echo "错误: '=' 右侧不能有空白字符: '$_ed_arg'" >&2
        return 2
    fi

    if [[ -z "$_ed_path" ]]; then
        echo "错误: 路径为空" >&2
        return 2
    fi

    # 已存在的情况
    if [[ -e "$_ed_path" ]]; then
        if [[ ! -d "$_ed_path" ]]; then
            echo "错误: 路径已存在但不是目录: $_ed_path" >&2
            return 1
        fi
    else
        if ! mkdir -p -- "$_ed_path" 2>/dev/null; then
            echo "错误: 无法创建目录: $_ed_path" >&2
            return 1
        fi
    fi

    # 在调用者的 shell 中给变量赋值
    printf -v "$_ed_name" '%s' "$_ed_path"
}

# 函数已定义则不再重复加载
declare -F require_file >/dev/null && return 0
declare -F require_dir >/dev/null && return 0
declare -F require_path >/dev/null && return 0

# 内部实现: _require_impl 类型 NAME=路径
#   类型: file(普通文件) | dir(目录) | any(文件或目录)
# 只有路径存在且可访问，才会在当前 shell 中执行 NAME=路径；否则报错并返回非 0，不赋值
_require_impl() {
    local _rq_kind="$1" _rq_arg="$2" _rq_name _rq_path

    # $# 包含类型参数，所以应为 2
    if [[ $# -ne 2 ]]; then
        echo "错误: 需要且只能有 1 个参数 NAME=路径，且 = 两侧不能有空格（含空格的路径请整体加引号）" >&2
        return 2
    fi

    if [[ "$_rq_arg" != *=* ]]; then
        echo "错误: 参数格式应为 NAME=路径，例如 CONF=./app.conf" >&2
        return 2
    fi

    _rq_name="${_rq_arg%%=*}"
    _rq_path="${_rq_arg#*=}"

    if [[ "$_rq_name" =~ [[:space:]]$ ]]; then
        echo "错误: '=' 左侧不能有空白字符: '$_rq_arg'" >&2
        return 2
    fi

    if [[ ! "$_rq_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo "错误: 非法的变量名: '$_rq_name'" >&2
        return 2
    fi

    if [[ "$_rq_path" =~ ^[[:space:]] ]]; then
        echo "错误: '=' 右侧不能有空白字符: '$_rq_arg'" >&2
        return 2
    fi

    if [[ -z "$_rq_path" ]]; then
        echo "错误: 路径为空" >&2
        return 2
    fi

    # 存在性（悬空符号链接也算不存在）
    if [[ ! -e "$_rq_path" ]]; then
        echo "错误: 路径不存在: $_rq_path" >&2
        return 1
    fi

    # 类型与可访问性检查
    case "$_rq_kind" in
        file)
            if [[ ! -f "$_rq_path" ]]; then
                echo "错误: 不是普通文件: $_rq_path" >&2
                return 1
            fi
            if [[ ! -r "$_rq_path" ]]; then
                echo "错误: 文件不可读: $_rq_path" >&2
                return 1
            fi
        ;;
        dir)
            if [[ ! -d "$_rq_path" ]]; then
                echo "错误: 不是目录: $_rq_path" >&2
                return 1
            fi
            if [[ ! -r "$_rq_path" || ! -x "$_rq_path" ]]; then
                echo "错误: 目录不可访问（需要读和执行权限）: $_rq_path" >&2
                return 1
            fi
        ;;
        any)
            if [[ -d "$_rq_path" ]]; then
                if [[ ! -r "$_rq_path" || ! -x "$_rq_path" ]]; then
                    echo "错误: 目录不可访问（需要读和执行权限）: $_rq_path" >&2
                    return 1
                fi
            elif [[ ! -r "$_rq_path" ]]; then
                echo "错误: 文件不可读: $_rq_path" >&2
                return 1
            fi
        ;;
        *)
            echo "内部错误: 未知类型 '$_rq_kind'" >&2
            return 2
        ;;
    esac

    # 全部通过，才在调用者的 shell 中赋值
    printf -v "$_rq_name" '%s' "$_rq_path"
}

require_file() { _require_impl file "$@"; } # 必须是可读的普通文件
require_dir() { _require_impl dir  "$@"; } # 必须是可读可进入的目录
require_path() { _require_impl any  "$@"; } # 文件或目录均可
