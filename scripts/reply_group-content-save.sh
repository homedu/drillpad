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
source "./utils/trim.sh"

##########################################################

# 请求内容在 stdin 中也可以通过环境变量拿到
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
    GROUP=$(jq -r '.group' <<< "$PARAM")
    GROUP_CONTENT=$(jq '.group_content' <<< "$PARAM")
    trim_inplace GROUP_CONTENT "\""                # trim "" auto-wrapped by jq without '-r'

    [[ -z "$GROUP" ]] && {
        jq -n --arg s "success" --arg p "" '{ status: $s, path: $p }'
        exit 0
    }

    require_dir DIR_USER="../users/${USER}" || {
        echo "error: user does not exist: $DIR_USER"
        exit 1
    }

    ensure_file GROUP_CONTENT_FILE="$DIR_USER/quiz_bank/${QUIZ}/group_ref/${GROUP}.html" || { echo $?; exit 1;}

    [[ -z "$GROUP_CONTENT" ]] && {
        rm -rf "$GROUP_CONTENT_FILE"
        jq -n --arg s "success" --arg p "" '{ status: $s, path: $p }'
        exit 0
    }

    cat <<< "$GROUP_CONTENT" > "$GROUP_CONTENT_FILE"

    jq -n --arg s "success" --arg p "$GROUP_CONTENT_FILE" '{ status: $s, path: $p }'

    # TODO: add to quiz-fetch.sh
    #
    # # /var/www/qdp_users must exist AND be set in Caddyfile as "root * /var/www/qdp_users"
    # require_dir FETCH_ROOT="/var/www/qdp_users" || { echo $?; exit 1;}
    # # will be appended to /var/www/qdp_users/
    # GROUP_CONTENT_OUT="${USER}/quiz_gen/${QUIZ}/group_ref/${GROUP}.html"
    # ensure_file GROUP_CONTENT_OUT_ABS="$FETCH_ROOT/$GROUP_CONTENT_OUT" || { echo $?; exit 1;}

    # rsync -av "$GROUP_CONTENT_FILE" "$GROUP_CONTENT_OUT_ABS"

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON Only"

fi
