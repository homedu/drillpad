#!/usr/bin/env bash

set -euo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd $SCRIPT_DIR > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

source "./utils/ensure_df.sh"
source "./utils/trap.sh"

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

    require_dir DIR_USER="../users/${USER}" || {
        echo "错误: 用户目录不存在: $DIR_USER" >&2
        exit 1
    }

    ensure_file QUIZ_FILE="${DIR_USER}/quiz_bank/${QUIZ}.tsv" || { echo $?; exit 1;}
    ensure_file REC_CORRECT="${DIR_USER}/answer_record/${QUIZ}/correct.tsv" || { echo $?; exit 1;}
    ensure_file REC_INCORRECT="${DIR_USER}/answer_record/${QUIZ}/incorrect.tsv" || { echo $?; exit 1;}

    nQ=$(wc -l < "$QUIZ_FILE")
    nC=$(wc -l < "$REC_CORRECT")
    nI=$(wc -l < "$REC_INCORRECT")

    jq -n --arg nQ "$nQ" --arg nC "$nC" --arg nI "$nI" '{question_count: $nQ, correct_count: $nC, incorrect_count: $nI}'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON with 'user', 'quiz' fields"

fi

# topic: qa-count
# nats reply "qa-count" --command="./reply_qa-count.sh"
# nats req "qa-count" -s nats://192.168.1.159:4222 ./example-args/reply_qa-count.json --raw 2>/dev/null
