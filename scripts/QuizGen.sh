#!/usr/bin/env bash

set -eo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd ${SCRIPT_DIR} > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

source "./utils/path_assign.sh"
source "./utils/trap_ex.sh"

##########################################################

# [[ "$#" -eq 3 ]] || {
#     echo "error: must give 3 arguments!"
#     echo "usage: $0 <quiz-bank-tsv> <quiz-out> [count]; Also ENV [IDS_INC] [IDS_EXC]"
#     exit 1
# }

QUIZ_BANK="${1:?usage: $0 <quiz-bank.tsv> <quiz-out.tsv> [count]; ENV [IDS_INC] [IDS_EXC]}"
QUIZ_OUT="${2:?usage: $0 <quiz-bank.tsv> <quiz-out.tsv> [count]; ENV [IDS_INC] [IDS_EXC]}"
COUNT="${3:-10}"  # 默认生成 10 道题

declare -a IDS_INC=(${IDS_INC})
declare -a IDS_EXC=(${IDS_EXC})

# 2. 验证并打印数组内容
# echo "--- IDS_INC ---"
# for item in "${IDS_INC[@]}"; do
# echo "Item: $item"
# done

# echo "--- IDS_EXC ---"
# for item in "${IDS_EXC[@]}"; do
# echo "Item: $item"
# done

# 判断文件名是否包含扩展名（即最后一个斜杠后面是否有小数点）
# ${QUIZ##*/} 获取不含路径的文件名
[[ "${QUIZ_BANK##*/}" == *.* ]] || QUIZ_BANK="${QUIZ_BANK}.tsv"
require_file QUIZ_BANK="${QUIZ_BANK}" || { echo $?; exit 1; }

[[ "${QUIZ_OUT##*/}" == *.* ]] || QUIZ_OUT="${QUIZ_OUT}.tsv"
ensure_file QUIZ_OUT="${QUIZ_OUT}" || { echo $?; exit 1; }

# [[ "${#IDS_INC[@]}" -ne 0 ]] || {
#     echo "error: empty IDS_INC"
#     exit 1
# }
# [[ "${#IDS_EXC[@]}" -ne 0 ]] || {
#     echo "error: empty IDS_EXC"
#     exit 1
# }

#

awk -v count="${COUNT}" -v ids_inc="${IDS_INC[*]}" -v ids_exc="${IDS_EXC[*]}" '

# start from 1, exclude 'end'
function slice(arr, start, end, sep,      i, slice_str) {
    # for (idx in arr) print "DEBUG(slice):", idx - 1, arr[idx]

    slice_str = "";
    for (i = start; i < end; i++) {
        slice_str = (slice_str == "" ? "" : slice_str sep) arr[i];
    }
    sub(/^\t/, "", slice_str)
    sub(/\t$/, "", slice_str)
    return slice_str
}

# 将字符串 s 按 TAB 分段,随机打乱后用 TAB 重新连接并返回
function shuffle_tabs(s,    parts, n, i, j, tmp, out) {
    n = split(s, parts, "\t")
    if (n < 2) return s

    # Fisher-Yates 洗牌
    for (i = n; i > 1; i--) {
        j = int(rand() * i) + 1
        tmp = parts[i]; parts[i] = parts[j]; parts[j] = tmp
    }

    # 用 TAB 连接
    out = parts[1]
    for (i = 2; i <= n; i++)
        out = out "\t" parts[i]
    return out
}

function repeat_tsv(s, n,   i, result) {
    for (i = 1; i <= n; i++) {
        result = (i == 1) ? s : result "\t" s
    }
    return result
}

BEGIN {

    FS = OFS = "\t"
	RS = "\r?\n"

    srand()

    nInc = split(ids_inc, arr_inc, " ")
    for (i in arr_inc) { map_inc[arr_inc[i]] = 1 }

    nExc = split(ids_exc, arr_exc, " ")
    for (i in arr_exc) { map_exc[arr_exc[i]] = 1 }

    inc_count = 0
    cand_count = 0

    # print nInc, ":", nExc
    # for (k in map_inc) print "DEBUG(map_inc):", k, "→", map_inc[k]
    # for (k in map_exc) print "DEBUG(map_exc):", k, "→", map_exc[k]
}

