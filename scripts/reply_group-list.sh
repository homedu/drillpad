#!/usr/bin/env bash

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

PARAM="${NATS_REQUEST_BODY:-${1:-}}"

# 如果 PARAM 是一个存在的文件路径,就读取该文件的内容
[[ -f "${PARAM}" ]] && PARAM=$(cat "${PARAM}")

CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

if jq -e . <<< "${PARAM}" >/dev/null 2>&1; then

    # CUR_USER should be extract from token
    CUR_USER=$(jq -r '.user' <<< "${PARAM}")
    QUIZ=$(jq -r '.quiz' <<< "${PARAM}")
    GRP_COL_NO=$(jq -r '.group_col_no // "3"' <<< "${PARAM}") # 'GROUP' COLUMN NO is 3
    ensure_file QUIZ_FILE="../users/${CUR_USER}/quiz_bank/${QUIZ}.tsv"

    INFO=""
    VALUES=()

    # 按首次出现顺序输出该列的不重复值
    mapfile -t VALUES < <(
    awk -F '\t' -v c="${GRP_COL_NO}" '
        sub(/\r$/, "")
        NF >= c && $c != "" && !($c in seen) { seen[$c] = 1; print $c }
    ' "${QUIZ_FILE}"
    )

    if [[ ${#VALUES[@]} -eq 0 ]]; then
        INFO="No data in quiz '${QUIZ}' for user '${CUR_USER}'"
    else
        INFO="${#VALUES[@]} distinct value(s) in column '${GRP_COL_NO}'"
    fi

    # 数组 -> JSON 数组
    # if [[ ${#VALUES[@]} -gt 0 ]]; then
    #     VALUES_JSON=$(printf '%s\n' "${VALUES[@]}" | jq -R . | jq -s .)
    # else
    #     VALUES_JSON='[]'
    # fi

    # 数组 -> JSON 数组
    VALUES_JSON=$(jq -n --args '$ARGS.positional' "${VALUES[@]}")

    jq -n --argjson values "${VALUES_JSON}" --arg info "${INFO}" \
        '{status: "success", groups: $values, info: $info}'

else

    echo "${PARAM} ${CURRENT_TIME} - DO NOTHING, Accept JSON with 'user', 'quiz' and 'group_col_no' fields"

fi
