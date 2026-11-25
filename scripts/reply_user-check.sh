#!/usr/bin/env bash

set -euo pipefail

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd ${SCRIPT_DIR} > /dev/null
on_exit() {
    popd > /dev/null
}
trap on_exit EXIT

source "./utils/path_assign.sh"
source "./utils/trap_ex.sh"
source "./utils/trim.sh"

##########################################################

CHECK_USER="${NATS_REQUEST_BODY:-${*:-}}"
trim_inplace CHECK_USER "/EDITOR"
trim_inplace CHECK_USER "/editor"

echo ${CHECK_USER} >> debug.txt

ensure_dir DIR_USERS="../users"
USER_LIST=$(find "${DIR_USERS}" -maxdepth 1 -mindepth 1 -type d -printf "%f\n" | LC_ALL=C sort 2>/dev/null) # %p: path; %f: filename

if [[ "${CHECK_USER}" == "*USER-LIST*" ]]; then
    awk -F. '{print $1}' <<< "${USER_LIST}" | jq -R -s 'split("\n") | map(select(length>0))'
    exit 0
fi

# -F：将目标视为普通字符串，不解析正则特殊字符（如 .、*）
# -x：整行完全匹配（防止 "app" 误匹配到 "apple"）
# -q：静默模式，只返回状态码
if grep -Fxq -- "$CHECK_USER" <<< "${USER_LIST}"; then
    echo true
    exit 0
fi

echo false
