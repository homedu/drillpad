#!/usr/bin/env bash

set -euo pipefail

# 检查传入的参数个数是否为 2
# if [[ "$#" -ne 3 ]]; then
#     echo "error: must give 3 argument!"
#     echo "usage: $0 <quiz-output-tsv> <quiz count> <quiz type (MCSA/MS/...)>"
#     exit 1
# fi

# 获取参数
OUTPUT_QUIZ="${1:?usage: $0 <quiz-output.tsv> <quiz count> <quiz type (MCSA/MS/...)>}"
QUIZ_COUNT="${2:?usage: $0 <quiz-output.tsv> <quiz count> <quiz type (MCSA/MS/...)>}"
QUIZ_TYPE="${3:?usage: $0 <quiz-output.tsv> <quiz count> <quiz type (MCSA/MS/...)>}"

# 判断文件名是否包含扩展名（即最后一个斜杠后面是否有小数点）
# ${OUTPUT_QUIZ##*/} 获取不含路径的文件名
if [[ "${OUTPUT_QUIZ##*/}" != *.* ]]; then
    OUTPUT_QUIZ="${OUTPUT_QUIZ}.tsv"
fi

for ((i=1; i<=QUIZ_COUNT; i++)); do
    awk -v OFS='\t' -v qt="$QUIZ_TYPE" '{print $0, "quiz", "opt1", "opt2", "opt3", "opt4", "", "", "", "", "ans1", "", "", "", "", "", "", "", "", "", "ref_id", "prompt_id", "note_id", qt}' <<<$(uuidgen)
done >> $OUTPUT_QUIZ
