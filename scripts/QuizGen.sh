#!/usr/bin/env bash

if [[ "$#" -ne 3 ]]; then
    echo "error：must give 3 arguments!"
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
#     echo "Item: $item"
# done

# echo "--- IDS_EXC ---"
# for item in "${IDS_EXC[@]}"; do
#     echo "Item: $item"
# done

# 判断文件名是否包含扩展名（即最后一个斜杠后面是否有小数点）
# ${QUIZ##*/} 获取不含路径的文件名
if [[ "${QUIZ_BANK##*/}" != *.* ]]; then
    QUIZ_BANK="${QUIZ_BANK}.tsv"
fi

# 检查参数是否存在
if [[ ! -f "$QUIZ_BANK" ]]; then
    echo "error：bank quiz file (${QUIZ_BANK}) is not found"
    exit 1
fi

mkdir -p "$(dirname "$QUIZ_OUT")"

if [[ "${QUIZ_OUT##*/}" != *.* ]]; then
    QUIZ_OUT="${QUIZ_OUT}.tsv"
fi

# if [[ "${#IDS_INC[@]}" -eq 0 ]]; then
#     echo "error"
#     exit 1
# fi

# if [[ "${#IDS_EXC[@]}" -eq 0 ]]; then
#     echo "error"
#     exit 1
# fi

awk -v count="$COUNT" -v ids_inc="${IDS_INC[*]}" -v ids_exc="${IDS_EXC[*]}" -F '\t' '
function shuffle(arr, n,    i, j, tmp) {
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

NF >= 10 && $3 != "" {
    
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
        ans = inc_pool_f10[i]
                
        shuffle(opt, 4)
        printf "%s\t%s\t%s\t%s\t%s\t%s\t\t%s\n", id, quiz, opt[1], opt[2], opt[3], opt[4], ans
        
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
            ans = cand_pool_f10[j]
            
            shuffle(opt, 4)
            printf "%s\t%s\t%s\t%s\t%s\t%s\t\t%s\n", id, quiz, opt[1], opt[2], opt[3], opt[4], ans
        }
    }

}' $QUIZ_BANK | shuf > $QUIZ_OUT


