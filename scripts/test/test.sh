#!/usr/bin/env bash

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd $SCRIPT_DIR > /dev/null
on_exit() {
    echo "on_exit"
    popd > /dev/null
}
trap on_exit EXIT

# #########################################################

# source "$(dirname "${BASH_SOURCE[0]}")/../utils/ensure_df.sh"

source "../utils/ensure_df.sh"
source "../utils/trap.sh"

# #########################################################

rmf() {
    echo "removing file ${FILE}"
    rm -rf ${FILE}
    echo "file ${FILE} is removed"
}

rmd() {
    echo "removing dir ${DIR}"
    rm -rf ${DIR}
    echo "dir ${DIR} is removed"
}

ensure_file FILE="${1:?error: file path arg is missing}" || { echo $?; exit 1;}
echo "file $FILE created"

ensure_dir DIR="$(dirname $FILE)" || { echo $?; exit 1;}
echo "dir $DIR created"

defer_trap rmd EXIT
defer_trap rmf EXIT

require_file FILE="./c/a.txt" || { echo $?; exit 1;}
echo "$FILE is existing"

require_dir DIR="./c" || { echo $?; exit 1;}
echo "$DIR is existing"
