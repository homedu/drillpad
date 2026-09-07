#!/usr/bin/env bash

if [[ "$#" -ne 3 ]]; then
    echo "error: must give 3 arguments!"
    echo "usage: $0 <record-correct> <record-incorrect> <record-blank>; Also ENV [IDS_CORRECT] [IDS_INCORRECT] [IDS_BLANK]"
    exit 1
fi

REC_CORRECT=$1
REC_INCORRECT=$2
REC_BLANK=$3

declare -a IDS_CORRECT=($IDS_CORRECT)
declare -a IDS_INCORRECT=($IDS_INCORRECT)
declare -a IDS_BLANK=($IDS_BLANK)

# echo "--- IDS_CORRECT ---"
for item in "${IDS_CORRECT[@]}"; do
    echo "$item" >> $REC_CORRECT
done

# echo "--- IDS_INCORRECT ---"
for item in "${IDS_INCORRECT[@]}"; do
    echo "$item" >> $REC_INCORRECT
done

# echo "--- IDS_BLANK ---"
for item in "${IDS_BLANK[@]}"; do
    echo "$item" >> $REC_BLANK
done
