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

##########################################################

# 检查传入的参数个数是否为 3
# [[ "$#" -eq 3 ]] || {
#     echo "error: must give 3 argument!"
#     echo "usage: $0 <quiz-out-tsv> <count> <type (MCSA/MS/...)>"
#     exit 1
# }

# 获取参数
OUTPUT_QUIZ="${1:?usage: $0 <quiz-out.tsv> [count] [type (MCSA/MS/...)]}"
QUIZ_COUNT="${2:-20}"  # 默认生成 20 道题模板
QUESTION_TYPE="${3:-MCSA}"  # 默认 question type 为 MCSA

# 判断文件名是否包含扩展名（即最后一个斜杠后面是否有小数点）
# ${OUTPUT_QUIZ##*/} 获取不含路径的文件名
[[ "${OUTPUT_QUIZ##*/}" == *.* ]] || OUTPUT_QUIZ="${OUTPUT_QUIZ}.tsv"

ensure_file OUTPUT_QUIZ="${OUTPUT_QUIZ}" || { echo $?; exit 1; }

for ((i=1; i<=QUIZ_COUNT; i++)); do
    awk -v OFS='\t' -v qt="$QUESTION_TYPE" '{print $0, "quiz", "opt1", "opt2", "opt3", "opt4", "", "", "", "", "ans1", "", "", "", "", "", "", "", "", "", "ref_id", "prompt_id", qt}' <<<$(uuidgen)
done >> $OUTPUT_QUIZ
