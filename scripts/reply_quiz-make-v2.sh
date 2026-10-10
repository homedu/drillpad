#!/usr/bin/env bash

set -euo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd $SCRIPT_DIR > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

source "./utils/path_assign.sh"
source "./utils/trap_ex.sh"

##########################################################

# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# 请求内容在 stdin 中也可以通过环境变量拿到
PARAM="${NATS_REQUEST_BODY:-${1:-}}"

# 如果 PARAM 是一个存在的文件路径，就读取该文件的内容
[[ -f "$PARAM" ]] && PARAM=$(cat "$PARAM")

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "$PARAM" >/dev/null 2>&1; then

    # USER should be extract from token
    USER=$(jq -r '.user' <<< "$PARAM")
    QUIZ=$(jq -r '.quiz' <<< "$PARAM")
    QID=$(jq -r '.question_id // ""' <<< "$PARAM")
    TYPE=$(jq -r '.question_type // "MCSA"' <<< "$PARAM")

    [[ -z "$QID" ]] && QID=$(uuidgen)

    require_dir DIR_USER="../users/${USER}" || {
        echo "error: user does not exist: $DIR_USER"
        exit 1
    }

    ensure_file QUIZ_BANK_FILE="$DIR_USER/quiz_bank/${QUIZ}.tsv" || { echo $?; exit 1;}

    tmp=$(mktemp "${QUIZ_BANK_FILE}.XXXXXX")
    defer_trap 'rm -f "$tmp"' EXIT

    QUESTION=$(jq -r '.question // ""' <<< "$PARAM")
    OPTIONS=$(jq -r '.options | @tsv' <<< "$PARAM")
    ANSWERS=$(jq -r '.answers | @tsv' <<< "$PARAM")
    REF_ID=$(jq -r '.ref_id // ""' <<< "$PARAM")
    PREV_ID=$(jq -r '.prev_id // ""' <<< "$PARAM")
    NEXT_ID=$(jq -r '.next_id // ""' <<< "$PARAM")
    PROMPT_ID=$(jq -r '.prompt_id // ""' <<< "$PARAM")

    awk -v OFS='\t' -v qid="$QID" -v type="$TYPE" \
        -v question="$QUESTION" -v options="$OPTIONS" -v answers="$ANSWERS" \
        -v ref_id="$REF_ID" -v prev_id="$PREV_ID" -v next_id="$NEXT_ID" -v prompt_id="$PROMPT_ID" '

        function repeat_tsv(s, n,   i, result) {
            for (i = 1; i <= n; i++) {
                result = (i == 1) ? s : result "\t" s
            }
            return result
        }

        BEGIN {
            found = 0

            # iXXX start from 0

            iQuestion = 10                               # 0-9 kept for qid, type, etc.

            iOption = iQuestion + 1 + 1                                       # insert an empty string between question & options
            options_size = split(options, arr_opt, "\t")
            options_size = (options_size == 0) ? 1 : options_size             # empty string ("") deemed as size(1)

            iAnswer = iOption + options_size + 1                              # insert an empty string between options & answers
            answers_size = split(answers, arr_ans, "\t")

            # 9 is set by already occupied fields count
            _pad = repeat_tsv("", iQuestion - 9)
        }
        $1 == qid {
            found = 1
            print qid, type, iQuestion, iOption, iAnswer, ref_id, prev_id, next_id, prompt_id, _pad, question, "", options, "", answers
        }
        $1 != qid {
            print $0
        }
        END {
            if (!found) {
                print qid, type, iQuestion, iOption, iAnswer, ref_id, prev_id, next_id, prompt_id, _pad, question, "", options, "", answers
            }
        }
        ' "$QUIZ_BANK_FILE" > "$tmp" && mv "$tmp" "$QUIZ_BANK_FILE"

    # 如果是合法的 JSON，添加最外层字段 "time" 并输出
    # --arg 会安全地将时间变量嵌入，防止注入或转义问题
    jq -n --arg t "$CURRENT_TIME" --arg s "success" '{time: $t, status: $s}'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON Only"

fi

# topic: quiz-make
# nats reply "quiz-make" --command="./reply_quiz-make-v2.sh" 2>/dev/null
# nats req "quiz-make" --raw < /path/to/request.json 2>/dev/null
