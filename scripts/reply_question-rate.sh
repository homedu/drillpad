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
    RATING=$(jq -r '.rating' <<< "${PARAM}")

    require_dir DIR_USER="../users/${CUR_USER}" || {
        echo "error: user does not exist: ${DIR_USER}"
        exit 1
    }

    ensure_file QUESTION_RATING_FILE="${DIR_USER}/rating/${QUIZ}.tsv" || { echo $?; exit 1;}

    tmp=$(mktemp "${QUESTION_RATING_FILE}.XXXXXX")
    defer_trap 'rm -f "$tmp"' EXIT

    awk -v OFS='\t' -v qid="${QID}" -v rating="${RATING}" '
        BEGIN {
            found = 0
        }

        $1 == qid {
            found = 1

            print qid, rating
        }
        $1 != qid {
            print $0
        }

        END {
            if (!found) {
                print qid, rating
            }
        }
    ' "${QUESTION_RATING_FILE}" > "$tmp" && mv "$tmp" "${QUESTION_RATING_FILE}"

    jq -n --arg t "${CURRENT_TIME}" --arg s "success" --arg id "${QID}" '{ time: $t, status: $s, question_id: $id }'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "${PARAM} ${CURRENT_TIME} - DO NOTHING, Accept JSON with 'user', 'quiz', 'qid' and 'rating' fields"

fi
