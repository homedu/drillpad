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

# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# 请求内容在 stdin 中也可以通过环境变量拿到
PARAM="${NATS_REQUEST_BODY:?error: empty nats-req-body}"

# example request.json
# {
#     "user": "test-user",
#     "quiz": {
#         "name": "Sample Quiz",
#         "type": "MCSA",
#         "question": "What are the cities in Europe?",
#         "options": [
#             "Paris",
#             "London",
#             "Berlin",
#             "Madrid"
#         ],
#         "answers": [
#             "Paris",
#             "London"
#         ]
#     }
# }

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "$PARAM" >/dev/null 2>&1; then

    # USER should be extract from token
    USER=$(jq -r '.user' <<< "$PARAM")
    QUIZ=$(jq -r '.quiz.name' <<< "$PARAM")
    TYPE=$(jq -r '.quiz.type // "MCSA"' <<< "$PARAM")

    DIR_USER="../users/${USER}"
    QUIZ_BANK_FILE="$DIR_USER/quiz_bank/${QUIZ}.tsv"

    [[ -d "$DIR_USER" ]] || {
        echo "error: user does not exist: $DIR_USER"
        exit 1
    }

    mkdir -p "$(dirname "$QUIZ_BANK_FILE")" && touch "$QUIZ_BANK_FILE" || {
        echo "error: failed to create quiz bank file: $QUIZ_BANK_FILE"
        exit 1
    }

    QUESTION=$(jq -r '.quiz.question // ""' <<< "$PARAM")
    # OPTIONS=$(jq -r '.quiz.options[]' <<< "$PARAM")
    OPT_1=$(jq -r '.quiz.options[0] // ""' <<< "$PARAM")
    OPT_2=$(jq -r '.quiz.options[1] // ""' <<< "$PARAM")
    OPT_3=$(jq -r '.quiz.options[2] // ""' <<< "$PARAM")
    OPT_4=$(jq -r '.quiz.options[3] // ""' <<< "$PARAM")
    OPT_5=$(jq -r '.quiz.options[4] // ""' <<< "$PARAM")
    OPT_6=$(jq -r '.quiz.options[5] // ""' <<< "$PARAM")
    OPT_7=$(jq -r '.quiz.options[6] // ""' <<< "$PARAM")
    OPT_8=$(jq -r '.quiz.options[7] // ""' <<< "$PARAM")
    # ANSWERS=$(jq -r '.quiz.answers[]' <<< "$PARAM")
    ANS_1=$(jq -r '.quiz.answers[0] // ""' <<< "$PARAM")
    ANS_2=$(jq -r '.quiz.answers[1] // ""' <<< "$PARAM")
    ANS_3=$(jq -r '.quiz.answers[2] // ""' <<< "$PARAM")
    ANS_4=$(jq -r '.quiz.answers[3] // ""' <<< "$PARAM")
    ANS_5=$(jq -r '.quiz.answers[4] // ""' <<< "$PARAM")
    ANS_6=$(jq -r '.quiz.answers[5] // ""' <<< "$PARAM")
    ANS_7=$(jq -r '.quiz.answers[6] // ""' <<< "$PARAM")
    ANS_8=$(jq -r '.quiz.answers[7] // ""' <<< "$PARAM")

    awk -v OFS='\t' -v t="$TYPE" -v id="$(uuidgen)" -v q="$QUESTION" \
        -v o1="$OPT_1" -v o2="$OPT_2" -v o3="$OPT_3" -v o4="$OPT_4" \
        -v o5="$OPT_5" -v o6="$OPT_6" -v o7="$OPT_7" -v o8="$OPT_8" \
        -v a1="$ANS_1" -v a2="$ANS_2" -v a3="$ANS_3" -v a4="$ANS_4" \
        -v a5="$ANS_5" -v a6="$ANS_6" -v a7="$ANS_7" -v a8="$ANS_8" '
        BEGIN{
            print id, q, o1, o2, o3, o4, o5, o6, o7, o8, a1, a2, a3, a4, a5, a6, a7, a8, "", "", "ref_id", "prompt_id", "note_id", t
        }
        ' >> "$QUIZ_BANK_FILE"

    # 如果是合法的 JSON，添加最外层字段 "time" 并输出
    # --arg 会安全地将时间变量嵌入，防止注入或转义问题
    jq -n --arg t "$CURRENT_TIME" --arg s "success" '{time: $t, status: $s}'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON Only"

fi

# topic: quiz-make
# nats reply "quiz-make" --command="./reply_quiz-make.sh" 2>/dev/null
# nats req "quiz-make" --raw < /path/to/request.json 2>/dev/null
