#!/usr/bin/env bash

set -euo pipefail

# if [[ "$#" -ne 1 ]]; then
# echo "error: must give 1 argument!"
# echo "usage: $0 <user>"
# exit 1
# fi

USER="${NATS_REQUEST_BODY:-${1:-}}"
[[ -z "$USER" || ! -d "../users/$USER" ]] && { echo "[]"; exit 0; }

QUIZ_LIST=$(find "../users/$USER/quiz_bank/" -type f -iname "*.tsv" -printf "%f\n" 2>/dev/null)

if [[ -z "$QUIZ_LIST" ]]; then
    echo "[]"
else
    awk -F. '{print $1}' <<< "$QUIZ_LIST" | jq -R -s 'split("\n") | map(select(length>0))'
fi

# topic: quiz-list
# nats reply "quiz-list" --command="./reply_quiz-list.sh" 2>/dev/null
# nats req "quiz-list" test --raw
