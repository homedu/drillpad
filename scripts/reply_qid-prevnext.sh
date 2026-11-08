#!/usr/bin/env bash

set -euo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd ${SCRIPT_DIR} > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

source "./utils/path_assign.sh"
source "./utils/trap_ex.sh"

##########################################################

PARAM="${NATS_REQUEST_BODY:-${1:-}}"

# 如果 PARAM 是一个存在的文件路径，就读取该文件的内容
[[ -f "${PARAM}" ]] && PARAM=$(cat "${PARAM}")

# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "${PARAM}" >/dev/null 2>&1; then

    # CUR_USER should be extract from token
    CUR_USER=$(jq -r '.user' <<< "${PARAM}")
    QUIZ=$(jq -r '.quiz' <<< "${PARAM}")
    QID=$(jq -r '.qid' <<< "${PARAM}")
    ensure_file QUIZ_FILE="../users/${CUR_USER}/quiz_bank/${QUIZ}.tsv"

    # awk 只输出 5 个以 tab 分隔的字段: 目标ID 目标行号 上一行ID 上一行号 下一行ID 下一行号
    RESULT=$(awk -F'\t' -v target="$QID" '
    BEGIN {
        FS = OFS = "\t"
    }
    {
        sub(/\r$/, "")                 # 去掉可能的 CRLF
        split($0, f, "\t"); id = f[1]
        ids[NR] = id
        if (!found && id == target) { target_idx = NR; found = 1 }
    }
    END {
        if (!found)  { print "NOTFOUND"; exit }
        prev_idx = (target_idx > 1)  ? target_idx - 1 : NR
        next_idx = (target_idx < NR) ? target_idx + 1 : 1
        print ids[target_idx], target_idx, ids[prev_idx], prev_idx, ids[next_idx], next_idx
    }' "$QUIZ_FILE")

    if [[ -z "$RESULT" ]] || [[ "$RESULT" = "NOTFOUND" ]]; then
        jq -n --arg t "$QID" '{ success: false, status: "not found", error: ("NOTFOUND: " + $t)}'
        exit 1
    fi

    echo "${RESULT}" | jq -R '
    split("\t") as $p |
    {
        success: true,
        status: "found",
        target: { id: $p[0], line: ($p[1] | tonumber) },
        prev:   { id: $p[2], line: ($p[3] | tonumber) },
        next:   { id: $p[4], line: ($p[5] | tonumber) }
    }'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "${PARAM} ${CURRENT_TIME} - DO NOTHING, Accept JSON with 'user', 'quiz' and 'qid' fields"

fi
