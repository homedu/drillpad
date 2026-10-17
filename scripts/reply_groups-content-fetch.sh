#!/usr/bin/env bash

set -euo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd ${SCRIPT_DIR} > /dev/null
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

    # CUR_USER should be extract from token
    CUR_USER=$(jq -r '.user' <<< "$PARAM")
    QUIZ=$(jq -r '.quiz' <<< "$PARAM")

    # 注意:GROUPS 是 bash 内置只读变量(当前用户所属组 ID),不能作为自定义变量名,
    # 所以这里用 GROUP_LIST 保存 groups 数组(JSON 字符串)
    GROUP_LIST=$(jq -c '.groups // []' <<< "$PARAM")

    # groups 为空数组(或未传),返回空数组
    if [[ "$(jq 'length' <<< "${GROUP_LIST}")" -eq 0 ]]; then
        jq -n '{ status: "success", contents: [] }'
        exit 0
    fi

    require_dir DIR_USER="../users/${CUR_USER}" || {
        echo "error: user does not exist: ${DIR_USER}"
        exit 1
    }

    # 结果对象数组,初始为空
    RESULT='[]'

    # 逐个 group 读取内容,按传入顺序追加 {group: content}
    while IFS= read -r GROUP; do
        ensure_file GROUP_CONTENT_FILE="${DIR_USER}/quiz_bank/${QUIZ}/group_ref/${GROUP}.html" || { echo $?; exit 1; }
        CONTENT=$(cat "${GROUP_CONTENT_FILE}")
        RESULT=$(jq -c --arg g "$GROUP" --arg c "$CONTENT" '. + [{ ($g): $c }]' <<< "$RESULT")
    done < <(jq -r '.[]' <<< "${GROUP_LIST}")

    jq -n --argjson r "$RESULT" '{ status: "success", contents: $r }'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "$PARAM ${CURRENT_TIME} - DO NOTHING, Accept JSON Only"

fi
