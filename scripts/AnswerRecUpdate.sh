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

usage() {
    echo "[REC_CORRECT], [REC_INCORRECT], [REC_BLANK], [REC_EBHS] all are needed from ENV" >&2
    exit 1
}

# ENV: REC_CORRECT, REC_INCORRECT, REC_BLANK, REC_EBHS
: ${REC_CORRECT:?$(usage)}
: ${REC_INCORRECT:?$(usage)}
: ${REC_BLANK:?$(usage)}
: ${REC_EBHS:?$(usage)}

# 用 mktemp 在目标文件所在目录下生成唯一临时文件名。
# 原脚本用固定名字 blank.tsv.tmp / correct.tsv.tmp / incorrect.tsv.tmp / ebhs.tsv.tmp：
# - 如果这个脚本被并发调用（比如两个任务同时跑），会互相覆盖临时文件，产生竞态条件；
# - 如果当前工作目录不是文件所在目录，mv 可能失败或者跨文件系统导致非原子操作。
# mktemp 保证文件名唯一，且放在同目录下保证 mv 是原子操作（同文件系统内 rename）。
TMP_BLANK=$(mktemp "$(dirname "$REC_BLANK")/blank.XXXXXX")
TMP_CORRECT=$(mktemp "$(dirname "$REC_CORRECT")/correct.XXXXXX")
TMP_INCORRECT=$(mktemp "$(dirname "$REC_INCORRECT")/incorrect.XXXXXX")
TMP_EBHS=$(mktemp "$(dirname "$REC_EBHS")/ebhs.XXXXXX")

# 注册退出清理：无论脚本正常结束还是中途因 set -e 报错退出，
# 都尝试删除还残留的临时文件，避免磁盘上堆积垃圾文件。
# （正常流程里临时文件会被 mv 掉，届时 rm -f 找不到文件也不会报错。）
cleanup() {
    rm -f "$TMP_BLANK" "$TMP_CORRECT" "$TMP_INCORRECT" "$TMP_EBHS"
}

# 前置校验：检查 correct.tsv / incorrect.tsv 内部是否有重复 ID。
# 之前讨论过，如果同一个 ID 在同一个文件里出现多次，awk 关联数组会静默用后面的行覆盖前面的，
# 不会报错，但结果可能不是你预期的。这里只做告警，不阻断流程，方便事后核查。
check_duplicates() {
    local file="$1" name="$2"
    local dups; dups=$(cut -f1 "$file" | sort | uniq -d)
    [[ -z "$dups" ]] || {
        echo "WARNING: 发现 $name 中存在重复 ID:" >&2
        echo "$dups" >&2
    }
    return 0;
}
check_duplicates "$REC_CORRECT" "REC_CORRECT"
check_duplicates "$REC_INCORRECT" "REC_INCORRECT"

# update REC_CORRECT, REC_INCORRECT, REC_BLANK (all 3 from env) files #
# #########################################################################################

# if correct id exists, and same id exists in blank file, remove it from blank file
awk -F'\t' 'NR==FNR{ids[$1]=1; next} !($1 in ids)' "$REC_CORRECT" "$REC_BLANK" > "$TMP_BLANK" && mv "$TMP_BLANK" "$REC_BLANK"

# if incorrect id exists, and same id exists in blank file, remove it from blank file
: > "$TMP_BLANK"
awk -F'\t' 'NR==FNR{ids[$1]=1; next} !($1 in ids)' "$REC_INCORRECT" "$REC_BLANK" > "$TMP_BLANK" && mv "$TMP_BLANK" "$REC_BLANK"

###########################################################################################

# if ❌
# if correct id exists, and same id exists in incorrect file; IF incorrect id's timestamp is newer than or equal to correct id;
# 1) increment incorrect count by 1/2/3...,
# 2) remove it from correct file.
# 3) remove it from ebhs file.

: > "$TMP_CORRECT"
: > "$TMP_INCORRECT"
: > "$TMP_EBHS"

awk -F'\t' -v OFS='\t' '

# 处理 correct.tsv (第一个文件)
FILENAME == "'"$REC_CORRECT"'" {
    corr_line[$1]   = $0  # 记录该行原始内容(留着最后输出用)
    corr_order[++n] = $1  # 记录出现顺序,方便最后按原顺序输出
    corr_ts[$1]     = $2  # 记录该 ID 的时间戳
    next
}

# 处理 ebhs.tsv (第二个文件)
FILENAME == "'"$REC_EBHS"'" {
	ebhs_line[$1]   = $0  # 记录该行原始内容(留着最后输出用)
    ebhs_order[++m] = $1  # 记录出现顺序,方便最后按原顺序输出
    ebhs_ts[$1]     = $2  # 记录该 ID 的时间戳
	next
}

