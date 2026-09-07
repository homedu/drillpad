#!/usr/bin/env bash

msg="$NATS_REQUEST_BODY"

# 检查是否传入了参数
if [[ -z "${msg}" ]]; then
    echo "错误: 请提供一个参数"
    exit 1
fi

PARAM="${msg}"

# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

STATUS="success"

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "$PARAM" >/dev/null 2>&1; then

    USER=$(jq -r '.user' <<< "$PARAM")
    QUIZ=$(jq -r '.quiz' <<< "$PARAM")

    # for testing
    if [[ -z "$USER" ]]; then
        USER="user_missing"
        STATUS="test"
    fi

    # for testing
    if [[ -z "$QUIZ" ]]; then
        QUIZ="quiz_missing"
        STATUS="test"
    fi

    # arg
    REC_CORRECT="./users/${USER}/answer_record/${QUIZ}-correct.txt"
    REC_INCORRECT="./users/${USER}/answer_record/${QUIZ}-incorrect.txt"
    REC_BLANK="./users/${USER}/answer_record/${QUIZ}-blank.txt"

    # env
    IDS_CORRECT=$(jq -r '.correct | join(" ")' <<< "$PARAM")
    IDS_INCORRECT=$(jq -r '.incorrect | join(" ")' <<< "$PARAM")
    IDS_BLANK=$(jq -r '.blank | join(" ")' <<< "$PARAM")

    ./AnswerRec.sh "$REC_CORRECT" "$REC_INCORRECT" "$REC_BLANK"

    jq -n --arg t "$CURRENT_TIME" --arg s "$STATUS" '{time: $t, status: $s}'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "${PARAM} ${CURRENT_TIME} - DO NOTHING, Accept JSON message with 'correct', 'incorrect', 'blank' fields"

fi

# topic: record-answer
# nats reply "record-answer" --command="./reply_answer_record.sh" 2>/dev/null
# nats req "record-answer" test --raw
