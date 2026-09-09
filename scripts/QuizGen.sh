#!/usr/bin/env bash

if [[ "$#" -ne 3 ]]; then
    echo "error: must give 3 arguments!"
    echo "usage: $0 <quiz-bank-tsv> <quiz-output> <suggested count>; Also ENV [IDS_INC] [IDS_EXC]"
    exit 1
fi

QUIZ_BANK=$1
QUIZ_OUT=$2
COUNT=$3

declare -a IDS_INC=($IDS_INC)
declare -a IDS_EXC=($IDS_EXC)

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
if [[ "${QUIZ_BANK##*/}" != *.* ]]; then
    QUIZ_BANK="${QUIZ_BANK}.tsv"
fi

# 检查参数是否存在
if [[ ! -f "$QUIZ_BANK" ]]; then
    echo "error: bank quiz file (${QUIZ_BANK}) is not found"
    exit 1
fi

mkdir -p "$(dirname "$QUIZ_OUT")"

if [[ "${QUIZ_OUT##*/}" != *.* ]]; then
    QUIZ_OUT="${QUIZ_OUT}.tsv"
fi

# if [[ "${#IDS_INC[@]}" -eq 0 ]]; then
# echo "error"
# exit 1
# fi

# if [[ "${#IDS_EXC[@]}" -eq 0 ]]; then
# echo "error"
# exit 1
# fi

awk -v count="$COUNT" -v ids_inc="${IDS_INC[*]}" -v ids_exc="${IDS_EXC[*]}" -F '\t' '
function shuffle(arr, n, i, j, tmp) {
    # Fisher-Yates 洗牌算法
    for (i = n; i > 1; i--) {
        j = int(rand() * i) + 1
        tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
    }
}

BEGIN {
    split(ids_inc, arr_inc, " ")
    for (i in arr_inc) { map_inc[arr_inc[i]] = 1 }

    split(ids_exc, arr_exc, " ")
    for (i in arr_exc) { map_exc[arr_exc[i]] = 1 }

    inc_count = 0
    cand_count = 0
}

NF >= 21 && $1 !="" && $2 != "quiz" && $2 != "" {

    if ($1 in map_exc) next

    if ($1 in map_inc) {

        inc_count++
        inc_pool[inc_count] = $0
        inc_pool_f1[inc_count] = $1
        inc_pool_f2[inc_count] = $2
        inc_pool_f3[inc_count] = $3
        inc_pool_f4[inc_count] = $4
        inc_pool_f5[inc_count] = $5
        inc_pool_f6[inc_count] = $6
        inc_pool_f7[inc_count] = $7
        inc_pool_f8[inc_count] = $8
        inc_pool_f9[inc_count] = $9
        inc_pool_f10[inc_count] = $10
        inc_pool_f11[inc_count] = $11
        inc_pool_f12[inc_count] = $12
        inc_pool_f13[inc_count] = $13
        inc_pool_f14[inc_count] = $14
        inc_pool_f15[inc_count] = $15
        inc_pool_f16[inc_count] = $16
        inc_pool_f17[inc_count] = $17
        inc_pool_f18[inc_count] = $18
        inc_pool_f19[inc_count] = $19
        inc_pool_f20[inc_count] = $20
        inc_pool_f21[inc_count] = $21

    } else {

        cand_count++
        cand_pool[cand_count] = $0
        cand_pool_f1[cand_count] = $1
        cand_pool_f2[cand_count] = $2
        cand_pool_f3[cand_count] = $3
        cand_pool_f4[cand_count] = $4
        cand_pool_f5[cand_count] = $5
        cand_pool_f6[cand_count] = $6
        cand_pool_f7[cand_count] = $7
        cand_pool_f8[cand_count] = $8
        cand_pool_f9[cand_count] = $9
        cand_pool_f10[cand_count] = $10
        cand_pool_f11[cand_count] = $11
        cand_pool_f12[cand_count] = $12
        cand_pool_f13[cand_count] = $13
        cand_pool_f14[cand_count] = $14
        cand_pool_f15[cand_count] = $15
        cand_pool_f16[cand_count] = $16
        cand_pool_f17[cand_count] = $17
        cand_pool_f18[cand_count] = $18
        cand_pool_f19[cand_count] = $19
        cand_pool_f20[cand_count] = $20
        cand_pool_f21[cand_count] = $21
    }
}

END {
    printed = 0

    for (i = 1; i <= inc_count; i++) {
        id = inc_pool_f1[i]
        quiz = inc_pool_f2[i]
        opt[1] = inc_pool_f3[i]
        opt[2] = inc_pool_f4[i]
        opt[3] = inc_pool_f5[i]
        opt[4] = inc_pool_f6[i]
        opt[5] = inc_pool_f7[i]
        opt[6] = inc_pool_f8[i]
        opt[7] = inc_pool_f9[i]
        opt[8] = inc_pool_f10[i]
        ans[1] = inc_pool_f11[i]
        ans[2] = inc_pool_f12[i]
        ans[3] = inc_pool_f13[i]
        ans[4] = inc_pool_f14[i]
        ans[5] = inc_pool_f15[i]
        ans[6] = inc_pool_f16[i]
        ans[7] = inc_pool_f17[i]
        ans[8] = inc_pool_f18[i]
        rid = inc_pool_f21[i]

        shuffle(opt, 4)

        #       id	qz	o1	o2	o3	o4	o5	o6	o7	o8	a1	a2	a3	a4	a5	a6	a7	a8	rid
        printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n", id, quiz, opt[1], opt[2], opt[3], opt[4], opt[5], opt[6], opt[7], opt[8], ans[1], ans[2], ans[3], ans[4], ans[5], ans[6], ans[7], ans[8], rid

        printed++
    }

    if (printed < count) {
        needed = count - printed
        limit = ( cand_count < needed ) ? cand_count : needed

        for (j = 1; j <= limit; j++) {
            id = cand_pool_f1[j]
            quiz = cand_pool_f2[j]
            opt[1] = cand_pool_f3[j]
            opt[2] = cand_pool_f4[j]
            opt[3] = cand_pool_f5[j]
            opt[4] = cand_pool_f6[j]
            opt[5] = cand_pool_f7[j]
            opt[6] = cand_pool_f8[j]
            opt[7] = cand_pool_f9[j]
            opt[8] = cand_pool_f10[j]
			ans[1] = cand_pool_f11[j]
			ans[2] = cand_pool_f12[j]
			ans[3] = cand_pool_f13[j]
			ans[4] = cand_pool_f14[j]
			ans[5] = cand_pool_f15[j]
			ans[6] = cand_pool_f16[j]
			ans[7] = cand_pool_f17[j]
			ans[8] = cand_pool_f18[j]
			rid = cand_pool_f21[j]

            shuffle(opt, 4)

            #       id	qz	o1	o2	o3	o4	o5	o6	o7	o8	a1	a2	a3	a4	a5	a6	a7	a8	rid
            printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n", id, quiz, opt[1], opt[2], opt[3], opt[4], opt[5], opt[6], opt[7], opt[8], ans[1], ans[2], ans[3], ans[4], ans[5], ans[6], ans[7], ans[8], rid
        }
    }

}' $QUIZ_BANK | shuf > $QUIZ_OUT
