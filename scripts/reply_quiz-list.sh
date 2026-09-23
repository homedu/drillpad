#!/usr/bin/env bash

set -euo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd $SCRIPT_DIR > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

##########################################################

# [[ "$#" -eq 1 ]] || {
#     echo "error: must give 1 argument!"
#     echo "usage: $0 <user>"
#     exit 1
# }

USER="${NATS_REQUEST_BODY:-${1:-}}"
DIR_USER="../users/${USER}"

[[ -n "$USER" && -d "${DIR_USER}" ]] || { echo "[]"; exit 0; }

QUIZ_LIST=$(find "${DIR_USER}/quiz_bank/" -type f -iname "*.tsv" -printf "%f\n" 2>/dev/null)

[[ -n "$QUIZ_LIST" ]] || {	echo "[]";	exit 0; }
awk -F. '{print $1}' <<< "$QUIZ_LIST" | jq -R -s 'split("\n") | map(select(length>0))'

# topic: quiz-list
# nats reply "quiz-list" --command="./reply_quiz-list.sh" 2>/dev/null
# nats req "quiz-list" test --raw
