#!/usr/bin/env bash
# 用法: Group.sh [-c 列号] [-H] [-i] 文件...
#   -i  原地修改文件(会逐个处理每个文件)

col=1
header=0
inplace=0
while getopts "c:Hi" opt; do
    case $opt in
        c) col=${OPTARG} ;;
        H) header=1 ;;
        i) inplace=1 ;;
        *) echo "用法: $0 [-c 列号] [-H] [-i] [文件...]" >&2; exit 1 ;;
    esac
done
shift $((OPTIND - 1))

run_awk() {
    awk -F '\t' -v OFS='\t' -v col="$col" -v header="$header" '
    header && FNR == 1 { print; next }
    {
        key = $col
        if (!(key in cnt)) order[++n] = key
        cnt[key]++
        line[key, cnt[key]] = $0
    }
    END {
        for (i = 1; i <= n; i++) {
            k = order[i]
            for (j = 1; j <= cnt[k]; j++)
                print line[k, j]
        }
    }
    ' "$@"
}

if (( inplace )); then
    [ $# -eq 0 ] && { echo "-i 需要指定文件" >&2; exit 1; }
    for f in "$@"; do
        tmp=$(mktemp "${f}.XXXXXX") || exit 1
        if run_awk "$f" > "$tmp"; then
            # 保留原文件权限
            chmod --reference="$f" "$tmp" 2>/dev/null
            mv "$tmp" "$f"
        else
            rm -f "$tmp"
            echo "处理失败: $f" >&2
        fi
    done
else
    run_awk "$@"
fi

# ./Group.sh -i -c 6 ./AZ-900.tsv
