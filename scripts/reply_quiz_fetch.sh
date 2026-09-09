#!/usr/bin/env bash

# 请求内容在 stdin 中也可以通过环境变量拿到
msg="$NATS_REQUEST_BODY"

# sleep 1

# echo '{ "ACK": "'"${msg}"'" }'
# echo "${msg} - $(date)"

# 检查是否传入了参数
if [[ -z "${msg}" ]]; then
    echo "错误: 请提供一个参数"
    exit 1
fi

PARAM="${msg}"

# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "$PARAM" >/dev/null 2>&1; then

    # USER should be extract from token
    USER=$(jq -r '.user' <<< "$PARAM")
    QUIZ=$(jq -r '.quiz' <<< "$PARAM")

    # arg
    QUIZ_BANK="./users/${USER}/quiz_bank/${QUIZ}.tsv"
    QUIZ_OUT="${USER}/quiz_gen/${QUIZ}.tsv"
    COUNT=$(jq -r '.count' <<< "$PARAM")

    if [[ ! -f "$QUIZ_BANK" ]]; then
        QUIZ_OUT="user_missing/quiz_gen/quiz_missing.tsv"
        QUIZ_OUT_ROOT="/var/www/dp_users/$QUIZ_OUT"
        mkdir -p "$(dirname "$QUIZ_OUT_ROOT")"
        echo -e "$(uuidgen)\tExample Quiz - Why does this quiz appear?\tInvalid User\tMissing Quiz Bank\tStorage Path Issue\tAny Above\t\t\t\t\tAny Above\t\t\t\t\t\t\t\t\t\t$(uuidgen)" > "${QUIZ_OUT_ROOT}"
        jq -n --arg t "$CURRENT_TIME" --arg p "/$QUIZ_OUT" '{time: $t, path: $p}'
        exit 0
    fi

    # env
    IDS_INC=$(jq -r '.include | join(" ")' <<< "$PARAM")
    IDS_EXC=$(jq -r '.exclude | join(" ")' <<< "$PARAM")

    # generate quiz here
    # /var/www/dp_users must exist AND be set in Caddyfile as "root * /var/www/dp_users"
    ./QuizGen.sh "$QUIZ_BANK" "/var/www/dp_users/$QUIZ_OUT" "$COUNT"

    # 如果是合法的 JSON，添加最外层字段 "time" 并输出
    # --arg 会安全地将时间变量嵌入，防止注入或转义问题
    jq --arg t "$CURRENT_TIME" --arg p "/$QUIZ_OUT" '. + {time: $t, path: $p}' <<< "$PARAM"

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON message with 'count', 'include', 'exclude' fields"

fi

# topic: fetch-quiz
# nats reply "fetch-quiz" --command="./reply_quiz_fetch.sh" 2>/dev/null
# nats req "fetch-quiz" test --raw
