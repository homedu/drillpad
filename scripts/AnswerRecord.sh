#!/usr/bin/env bash

if [[ "$#" -ne 3 ]]; then
    echo "error: must give 3 arguments!"
    echo "usage: $0 <answer-correct-output> <answer-incorrect-output> <answer-blank-output>; Also ENV [IDS_CORRECT] [IDS_INCORRECT] [IDS_BLANK]"
    exit 1
fi

ANS_CORRECT_OUT=$1
ANS_INCORRECT_OUT=$2
ANS_BLANK_OUT=$3

declare -a IDS_CORRECT=($IDS_CORRECT)
declare -a IDS_INCORRECT=($IDS_INCORRECT)
declare -a IDS_BLANK=($IDS_BLANK)


# echo "--- IDS_CORRECT ---"
for item in "${IDS_CORRECT[@]}"; do
    echo "$item" >> $ANS_CORRECT_OUT 
done

# echo "--- IDS_INCORRECT ---"
for item in "${IDS_INCORRECT[@]}"; do
    echo "$item" >> $ANS_INCORRECT_OUT
done

# echo "--- IDS_BLANK ---"
for item in "${IDS_BLANK[@]}"; do
    echo "$item" >> $ANS_BLANK_OUT
done



