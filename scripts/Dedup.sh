#!/usr/bin/env bash
#
# dedup_tsv_by_uuid.sh
#
# 扫描指定目录下的所有 .tsv 文件：
#   1. 检查每一行的第一个字段是否是标准 UUID 格式
#      （8-4-4-4-12 十六进制，如 550e8400-e29b-41d4-a716-446655440000）
#   2. 如果第一字段不是 UUID，直接忽略该行（不保留）
#   3. 如果多行的第一字段是相同的 UUID，只保留文件中最后出现的那一行
#      （其余重复行被丢弃，保留行的位置就是它最后一次出现的位置）
#
# 用法:
#   ./dedup_tsv_by_uuid.sh <目录> [选项]
#
# 选项:
#   -r, --recursive     递归扫描子目录（默认只扫描顶层目录）
#   --inplace           直接覆盖原文件（默认生成 *_dedup.tsv 新文件，不覆盖原文件）
#   --suffix <后缀>      自定义输出文件后缀，默认 "_dedup"（仅在非 --inplace 时生效）
#   -h, --help          显示帮助
#
# 示例:
#   ./dedup_tsv_by_uuid.sh ./data
#   ./dedup_tsv_by_uuid.sh ./data -r --inplace
#   ./dedup_tsv_by_uuid.sh ./data --suffix _clean

set -euo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd $SCRIPT_DIR > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

##########################################################

usage() {
    cat >&2 <<EOF
用法: $0 <目录> [选项]

选项:
  -r, --recursive     递归扫描子目录（默认只扫描顶层目录）
  --inplace           直接覆盖原文件（默认生成 *_dedup.tsv 新文件）
  --suffix <后缀>      自定义输出文件后缀，默认 "_dedup"
  -h, --help          显示本帮助
EOF
    exit 1
}

ROOT_DIR=""
RECURSIVE=0
SUFFIX="_dedup"
INPLACE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        -r|--recursive)
            RECURSIVE=1
            shift
        ;;
        --inplace)
            INPLACE=1
            shift
        ;;
        --suffix)
            [[ $# -ge 2 ]] || usage
            SUFFIX="$2"
            shift 2
        ;;
        -h|--help)
            usage
        ;;
        *)
            if [[ -z "$ROOT_DIR" ]]; then
                ROOT_DIR="$1"
            else
                echo "错误: 未知参数 '$1'" >&2
                usage
            fi
            shift
        ;;
    esac
done

[[ -z "$ROOT_DIR" ]] && usage
[[ -d "$ROOT_DIR" ]] || { echo "错误: 目录不存在: $ROOT_DIR" >&2; exit 1; }

# 标准 UUID 正则：8-4-4-4-12 十六进制字符
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

if [[ $RECURSIVE -eq 1 ]]; then
    FIND_ARGS=(-type f -name "*.tsv")
else
    FIND_ARGS=(-maxdepth 1 -type f -name "*.tsv")
fi

FILE_COUNT=0

# 记录本次运行中用过的锁文件，退出时统一清理
declare -A _LOCKS=()

while IFS= read -r -d '' file; do
    FILE_COUNT=$((FILE_COUNT + 1))
    echo "处理: $file"
    d=$(dirname "$file")

    LOCK_FILE="$d/rec.lock"; # echo "${LOCK_FILE} --- Dedup" >> debug.txt
    _LOCKS["$LOCK_FILE"]=1
    {
        tmpfile="$(mktemp "${file}.XXXXXX.tmp")"

        # 第一步: 用 awk 过滤出第一字段是合法 UUID 的行（同时去掉可能的 \r）
        # 第二步: 用 tac + awk '!seen[$1]++' + tac 实现"保留最后一次出现"的去重，
        #         同时保持这些保留行在文件中原本的相对顺序（即最后一次出现的位置）。
        awk -F'\t' -v re="$UUID_RE" '
            {
                gsub(/\r$/, "")          # 去除 Windows 换行符残留的 \r
                if ($1 ~ re) print
            }
        ' "$file" \
            | tac \
            | awk -F'\t' '!seen[$1]++' \
            | tac \
            > "$tmpfile"

        orig_lines=$(wc -l < "$file" || echo 0)
        kept_lines=$(wc -l < "$tmpfile" || echo 0)
        echo "  原始行数: $orig_lines -> 保留行数: $kept_lines (过滤掉非UUID行 + 重复UUID行)"

        if [[ $INPLACE -eq 1 ]]; then
            mv "$tmpfile" "$file"
            echo "  -> 已覆盖原文件: $file"
        else
            outfile="${file%.tsv}${SUFFIX}.tsv"
            mv "$tmpfile" "$outfile"
            echo "  -> 已生成新文件: $outfile"
        fi

    } 9>"$LOCK_FILE"

done < <(find "$ROOT_DIR" -path "*/quiz_bank" -prune -o "${FIND_ARGS[@]}" -print0 2>/dev/null)

cleanup() {
    local l
    for l in "${!_LOCKS[@]}"; do
        rm -f "$l"
    done
}

if [[ $FILE_COUNT -eq 0 ]]; then
    echo "在目录 '$ROOT_DIR' 中未找到任何 .tsv 文件"
else
    echo "完成，共处理 $FILE_COUNT 个文件。"
fi
