#!/usr/bin/env bash

# if [[ "$#" -ne 1 ]]; then
#     echo "error: must give 1 argument!"
#     echo "usage: $0 <user>"
#     exit 1
# fi

USER="$NATS_REQUEST_BODY"

# echo "user: $USER"

QUIZ_LIST=$(find "./users/$USER/quiz_bank/" -type f -iname "*.tsv" -printf "%f\n" 2>/dev/null)

if [[ -z "$QUIZ_LIST" ]]; then
    echo "[]"
else
    awk -F. '{printf"%s\n", $1}' <<< "$QUIZ_LIST" | jq -R -s 'split("\n") | map(select(length>0))'
fi

# topic: quiz-list
# nats reply "quiz-list" --command="./reply_quiz_list.sh" 2>/dev/null
# nats req "quiz-list" test --raw
