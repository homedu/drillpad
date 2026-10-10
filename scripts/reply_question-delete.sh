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

PARAM="${NATS_REQUEST_BODY:-${1:-}}"

# 如果 PARAM 是一个存在的文件路径，就读取该文件的内容
[[ -f "$PARAM" ]] && PARAM=$(cat "$PARAM")

# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "$PARAM" >/dev/null 2>&1; then

    # USER should be extract from token
    USER=$(jq -r '.user' <<< "$PARAM")
    QUIZ=$(jq -r '.quiz' <<< "$PARAM")
    QID=$(jq -r '.qid' <<< "$PARAM")
    ensure_file QUIZ_FILE="../users/${USER}/quiz_bank/${QUIZ}.tsv"

    # echo "用户: $USER, 测验: $QUIZ, 问题ID: $QID, 文件: $QUIZ_FILE"

    ensure_file REC_CORRECT_FILE="../users/${USER}/answer_record/${QUIZ}/correct.tsv"
    ensure_file REC_INCORRECT_FILE="../users/${USER}/answer_record/${QUIZ}/incorrect.tsv"
    ensure_file REC_BLANK_FILE="../users/${USER}/answer_record/${QUIZ}/blank.tsv"
    ensure_file EBHS_FILE="../users/${USER}/answer_record/${QUIZ}/ebhs.tsv"

    tmp=$(mktemp) && awk -F '\t' -v id="$QID" '$1 != id' "$QUIZ_FILE" > "$tmp" && mv "$tmp" "$QUIZ_FILE"
    tmp=$(mktemp) && awk -F '\t' -v id="$QID" '$1 != id' "$REC_CORRECT_FILE" > "$tmp" && mv "$tmp" "$REC_CORRECT_FILE"
    tmp=$(mktemp) && awk -F '\t' -v id="$QID" '$1 != id' "$REC_INCORRECT_FILE" > "$tmp" && mv "$tmp" "$REC_INCORRECT_FILE"
    tmp=$(mktemp) && awk -F '\t' -v id="$QID" '$1 != id' "$REC_BLANK_FILE" > "$tmp" && mv "$tmp" "$REC_BLANK_FILE"
    tmp=$(mktemp) && awk -F '\t' -v id="$QID" '$1 != id' "$EBHS_FILE" > "$tmp" && mv "$tmp" "$EBHS_FILE"

    STATUS="success"
    INFO="Question with ID $QID has been deleted from quiz $QUIZ for user $USER."

    jq -n --arg status "$STATUS" --arg info "$INFO" '{status: $status, info: $info}'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON with 'user', 'quiz' and 'qid' fields"

fi

# topic: question-search
# nats reply "question-search" --command="./reply_question-search.sh"
# nats req "question-search" -s nats://192.168.1.159:4222 ./example-args/reply_question-search.json --raw 2>/dev/null
