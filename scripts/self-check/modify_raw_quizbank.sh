#!/usr/bin/env bash
# 用法: ./replace_tsv.sh <目录>

DIR="${1:-}"
[[ -n "$DIR" && -d "$DIR" ]] || { echo "用法: $0 <目录>" >&2; exit 1; }

count=0
while IFS= read -r -d '' f; do
    tmp=$(mktemp) || exit 1

    awk -F'\t' -v OFS='\t' '
    {
        # 只处理中间字段（第2个到倒数第2个），即两侧都有制表符的字段
        for (i = 2; i < NF; i++) {
            if      ($i == "MCSA") $i = "SS"
            else if ($i == "FILL") $i = "FI"
        }
        print
    }' "$f" > "$tmp"

    # 内容有变化才写回；用 cat 覆盖写入，保留原文件的权限和属主
    if ! cmp -s "$f" "$tmp"; then
        cat "$tmp" > "$f"
        echo "已处理: $f"
        ((count++))
    fi
    rm -f "$tmp"
done < <(find "$DIR" -type f -iname '*.tsv' -print0)

echo "完成，共修改 $count 个文件"