# 处理 incorrect.tsv (第三个文件)
FILENAME == "'"$REC_INCORRECT"'" {
    id  = $1
    ts  = $2
    cnt = $3
    if (id in corr_ts && ts >= corr_ts[id]) {
        remove[id] = 1   # 标记:这个 ID 要从 correct.tsv/ebhs.tsv 中删除
        cnt += 3         # count 加 3 以便多次重复出现错题
    }
    print id, ts, cnt >> "'"$TMP_INCORRECT"'"
	next
}

END {
    # 按原始顺序输出 correct.tsv,跳过被标记删除的 ID
    for (i = 1; i <= n; i++) {
        id = corr_order[i]
        if (!(id in remove)) {
            print corr_line[id] >> "'"$TMP_CORRECT"'"
        }
    }
    # 按原始顺序输出 ebhs.tsv,跳过被标记删除的 ID
    for (i = 1; i <= m; i++) {
        id = ebhs_order[i]
        if (!(id in remove)) {
            print ebhs_line[id] >> "'"$TMP_EBHS"'"
        }
    }
}
' "$REC_CORRECT" "$REC_EBHS" "$REC_INCORRECT"

mv "$TMP_CORRECT" "$REC_CORRECT"
mv "$TMP_INCORRECT" "$REC_INCORRECT"
mv "$TMP_EBHS" "$REC_EBHS"

###########################################################################################

# if ✅
# if correct id exists, and same id exists in incorrect file; IF correct id's timestamp is strictly newer than incorrect id;
# 1) decrement incorrect count by 1,
# 2) remove it (do not keep) from correct file IF incorrect number still > 0.
# 3) keep it in correct file if incorrect number == 0, then remove the id from incorrect file.
#
# 由于上一步已经把该 ID 从 correct.tsv 中删除，这一步 `id in corr_ts` 会天然为 false，

TMP_CORRECT=$(mktemp "$(dirname "$REC_CORRECT")/correct.XXXXXX")
TMP_INCORRECT=$(mktemp "$(dirname "$REC_INCORRECT")/incorrect.XXXXXX")

: > "$TMP_CORRECT"
: > "$TMP_INCORRECT"

awk -F'\t' -v OFS='\t' '
FNR==NR {
    # 处理 correct.tsv(第一个文件)
    corr_line[$1]   = $0
    corr_order[++n] = $1
    corr_ts[$1]     = $2
    next
}
{
    # 处理 incorrect.tsv(第二个文件)
    id  = $1
    ts  = $2
    cnt = $3

    if (id in corr_ts && corr_ts[id] > ts) {
        # correct 的时间戳比 incorrect 的新 → 命中条件
        newcnt = cnt - 1

        if (newcnt > 0) {
            # count 减到还大于 0:留在 incorrect(更新后的值),但要从 correct 里删掉
            remove_from_correct[id] = 1
            print id, ts, newcnt >> "'"$TMP_INCORRECT"'"
        } else if (newcnt == 0) {
            # count 减到 0:保留在 correct(不动),但要整行从 incorrect 里删掉
            # 这里什么都不打印到 TMP_INCORRECT,相当于跳过这一行
            ;
        } else {
            # newcnt < 0 的异常保护。
            # 正常业务流程下,count 理论上不该减到负数(如果数据一致的话,cnt 至少应该是 1)。
            # 如果出现负数,大概率是脚本被重复执行、或者上游数据本身已经是负数/0,
            # 这里显式打印警告到 stderr, 同时仍然保留该行在 incorrect.tsv 中(不静默丢弃数据),
            # 方便你事后排查，而不是让异常被无声地掩盖掉。
            print "WARNING: id " id " incorrect count 减到负数 (" newcnt "),原始 count=" cnt > "/dev/stderr"
            remove_from_correct[id] = 1
            print id, ts, newcnt >> "'"$TMP_INCORRECT"'"
        }
    } else {
        # 没命中条件,原样保留在 incorrect
        print id, ts, cnt >> "'"$TMP_INCORRECT"'"
    }
}
END {
    # 按原始顺序输出 correct.tsv,跳过被标记删除的 ID
    for (i = 1; i <= n; i++) {
        id = corr_order[i]
        if (!(id in remove_from_correct)) {
            print corr_line[id] >> "'"$TMP_CORRECT"'"
        }
    }
}
' "$REC_CORRECT" "$REC_INCORRECT"

mv "$TMP_CORRECT" "$REC_CORRECT"
mv "$TMP_INCORRECT" "$REC_INCORRECT"
