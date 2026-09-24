#!/usr/bin/env bash

set -euo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd $SCRIPT_DIR > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

##########################################################

#
# 处理顺序（对每个文件）：
#   1) 换行符归一化：CRLF (Windows)、CR (经典 Mac)、混用的情况，一律转成 LF
#   2) 删除空行
#
# 用法: clean_blank_lines.sh <目录> <TRUE|FALSE>
#   TRUE  : 只含空格/TAB 的行也视为空行并删除
#   FALSE : 只删除纯空行（长度为 0 的行）
#
# 注意：本脚本不加文件锁，需要的话请自行在 process_file 外围添加 flock。
# 依赖：GNU sed / grep / mktemp / chmod（Linux 自带）

# 固定为 C locale：
#  1) [[:blank:]] 只匹配 空格 和 TAB，不会误匹配 UTF-8 下的全角空格等字符
#  2) 文件里有非法 UTF-8 字节时，grep 也不会把它当成二进制文件而漏处理
export LC_ALL=C

usage() {
    echo "用法: $0 <目录> <TRUE|FALSE>" >&2
    echo "  TRUE : 只含空格/TAB 的行也删除" >&2
    echo "  FALSE: 只删除纯空行" >&2
    exit 1
}

log() {
    printf '%s %s\n' "$(date '+%F %T')" "$*" >&2
}

# ------------------------------------------------------------------
# 参数解析
# ------------------------------------------------------------------

ROOT_DIR="${1:?$(usage)}"
SWITCH="${2:-FALSE}"; SWITCH="${SWITCH^^}"   # 转大写，兼容 true / True / TRUE

[[ -d "$ROOT_DIR" ]] || {
    echo "错误: 不是有效目录: $ROOT_DIR" >&2
    exit 1
}

case "$SWITCH" in
    TRUE) BLANK_RE='^[[:blank:]]*$' ;; # 空行 或 仅含空格/TAB 的行
    FALSE) BLANK_RE='^$' ;; # 仅纯空行
    *) echo "错误: 第二个参数必须是 TRUE 或 FALSE, 当前为: $2" >&2; usage ;;
esac

# ------------------------------------------------------------------
# 步骤 1：换行符归一化 —— 把 \r\n 和单独的 \r 都换成 \n
#   sed -z 把整个文件当作一条记录处理，所以能跨“行”匹配 \r\n；
#   文件末尾有没有换行符都保持原样。注意会把整个文件读入内存。
# ------------------------------------------------------------------
normalize_eol() {
    local f="$1"

    # 文件里没有 CR 就不用动
    grep -q $'\r' -- "$f" || return 0

    # 临时文件放在同一目录，保证 mv 是同分区内的原子替换
    local tmp; tmp=$(mktemp "${f}.XXXXXX") || {
        log "无法创建临时文件，跳过: $f"
        return 1
    }

    if ! sed -z 's/\r\n\?/\n/g' -- "$f" > "$tmp"; then
        log "换行符转换失败，保留原文件: $f"
        rm -f "$tmp"
        return 1
    fi

    chmod --reference="$f" "$tmp" 2>/dev/null
    if mv -f "$tmp" "$f"; then
        log "已统一换行符为 LF: $f"
        (( ++normalized ))
    else
        log "替换失败，保留原文件: $f"
        rm -f "$tmp"
        return 1
    fi
}

# ------------------------------------------------------------------
# 步骤 2：删除空行（此时文件已是纯 LF）
# ------------------------------------------------------------------
delete_blank_lines() {
    local f="$1"

    # 先统计空行数；没有空行就不动文件，避免无谓改写
    local removed; removed=$(grep -Ec -- "$BLANK_RE" "$f")
    (( removed > 0 )) || return 0

    local tmp; tmp=$(mktemp "${f}.XXXXXX") || {
        log "无法创建临时文件，跳过: $f"
        return 1
    }

    grep -Ev -- "$BLANK_RE" "$f" > "$tmp"
    local rc=$?
    # grep -v: 0=有输出行, 1=无输出行(文件全是空行，属正常), >=2=出错
    if (( rc > 1 )); then
        log "处理失败(rc=$rc)，保留原文件: $f"
        rm -f "$tmp"
        return 1
    fi

    chmod --reference="$f" "$tmp" 2>/dev/null
    if mv -f "$tmp" "$f"; then
        log "已删除 $removed 个空行: $f"
        (( ++changed ))
    else
        log "替换失败，保留原文件: $f"
        rm -f "$tmp"
        return 1
    fi
}

# ------------------------------------------------------------------
# 处理单个文件：先归一化换行符，再删除空行
# ------------------------------------------------------------------

# 记录本次运行中用过的锁文件，退出时统一清理
declare -A _LOCKS=()

process_file() {
    local f="$1" d
    d=$(dirname "$f")

    local LOCK_FILE="$d/rec.lock"; # echo "${LOCK_FILE} --- Deblank" >> debug.txt
    _LOCKS["$LOCK_FILE"]=1
    {
        flock -w 5 9 || {
            echo "错误：拿不到锁，说明有其他实例在运行！" >&2
            return 1
        }

        normalize_eol "$f" || return 1
        delete_blank_lines "$f" || return 1

    } 9>"$LOCK_FILE"
}

cleanup() {
    local l
    for l in "${!_LOCKS[@]}"; do
        rm -f "$l"
    done
}

# ------------------------------------------------------------------
# 主流程
# ------------------------------------------------------------------
log "目录: $ROOT_DIR, 空白字符行也删除: $SWITCH"

total=0
normalized=0 # 由 normalize_eol 累加：被转换过换行符的文件数
changed=0 # 由 delete_blank_lines 累加：被删除过空行的文件数
failed=0

while IFS= read -r -d '' f; do
    (( ++total ))
    process_file "$f" || (( ++failed ))
done < <(find "$ROOT_DIR" -path "*/quiz_bank" -prune -o -type f -iname '*.tsv' -print0 2>/dev/null)

log "完成: 共扫描 $total 个 TSV 文件, 换行符转换 $normalized 个, 删除空行 $changed 个, 失败 $failed 个"
(( failed == 0 ))
