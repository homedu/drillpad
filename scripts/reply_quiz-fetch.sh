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

# 请求内容在 stdin 中也可以通过环境变量拿到
msg="${NATS_REQUEST_BODY:?error: empty nats-req-body}"

# sleep 1

# echo '{ "ACK": "'"${msg}"'" }'
# echo "${msg} - $(date)"

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

# /var/www/dp_users must exist AND be set in Caddyfile as "root * /var/www/dp_users"
FETCH_ROOT="/var/www/dp_users"

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "$PARAM" >/dev/null 2>&1; then

    # USER should be extract from token
    USER=$(jq -r '.user' <<< "$PARAM")
    QUIZ=$(jq -r '.quiz' <<< "$PARAM")

    DIR_USER="../users/${USER}"

    # arg
    QUIZ_BANK="$DIR_USER/quiz_bank/${QUIZ}.tsv"
    QUIZ_OUT="${USER}/quiz_gen/${QUIZ}.tsv"  # will be appended to /var/www/dp_users/
    COUNT=$(jq -r '.count' <<< "$PARAM")

    QUIZ_OUT_ABS="$FETCH_ROOT/$QUIZ_OUT"
    mkdir -p "$(dirname "$QUIZ_OUT_ABS")"

    [[ -f "$QUIZ_BANK" ]] || {
        QUIZ_OUT="user_missing/quiz_gen/quiz_missing.tsv"
        QUIZ_OUT_ABS="$FETCH_ROOT/$QUIZ_OUT"
        mkdir -p "$(dirname "$QUIZ_OUT_ABS")"

        _id=$(uuidgen)
        _quiz="Example Quiz - Why does this quiz appear?"
        _opt1="Invalid User"
        _opt2="Missing Quiz Bank"
        _opt3="Storage Path Issue"
        _opt4="Any Above"
        _ans1="Any Above"
        _rid=""
        _pid=""
        _nid=""
        _type="MCSA"

        echo -e "$_id\t$_quiz\t$_opt1\t$_opt2\t$_opt3\t$_opt4\t\t\t\t\t$_ans1\t\t\t\t\t\t\t\t$_rid\t$_pid\t$_nid\t$_type" > "${QUIZ_OUT_ABS}"

        jq -n --arg t "$CURRENT_TIME" --arg p "/$QUIZ_OUT" '{time: $t, path: $p}'
        exit 0
    }

    PATH_REC="$DIR_USER/answer_record/${QUIZ}"
    mkdir -p "$PATH_REC"

    # make ENV (get those from /answer_record/, rather than from the request)
    REC_CORRECT="$PATH_REC/correct.tsv"
    REC_INCORRECT="$PATH_REC/incorrect.tsv"
    REC_BLANK="$PATH_REC/blank.tsv"

    # file lock
    LOCK_FILE="$PATH_REC/rec.lock"; # echo "${LOCK_FILE} --- reply_quiz-fetch" >> debug.txt
    _LOCKS["$LOCK_FILE"]=1
    {
        flock -w 5 9 || {
            echo "error: ${REC_CORRECT} cannot be locked"
            exit 1
        }

        IDS_INC_1=$(cat "$REC_INCORRECT" 2>/dev/null | awk -F'\t' '{print $1}' | tr '\n' ' ')
        IDS_INC_2=$(cat "$REC_BLANK" 2>/dev/null | awk -F'\t' '{print $1}' | tr '\n' ' ')
        IDS_INC="${IDS_INC_1} ${IDS_INC_2}"
        IDS_EXC=$(cat "$REC_CORRECT" 2>/dev/null | awk -F'\t' '{print $1}' | tr '\n' ' ')

        export IDS_INC
        export IDS_EXC

        # generate quiz here
        ./QuizGen.sh "$QUIZ_BANK" "$QUIZ_OUT_ABS" "$COUNT"

    } 9>"$LOCK_FILE"

    # 如果是合法的 JSON，添加最外层字段 "time" 并输出
    # --arg 会安全地将时间变量嵌入，防止注入或转义问题
    jq --arg t "$CURRENT_TIME" --arg p "/$QUIZ_OUT" '. + {time: $t, path: $p}' <<< "$PARAM"

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON message with 'count', 'include', 'exclude' fields"

fi

cleanup() {
    local l
    for l in "${!_LOCKS[@]}"; do
        rm -f "$l"
    done
}

# topic: quiz-fetch
# nats reply "quiz-fetch" --command="./reply_quiz-fetch.sh" 2>/dev/null
# nats req "quiz-fetch" test --raw
