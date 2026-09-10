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

for i in {1..50}; do
    awk -v OFS='\t' '{print $0, "quiz", "opt1", "opt2", "opt3", "opt4", "", "", "", "", "ans1", "", "", "", "", "", "", "", "", "", "ref-id"}' <<<$(uuidgen)
done >> $OUTPUT_QUIZ
