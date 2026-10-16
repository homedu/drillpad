#!/usr/bin/env bash
# 按 ID / PID / NID 的链接关系,把相关行排成连续的块
# 用法: Chain.sh [选项] [文件...]
#   -I N     ID  所在列号(默认 1)
#   -P N     PID 所在列号(默认 2)
#   -N N     NID 所在列号(默认 3)
#   -c a,b,c 一次指定 ID,PID,NID 三列
#   -S N     GUID 尾部匹配长度(默认 12,0 表示关闭尾部匹配)
#   -H       第一行是表头,原样保留在最前面
#   -i       原地修改文件(需要指定文件)
#   -h       显示帮助

idc=1; pidc=2; nidc=3
suffix=12
header=0
inplace=0

usage() {
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit "${1:-1}"
}

is_pos_int() { [[ $1 =~ ^[1-9][0-9]*$ ]]; }

while getopts "I:P:N:c:S:Hih" opt; do
    case $opt in
        I) idc=$OPTARG ;;
        P) pidc=$OPTARG ;;
        N) nidc=$OPTARG ;;
        c) IFS=',' read -r idc pidc nidc <<< "$OPTARG" ;;
        S) suffix=$OPTARG ;;
        H) header=1 ;;
        i) inplace=1 ;;
        h) usage 0 ;;
        *) usage 1 ;;
    esac
done
shift $((OPTIND - 1))

for v in "$idc" "$pidc" "$nidc"; do
    is_pos_int "$v" || { echo "错误: 列号必须是正整数,收到: '$v'" >&2; exit 1; }
done
if [ "$idc" = "$pidc" ] || [ "$idc" = "$nidc" ] || [ "$pidc" = "$nidc" ]; then
    echo "错误: ID/PID/NID 三个列号不能相同 ($idc,$pidc,$nidc)" >&2
    exit 1
fi
[[ $suffix =~ ^[0-9]+$ ]] || { echo "错误: -S 必须是非负整数,收到: '$suffix'" >&2; exit 1; }

run_awk() {
    awk -F '\t' -v OFS='\t' \
        -v ci="$idc" -v cp="$pidc" -v cn="$nidc" \
        -v sl="$suffix" -v header="$header" '

        # 是否为标准 GUID: 8-4-4-4-12, 共 36 字符
        function is_guid(s) {
            return length(s) == 36 && s ~ /^[0-9A-Fa-f-]+$/ &&
                   substr(s, 9, 1) == "-" && substr(s, 14, 1) == "-" &&
                   substr(s, 19, 1) == "-" && substr(s, 24, 1) == "-"
        }

        # 把 PID/NID 引用解析成行号: 先完整相等, 再(仅当长度恰为 sl 的十六进制串)按 GUID 尾部匹配
        # 找不到返回 0; 尾部匹配有歧义返回 -1
        function resolve(ref) {
            if (ref in pos) return pos[ref]
            if (sl > 0 && length(ref) == sl && ref ~ /^[0-9A-Fa-f]+$/) {
                t = tolower(ref)
                if (t in amb)  return -1
                if (t in tail) return tail[t]
            }
            return 0
        }

        function walk(j) {
            while (j && !done[j]) {
                print line[j]
                done[j] = 1
                j = (j in nxt) ? nxt[j] : 0
            }
        }

        header && FNR == 1 { print; next }

        {
            n++
            line[n] = $0
            pid[n]  = $cp
            nid[n]  = $cn
            id = $ci
            if (id != "") {
                if (id in pos) print "警告: ID 重复: " id > "/dev/stderr"
                pos[id] = n
                if (sl > 0 && is_guid(id)) {
                    t = tolower(substr(id, length(id) - sl + 1))
                    if (t in tail) amb[t] = 1       # 尾部相同的多个 GUID, 标记歧义
                    else tail[t] = n
                }
            }
        }

        END {
            # NID 优先建立后继关系
            for (i = 1; i <= n; i++) {
                if (nid[i] == "") continue
                r = resolve(nid[i])
                if (r > 0)       { nxt[i] = r; hasprev[r] = 1 }
                else if (r == 0) print "警告: 第" i "行 NID 找不到: " nid[i] > "/dev/stderr"
                else             print "警告: 第" i "行 NID 尾部匹配有多个 GUID,无法确定: " nid[i] > "/dev/stderr"
            }
            # PID 补充
            for (i = 1; i <= n; i++) {
                if (pid[i] == "") continue
                r = resolve(pid[i])
                if (r > 0) {
                    if (!(r in nxt)) nxt[r] = i
                    hasprev[i] = 1
                }
                else if (r == 0) print "警告: 第" i "行 PID 找不到: " pid[i] > "/dev/stderr"
                else             print "警告: 第" i "行 PID 尾部匹配有多个 GUID,无法确定: " pid[i] > "/dev/stderr"
            }

            # 从每个链头开始输出
            for (i = 1; i <= n; i++)
                if (!(i in hasprev)) walk(i)

            # 兜底: 环状引用等
            for (i = 1; i <= n; i++)
                if (!done[i]) {
                    print "警告: 第" i "行处于环或异常链中" > "/dev/stderr"
                    walk(i)
                }
        }
        ' "$@"
}

if (( inplace )); then
    [ $# -eq 0 ] && { echo "-i 需要指定文件" >&2; exit 1; }
    for f in "$@"; do
        tmp=$(mktemp "${f}.XXXXXX") || exit 1
        if run_awk "$f" > "$tmp"; then
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

# ./Chain.sh -I 2 -P 5 -N 6 data.tsv     # 分别指定三列
# ./Chain.sh -c 2,5,6 data.tsv           # 同上,一次指定
