#! /bin/bash

# 请求内容在 stdin 中也可以通过环境变量拿到
msg="$NATS_REQUEST_BODY"

# sleep 1

# echo '{ "ACK": "'"${msg}"'" }' 
# echo "${msg} - $(date)"

# 检查是否传入了参数
if [ -z "${msg}" ]; then
    echo "错误: 请提供一个参数"
    exit 1
fi

PARAM="${msg}"
# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "$PARAM" >/dev/null 2>&1; then

    INCLUDE=$(echo "$PARAM" | jq -r '.include | join(" ")')
    EXCLUDE=$(echo "$PARAM" | jq -r '.exclude | join(" ")')
    COUNT=$(echo "$PARAM" | jq -r '.count')
    
    # (qmiao) should be extract from msg or header
    # (AZ-900.tsv) should be extract from msg
    QUIZ_IN="./users/qmiao/quiz_bank/AZ-900.tsv"
    QUIZ_OUT="/qmiao/quiz_gen/AZ-900.tsv"
    
    # /var/www/dp_users must exist AND be set in Caddyfile as "root * /var/www/dp_users"        
    IDS_INC="$INCLUDE" IDS_EXC="$EXCLUDE" ./QGen.sh "${QUIZ_IN}" "/var/www/dp_users${QUIZ_OUT}" "${COUNT}"

    # 如果是合法的 JSON，添加最外层字段 "time" 并输出
    # --arg 会安全地将时间变量嵌入，防止注入或转义问题
    jq --arg t "${CURRENT_TIME}" --arg p "${QUIZ_OUT}" '. + {time: $t, path: $p}' <<< "$PARAM"
else
    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "${PARAM} ${CURRENT_TIME} - DO NOTHING, Accept JSON message with 'count', 'include', 'exclude' fields"
fi


# topic: fetch-quiz
# nats reply "fetch-quiz" --command="./reply.sh" 2>/dev/null
# nats req "fetch-quiz" test --raw
