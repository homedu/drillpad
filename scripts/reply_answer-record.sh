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

msg="$NATS_REQUEST_BODY"

# 检查是否传入了参数
[[ -n "${msg}" ]] || {
    echo "错误: 请提供一个参数"
    exit 1
}

PARAM="${msg}"

# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# 记录本次运行中用过的锁文件，退出时统一清理
declare -A _LOCKS=()

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "$PARAM" >/dev/null 2>&1; then

    USER=$(jq -r '.user' <<< "$PARAM")
    QUIZ=$(jq -r '.quiz' <<< "$PARAM")

    DIR_USER="../users/${USER}"

    [[ -d "${DIR_USER}/quiz_bank" ]] || {
        jq -n --arg t "$CURRENT_TIME" --arg s "test for missing user or quiz" '{time: $t, status: $s}'
        exit 0
    }

    PATH_REC="${DIR_USER}/answer_record/${QUIZ}"
    mkdir -p "$PATH_REC"

    # arg
    REC_CORRECT="$PATH_REC/correct.tsv"
    REC_INCORRECT="$PATH_REC/incorrect.tsv"
    REC_BLANK="$PATH_REC/blank.tsv"

    # file lock
    LOCK_FILE="$PATH_REC/rec.lock"; echo "${LOCK_FILE} --- reply_answer-record" >> debug.txt
    _LOCKS["$LOCK_FILE"]=1
    {
        flock -w 5 9 || {
            echo "error: ${REC_CORRECT} cannot be locked"
            exit 1
        }

        # ENV
        IDS_CORRECT=$(jq -r '.correct | join(" ")' <<< "$PARAM")
        IDS_INCORRECT=$(jq -r '.incorrect | join(" ")' <<< "$PARAM")
        IDS_BLANK=$(jq -r '.blank | join(" ")' <<< "$PARAM")

        export IDS_CORRECT
        export IDS_INCORRECT
        export IDS_BLANK

        # record answer here
        ./AnswerRec.sh "$REC_CORRECT" "$REC_INCORRECT" "$REC_BLANK"

    } 9>"$LOCK_FILE"

    # 如果是合法的 JSON，添加最外层字段 "time" 并输出
    # --arg 会安全地将时间变量嵌入，防止注入或转义问题
    jq -n --arg t "$CURRENT_TIME" --arg s "success" '{time: $t, status: $s}'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "${PARAM} ${CURRENT_TIME} - DO NOTHING, Accept JSON message with 'correct', 'incorrect', 'blank' fields"

fi

cleanup() {
    local l
    for l in "${!_LOCKS[@]}"; do
        rm -f "$l"
    done
}

# topic: answer-record
# nats reply "answer-record" --command="./reply_answer-record.sh" 2>/dev/null
# nats req "answer-record" test --raw
