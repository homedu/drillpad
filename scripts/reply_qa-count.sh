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

    QUIZ_FILE="../users/${USER}/quiz_bank/${QUIZ}.tsv"
    REC_CORRECT_FILE="../users/${USER}/answer_record/${QUIZ}/correct.tsv"
    REC_INCORRECT_FILE="../users/${USER}/answer_record/${QUIZ}/incorrect.tsv"

    [[ -f "$QUIZ_FILE" ]] || { touch "$QUIZ_FILE"; }
    [[ -f "$REC_CORRECT_FILE" ]] || { touch "$REC_CORRECT_FILE"; }
    [[ -f "$REC_INCORRECT_FILE" ]] || { touch "$REC_INCORRECT_FILE"; }
    nQ=$(wc -l < "$QUIZ_FILE")
    nC=$(wc -l < "$REC_CORRECT_FILE")
    nI=$(wc -l < "$REC_INCORRECT_FILE")

    jq -n --arg nQ "$nQ" --arg nC "$nC" --arg nI "$nI" '{question_count: $nQ, correct_count: $nC, incorrect_count: $nI}'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON with 'user', 'quiz' fields"

fi

# topic: qa-count
# nats reply "qa-count" --command="./reply_qa-count.sh"
# nats req "qa-count" -s nats://192.168.1.159:4222 ./example-args/reply_qa-count.json --raw 2>/dev/null
