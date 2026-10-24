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

# 获取当前时间（格式可根据需要修改，例如 2026-08-27 09:59:00）
CURRENT_TIME=$(date "+%Y-%m-%d %H:%M:%S")

# 请求内容在 stdin 中也可以通过环境变量拿到
PARAM="${NATS_REQUEST_BODY:-${1:-}}"

# 如果 PARAM 是一个存在的文件路径，就读取该文件的内容
[[ -f "${PARAM}" ]] && PARAM=$(cat "${PARAM}")

# 使用 jq 尝试解析参数，检查它是否为合法的 JSON 对象或数组
if jq -e . <<< "${PARAM}" >/dev/null 2>&1; then

    # CUR_USER should be extract from token
    CUR_USER=$(jq -r '.user' <<< "${PARAM}")
    QUIZ=$(jq -r '.quiz' <<< "${PARAM}")

    QID=$(jq -r '.question_id // ""' <<< "${PARAM}")
    TYPE=$(jq -r '.question_type // "UNKNOWN"' <<< "${PARAM}")
    GROUP=$(jq -r '.group // ""' <<< "${PARAM}")

    ACTION="edited"
    [[ -z "${QID}" ]] && {
        QID=$(uuidgen)
        ACTION="created"
    }

    require_dir DIR_USER="../users/${CUR_USER}" || {
        echo "error: user does not exist: ${DIR_USER}"
        exit 1
    }

    ensure_file QUIZ_BANK_FILE="${DIR_USER}/quiz_bank/${QUIZ}.tsv" || { echo $?; exit 1;}

    tmp=$(mktemp "${QUIZ_BANK_FILE}.XXXXXX")
    defer_trap 'rm -f "$tmp"' EXIT

    QUESTION=$(jq '.question // ""' <<< "${PARAM}") # keep some literal string like '\n'
    trim_inplace QUESTION "\""                      # trim "" auto-wrapped by jq without '-r'

    OPTIONS=$(jq -r '.options | @tsv' <<< "${PARAM}")
    ANSWERS=$(jq -r '.answers | @tsv' <<< "${PARAM}")
    SKILLS=$(jq -r '.skills | @tsv' <<< "${PARAM}")

    REF_ID=$(jq -r '.ref_id // ""' <<< "${PARAM}")
    PREV_ID=$(jq -r '.prev_id // ""' <<< "${PARAM}")
    NEXT_ID=$(jq -r '.next_id // ""' <<< "${PARAM}")
    PROMPT_ID=$(jq -r '.prompt_id // ""' <<< "${PARAM}")

    awk -v OFS='\t' -v qid="${QID}" -v type="$TYPE" -v group="${GROUP}" \
        -v question="${QUESTION}" -v options="$OPTIONS" -v answers="${ANSWERS}" -v skills="${SKILLS}" \
        -v ref_id="${REF_ID}" -v prev_id="${PREV_ID}" -v next_id="${NEXT_ID}" -v prompt_id="${PROMPT_ID}" '

        function repeat_tsv(s, n,   i, result) {
            for (i = 1; i <= n; i++) {
                result = (i == 1) ? s : result "\t" s
            }
            return result
        }

        BEGIN {
            found = 0

            group_idx = 0

            # iXXX below start from 0

            iQuestion = 16                                              # 0-15 kept for qid, type, etc.
            question_size = 1                                           # insert "Q:" before question

            iOption = iQuestion + question_size + 1                     # insert "O:" between question & options
            options_size = split(options, arr_opt, "\t")
            options_size = (options_size == 0) ? 1 : options_size       # empty string ("") deemed as size(1)

            iAnswer = iOption + options_size + 1                        # insert "A:" between options & answers
            answers_size = split(answers, arr_ans, "\t")
            answers_size = (answers_size == 0) ? 1 : answers_size       # empty string ("") deemed as size(1)

            iSkill = iAnswer + answers_size + 1                         # insert "S:" between answers & skills
            skills_size = split(skills, arr_ski, "\t")
            skills_size = (skills_size == 0) ? 1 : skills_size          # empty string ("") deemed as size(1)

            _pad = repeat_tsv("", iQuestion - 13)                       # 13 is occupied fields count (before 'question' and exclude '_pad')
        }

        # 扫描已有文件：记录每个第三列(group)值对应的第四列(group_idx)最大值
        $3 != "" {
            if (!($3 in max) || $4 + 0 > max[$3])
                max[$3] = $4 + 0
        }

        $1 == qid {
            found = 1

            split($0, fs, "\t")
            group_idx = fs[4]      # 'group_idx' in existing line

            # on edit, if 'group' changed, re-assign 'group_idx',
            # if 'group' not changed, keep existing one
            if (group != fs[3]) {
                if (group == "")
                    group_idx = 0
                else if (group in max)
                    group_idx = max[group] + 1
                else
                    group_idx = 1
            }

            print qid, type, group, group_idx,
                  iQuestion, iOption, iAnswer, iSkill,
                  ref_id, prev_id, next_id, prompt_id, _pad,
                  "Q:", question, "O:", options, "A:", answers, "S:", skills
        }
        $1 != qid {
            print $0
        }

        END {
            if (!found) {

                # on create, always assign 'group_idx'
                if (group == "")
                    group_idx = 0
                else if (group in max)
                    group_idx = max[group] + 1
                else
                    group_idx = 1

                print qid, type, group, group_idx,
                      iQuestion, iOption, iAnswer, iSkill,
                      ref_id, prev_id, next_id, prompt_id, _pad,
                      "Q:", question, "O:", options, "A:", answers, "S:", skills
            }
        }
        ' "${QUIZ_BANK_FILE}" > "$tmp" && mv "$tmp" "${QUIZ_BANK_FILE}" && ./Group.sh -i -c 3 "${QUIZ_BANK_FILE}" # 3 is 'group' column

    # 如果是合法的 JSON，添加最外层字段 "time" 并输出
    # --arg 会安全地将时间变量嵌入，防止注入或转义问题
    jq -n --arg t "${CURRENT_TIME}" --arg s "success: ${ACTION}" --arg id "${QID}" '{ time: $t, status: $s, question_id: $id }'

else

    # 如果不是 JSON，作为普通字符串输出该参数加上当前时间
    echo "${PARAM} ${CURRENT_TIME} - DO NOTHING, Accept JSON Only"

fi

# topic: quiz-make
# nats reply "quiz-make" --command="./reply_quiz-make.sh" 2>/dev/null
# nats req "quiz-make" --raw < /path/to/request.json 2>/dev/null
