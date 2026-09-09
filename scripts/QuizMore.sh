#!/usr/bin/env bash

# 检查传入的参数个数是否为 2
if [[ "$#" -ne 1 ]]; then
    echo "error: must give 1 argument!"
    echo "usage: $0 <quiz-output-tsv>"
    exit 1
fi

# 获取参数
OUTPUT_QUIZ=$1

# 判断文件名是否包含扩展名（即最后一个斜杠后面是否有小数点）
# ${OUTPUT_QUIZ##*/} 获取不含路径的文件名
if [[ "${OUTPUT_QUIZ##*/}" != *.* ]]; then
    OUTPUT_QUIZ="${OUTPUT_QUIZ}.tsv"
fi

# 1     2       3       4       5       6       7       8       9       10      11      12      13      14      15      16      17      18      19      20      21
# QID	QUIZ	OPT1	OPT2	OPT3	OPT4	OPT5	OPT6	OPT7	OPT8	ANS1	ANS2	ANS3	ANS4	ANS5	ANS6	ANS7	ANS8	EMPTY	EMPTY	RefID
for i in {1..50}; do awk '{printf "%s\tquiz\topt1\topt2\topt3\topt4\t\t\t\t\tans1\t\t\t\t\t\t\t\t\t\tref-id\n", $0}' <<<$(uuidgen); done >> $OUTPUT_QUIZ