NF >= 12 && $1 !="" && $2 != "" && $5 != "" {

    n = split($0, arr_line, "\t")

    if ($1 in map_inc) {

        inc_count++

        inc_pool[inc_count]           = $0
        inc_pool_id[inc_count]        = $1
        inc_pool_type[inc_count]      = $2
        inc_pool_group[inc_count]     = $3
        inc_pool_idx_grp[inc_count]   = $4
        inc_pool_iQuestion[inc_count] = $5
        inc_pool_iOption[inc_count]   = $6
        inc_pool_iAnswer[inc_count]   = $7
        inc_pool_iSkill[inc_count]    = $8
        inc_pool_ref_id[inc_count]    = $9
        inc_pool_prev_id[inc_count]   = $10
        inc_pool_next_id[inc_count]   = $11
        inc_pool_prompt_id[inc_count] = $12

        # arr_line[] starts from 1; so $5 add 1 to find position in awk array.
        inc_pool_question[inc_count] = arr_line[$5 + 1]
        inc_pool_options[inc_count]  = slice(arr_line, $6 + 1, $7, "\t")
        inc_pool_answers[inc_count]  = slice(arr_line, $7 + 1, $8, "\t")
        inc_pool_skills[inc_count]   = slice(arr_line, $8 + 1, n + 1, "\t")

    } else if ($1 in map_exc) {

        next

    } else {

        cand_count++

        cand_pool[cand_count]           = $0
        cand_pool_id[cand_count]        = $1
        cand_pool_type[cand_count]      = $2
        cand_pool_group[cand_count]     = $3
        cand_pool_idx_grp[cand_count]   = $4
        cand_pool_iQuestion[cand_count] = $5
        cand_pool_iOption[cand_count]   = $6
        cand_pool_iAnswer[cand_count]   = $7
        cand_pool_iSkill[cand_count]    = $8
        cand_pool_ref_id[cand_count]    = $9
        cand_pool_prev_id[cand_count]   = $10
        cand_pool_next_id[cand_count]   = $11
        cand_pool_prompt_id[cand_count] = $12

        # arr_line[] starts from 1; so $5 add 1 to find position in awk array.
        cand_pool_question[cand_count] = arr_line[$5 + 1]
        cand_pool_options[cand_count]  = slice(arr_line, $6 + 1, $7, "\t")
        cand_pool_answers[cand_count]  = slice(arr_line, $7 + 1, $8, "\t")
        cand_pool_skills[cand_count]   = slice(arr_line, $8 + 1, n + 1, "\t")
    }
}

END {
    printed = 0

    for (i = 1; i <= inc_count; i++) {

        id        = inc_pool_id[i]
        type      = inc_pool_type[i]
        group     = inc_pool_group[i]
        idx_grp   = inc_pool_idx_grp[i]
        iQuestion = inc_pool_iQuestion[i]
        question  = inc_pool_question[i]
        iOption   = inc_pool_iOption[i]
        options   = inc_pool_options[i]
        iAnswer   = inc_pool_iAnswer[i]
        answers   = inc_pool_answers[i]
        iSkill    = inc_pool_iSkill[i]
        skills    = inc_pool_skills[i]
        ref_id    = inc_pool_ref_id[i]
        prev_id   = inc_pool_prev_id[i]
        next_id   = inc_pool_next_id[i]
        prompt_id = inc_pool_prompt_id[i]

        _pad = repeat_tsv("", iQuestion - 13)              # 13 is occupied fields count (before 'question' and exclude '_pad')

        print id, type, group, idx_grp,
              iQuestion, iOption, iAnswer, iSkill,
              ref_id, prev_id, next_id, prompt_id, _pad,
              "Q:", question, "O:", shuffle_tabs(options), "A:", answers, "S:", skills

        printed++
    }

    if (printed < count) {
        needed = count - printed
        limit = ( cand_count < needed ) ? cand_count : needed

        for (j = 1; j <= limit; j++) {

            id        = cand_pool_id[j]
            type      = cand_pool_type[j]
            group     = cand_pool_group[j]
            idx_grp   = cand_pool_idx_grp[j]
            iQuestion = cand_pool_iQuestion[j]
            question  = cand_pool_question[j]
            iOption   = cand_pool_iOption[j]
            options   = cand_pool_options[j]
            iAnswer   = cand_pool_iAnswer[j]
            answers   = cand_pool_answers[j]
            iSkill    = cand_pool_iSkill[j]
            skills    = cand_pool_skills[j]
            ref_id    = cand_pool_ref_id[j]
            prev_id   = cand_pool_prev_id[j]
            next_id   = cand_pool_next_id[j]
            prompt_id = cand_pool_prompt_id[j]

            _pad = repeat_tsv("", iQuestion - 13)              # 13 is occupied fields count (before 'question' and exclude '_pad')

            print id, type, group, idx_grp,
                  iQuestion, iOption, iAnswer, iSkill,
                  ref_id, prev_id, next_id, prompt_id, _pad,
                  "Q:", question, "O:", shuffle_tabs(options), "A:", answers, "S:", skills
        }
    }

}' ${QUIZ_BANK} > ${QUIZ_OUT}

# ${QUIZ_BANK} | shuf > ${QUIZ_OUT}

# IDS_INC="2a21cf35-dc00-446f-86f9-c58d9c6abb73 fcc0593a-d720-4df2-981d-eb0a5ea791d5" IDS_EXC="b3d26c0c-3764-4d1c-93af-aeb808b44439" ./QuizGen.sh ../users/qmiao/quiz_bank/AZ-900.tsv ./AZ-900.tsv 5

# IDS_INC="2a21cf35-dc00-446f-86f9-c58d9c6abb73 fcc0593a-d720-4df2-981d-eb0a5ea791d5" IDS_EXC="b3d26c0c-3764-4d1c-93af-aeb808b44439" ./QuizGen.sh ../users/qmiao/quiz_bank/AZ-900.tsv ./AZ-900.tsv 9 && ./Group.sh -i -c 6 ./AZ-900.tsv && ./Chain.sh -c 1,7,8 -i ./AZ-900.tsv
