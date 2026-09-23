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

# [[ "$#" -eq 3 ]] || {
#     echo "error: must give 3 arguments!"
#     echo "usage: $0 <record-correct> <record-incorrect> <record-blank>; Also ENV [IDS_CORRECT] [IDS_INCORRECT] [IDS_BLANK]"
#     exit 1
# }

usage() {
    echo "usage: $0 <correct.tsv> <incorrect.tsv> <blank.tsv>; ENV: [IDS_CORRECT] [IDS_INCORRECT] [IDS_BLANK]" >&2
    exit 1
}

# arg
REC_CORRECT="${1:?$(usage)}"
REC_INCORRECT="${2:?$(usage)}"
REC_BLANK="${3:?$(usage)}"

[ -f "$REC_CORRECT" ] || touch "$REC_CORRECT"
[ -f "$REC_INCORRECT" ] || touch "$REC_INCORRECT"
[ -f "$REC_BLANK" ] || touch "$REC_BLANK"

# env
declare -a IDS_CORRECT=($IDS_CORRECT)
declare -a IDS_INCORRECT=($IDS_INCORRECT)
declare -a IDS_BLANK=($IDS_BLANK)

ts=$(date '+%Y-%m-%d %H:%M:%S')

# # echo "--- IDS_CORRECT ---"
# for item in "${IDS_CORRECT[@]}"; do
# # [quiz id] [last timestamp] (if same id, ignore recording)
# echo "$item" >> $REC_CORRECT
# done

# # echo "--- IDS_INCORRECT ---"
# for item in "${IDS_INCORRECT[@]}"; do
# # [quiz id]	[repeated count]	[last timestamp] (if same id, update repeated count & last timestamp)
# echo "$item" >> $REC_INCORRECT
# done

# # echo "--- IDS_BLANK ---"
# for item in "${IDS_BLANK[@]}"; do
# # [quiz id] (if same id, ignore recording)
# echo "$item" >> $REC_BLANK
# done

#
########################################################################
# record CORRECT

# 把待处理数组转成多行文本，交给 awk 一次性处理
ids_str=$(printf '%s\n' "${IDS_CORRECT[@]}")

awk -v ts="$ts" -v ids_str="$ids_str" '
    BEGIN {
        FS = OFS = "\t"
        n = split(ids_str, arr, "\n")
        for (i = 1; i <= n; i++) {
            if (arr[i] == "") continue
            want[arr[i]] = 1   # 本次想要记录的 UUID 清单
        }
    }
    {
        # 文件里已存在的行，原样输出，并从 want 中去掉（说明已存在，不需要再追加）
        print
        if ($1 in want) delete want[$1]
    }
    END {
        # 剩下 want 里还留着的，就是原文件里没有的，需要追加
        for (uuid in want) print uuid, ts, "1 day"       # 1, 2, 4, 7, 15, 30;  艾宾浩斯遗忘曲线经典的黄金复习时间间隔
    }
' "$REC_CORRECT" > "${REC_CORRECT}.tmp" && mv "${REC_CORRECT}.tmp" "$REC_CORRECT"

#
########################################################################
# record INCORRECT

# 1. 先在 bash 里对数组做去重计数，得到 uuid -> 本次出现次数
declare -A incr
for item in "${IDS_INCORRECT[@]}"; do
    incr["$item"]=$(( ${incr["$item"]:-0} + 1 ))
done

# 2. 把 uuid + 增量 拼成 "uuid\tcount" 的多行文本，交给 awk 一次性处理
incr_list=""
for uuid in "${!incr[@]}"; do
    incr_list+="${uuid}"$'\t'"${incr[$uuid]}"$'\n'
done

awk -v ts="$ts" -v incr_str="$incr_list" '
    BEGIN {
        FS = OFS = "\t"
        n = split(incr_str, lines, "\n")
        for (i = 1; i <= n; i++) {
            if (lines[i] == "") continue
            split(lines[i], f, "\t")
            add[f[1]] = f[2] + 2      # 记录每个 uuid 本次要增加的次数,  +2 is for more future appearing !!!
        }
    }
    {
        if ($1 in add) {
            $2 = ts
            $3 = $3 + add[$1]
            seen[$1] = 1
        }
        print
    }
    END {
        for (uuid in add) {
            if (!(uuid in seen)) {
                print uuid, ts, add[uuid]
            }
        }
    }
' "$REC_INCORRECT" > "${REC_INCORRECT}.tmp" && mv "${REC_INCORRECT}.tmp" "$REC_INCORRECT"

#
########################################################################
# record BLANK

# 把待处理数组转成多行文本，交给 awk 一次性处理
ids_str=$(printf '%s\n' "${IDS_BLANK[@]}")

awk -v ids_str="$ids_str" '
    BEGIN {
        FS = OFS = "\t"
        n = split(ids_str, arr, "\n")
        for (i = 1; i <= n; i++) {
            if (arr[i] == "") continue
            want[arr[i]] = 1   # 本次想要记录的 UUID 清单
        }
    }
    {
        # 文件里已存在的行，原样输出，并从 want 中去掉（说明已存在，不需要再追加）
        print
        if ($1 in want) delete want[$1]
    }
    END {
        # 剩下 want 里还留着的，就是原文件里没有的，需要追加
        for (uuid in want) print uuid
    }
' "$REC_BLANK" > "${REC_BLANK}.tmp" && mv "${REC_BLANK}.tmp" "$REC_BLANK"

#
########################################################################
# Update Answer Record Files

# ENV for ./AnswerRecUpdate.sh
export REC_CORRECT
export REC_INCORRECT
export REC_BLANK

./AnswerRecUpdate.sh
