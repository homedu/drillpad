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

    [[ -z "$GROUP" ]] && {
        jq -n --arg s "success" '{ status: $s, content: "" }'
        exit 0
    }

    require_dir DIR_USER="../users/${USER}" || {
        echo "error: user does not exist: $DIR_USER"
        exit 1
    }

    ensure_file GROUP_CONTENT_FILE="$DIR_USER/quiz_bank/${QUIZ}/group_ref/${GROUP}.html" || { echo $?; exit 1;}

    IFS= read -r -d '' CONTENT < "$GROUP_CONTENT_FILE"

    jq -n --arg s "success" --arg c "$CONTENT" '{ status: $s, content: $c }'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM $CURRENT_TIME - DO NOTHING, Accept JSON Only"

fi
