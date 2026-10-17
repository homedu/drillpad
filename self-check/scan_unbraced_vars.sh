#!/usr/bin/env bash
#
# scan_unbraced_vars.sh
# 扫描目录下所有 bash/sh 脚本,找出没有加大括号的变量取值(如 $ABC,应写成 ${ABC}),并生成 Markdown 报告。
#
# 用法:
#   ./scan_unbraced_vars.sh [-p] [目录=.] [报告文件=unbraced_var_report.md]
#     -p   同时检查位置参数 $0 ~ $9(默认不检查,只检查命名变量)
#     -h   显示帮助
#
# 退出码: 0 = 没有发现; 1 = 发现未加括号的变量; 2 = 参数错误
#
# 检测规则(基于逐字符状态机的启发式扫描,不是完整的 bash 解析器,结果请人工复核):
#   会检测: 双引号内、未加引号处、未加引号的 here-doc 正文(这些位置变量都会被展开)
#   会跳过: 单引号内容(字面量,如 awk/jq 程序)、<<'EOF' 形式的 here-doc、\$ABC 转义、
#           整行/行尾注释、$( ) $(( )) ${ } $'...' 等非"裸变量名"写法
#   永远不报: 特殊参数 $@ $* $# $? $$ $! $- $_  (默认也不报 $0~$9,用 -p 打开)
#
# 每个命中行会给出"建议改写"后的整行,可直接对照修改。本脚本只检测,不改文件。

set -u

usage() {
    sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

POS=0
while getopts ":ph" OPT; do
    case "${OPT}" in
        p) POS=1 ;;
        h) usage; exit 0 ;;
        *) usage >&2; exit 2 ;;
    esac
done
shift $((OPTIND - 1))

DIR="${1:-.}"
REPORT="${2:-unbraced_var_report.md}"

[[ -d "${DIR}" ]] || { echo "error: 不是目录: ${DIR}" >&2; exit 2; }

TMP=$(mktemp -d) || exit 2
trap 'rm -rf "${TMP}"' EXIT

# ---------------------------------------------------------------------------
# 扫描用 awk: 输出 TSV  文件 \t 行号 \t 命中次数 \t 变量名(逗号分隔,去重) \t 原始代码 \t 建议改写
# ---------------------------------------------------------------------------
cat > "${TMP}/scan.awk" <<'AWK'
# 逐字符扫描一行,返回把 $NAME 改写成 ${NAME} 后的文本;
# 命中信息通过全局变量 hitcnt / hitnames 返回。
# plain=1 表示 here-doc 正文: 不处理引号和注释,只处理 \ 转义。
function process(s, plain,   i, n, c, out, rest, name) {
    n = length(s); out = ""; hitcnt = 0; hitnames = ""; split("", uniq)
    for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        if (!plain) {
            if (inSQ) { out = out c; if (c == "'") inSQ = 0; continue }
            if (c == "\\") { out = out c substr(s, i + 1, 1); i++; continue }
            if (inDQ) {
                if (c == "\"") { inDQ = 0; out = out c; continue }
            } else {
                if (c == "'")  { inSQ = 1; out = out c; continue }
                if (c == "\"") { inDQ = 1; out = out c; continue }
                if (c == "#" && (i == 1 || substr(s, i - 1, 1) ~ /[ \t;&|(]/)) {
                    out = out substr(s, i); break
                }
            }
        } else if (c == "\\") {
            out = out c substr(s, i + 1, 1); i++; continue
        }
        if (c == "$") {
            rest = substr(s, i + 1)
            name = ""
            if (match(rest, /^[A-Za-z_][A-Za-z0-9_]*/)) {
                name = substr(rest, 1, RLENGTH)
                if (name == "_") name = ""
            } else if (pos && match(rest, /^[0-9]/)) {
                name = substr(rest, 1, 1)
            }
            if (name != "") {
                hitcnt++
                if (!(name in uniq)) { uniq[name] = 1; hitnames = hitnames (hitnames == "" ? "" : ",") name }
                out = out "${" name "}"
                i += length(name)
                continue
            }
        }
        out = out c
    }
    return out
}

function tidy(t) {
    gsub(/\t/, " ", t); sub(/^ +/, "", t); sub(/ +$/, "", t)
    if (length(t) > 140) t = substr(t, 1, 137) "..."
    return t
}

{
    raw = $0
    sub(/\r$/, "", raw)

    if (inHD) {
        t = raw; sub(/^[ \t]+/, "", t); sub(/[ \t]+$/, "", t)
        if (t == hd) { inHD = 0; next }
        if (hdq) next
        fixed = process(raw, 1)
    } else {
        fixed = process(raw, 0)
        # 登记 here-doc 起始(本行已扫描完毕,下一行起生效);状态不干净时不登记
        if (!inSQ && !inDQ && match(raw, /(^|[ \t])<<-?[ \t]*['"\\]?[A-Za-z_]/)) {
            prev = substr(raw, RSTART + RLENGTH - 2, 1)
            s2 = substr(raw, RSTART + RLENGTH - 1)
            match(s2, /^[A-Za-z_][A-Za-z0-9_]*/)
            hd = substr(s2, 1, RLENGTH)
            hdq = (prev == "'" || prev == "\"" || prev == "\\")
            inHD = 1
        }
    }

    if (hitcnt > 0)
        printf "%s\t%d\t%d\t%s\t%s\t%s\n", file, FNR, hitcnt, hitnames, tidy(raw), tidy(fixed)
}

END {
    if (inHD) printf "未闭合的 here-doc(结束标记 %s),其后内容可能被漏扫: %s\n", hd, file > "/dev/stderr"
    else if (inSQ) printf "文件结束时单引号未闭合,可能存在漏扫/误判: %s\n", file > "/dev/stderr"
    else if (inDQ) printf "文件结束时双引号未闭合,可能存在漏扫/误判: %s\n", file > "/dev/stderr"
}
AWK

# ---------------------------------------------------------------------------
# 找脚本: *.sh / *.bash,以及 shebang 是 bash/sh 的无扩展名文件
# ---------------------------------------------------------------------------
FINDINGS="${TMP}/findings.tsv"; : > "${FINDINGS}"
SCANNED_LIST="${TMP}/scanned.txt"; : > "${SCANNED_LIST}"
WARN_FILE="${TMP}/warn.txt"; : > "${WARN_FILE}"
SHEBANG_RE='^#!.*(/|[[:space:]])(ba)?sh([[:space:]]|$)'

while IFS= read -r -d '' F; do
    [[ "${F}" -ef "${REPORT}" ]] && continue
    OK=0
    case "${F}" in
        *.sh|*.bash) OK=1 ;;
        *.*) OK=0 ;;
        *)
            FIRST=$(head -c 200 "${F}" 2>/dev/null | head -n 1 | tr -d '\0')
            [[ "${FIRST}" =~ ${SHEBANG_RE} ]] && OK=1
            ;;
    esac
    (( OK )) || continue
    echo "${F}" >> "${SCANNED_LIST}"
    awk -v file="${F}" -v pos="${POS}" -f "${TMP}/scan.awk" "${F}" >> "${FINDINGS}" 2>> "${WARN_FILE}"
done < <(find "${DIR}" \( -name .git -o -name node_modules \) -prune -o \
              -type f -size -2048k -print0 2>/dev/null)

SCANNED=$(wc -l < "${SCANNED_LIST}" | tr -d ' ')
LINES_HIT=$(wc -l < "${FINDINGS}" | tr -d ' ')
FILES_HIT=$(cut -f1 "${FINDINGS}" | sort -u | wc -l | tr -d ' ')
OCCUR=$(awk -F'\t' '{ s += $3 } END { print s + 0 }' "${FINDINGS}")
WARN_COUNT=$(wc -l < "${WARN_FILE}" | tr -d ' ')

# ---------------------------------------------------------------------------
# 报告用 awk
# ---------------------------------------------------------------------------
cat > "${TMP}/by_var.awk" <<'AWK'
BEGIN { FS = "\t" }
{
    n = split($4, a, ",")
    for (i = 1; i <= n; i++) {
        cnt[a[i]]++
        if (!((a[i], $1) in fs)) { fs[a[i], $1] = 1; nf[a[i]]++ }
    }
}
END { for (v in cnt) printf "%09d\t%s\t%d\t%d\n", 999999999 - cnt[v], v, cnt[v], nf[v] }
AWK

cat > "${TMP}/by_file.awk" <<'AWK'
BEGIN { FS = "\t" }
{ l[$1]++; o[$1] += $3 }
END { for (f in l) printf "%09d\t%s\t%d\t%d\n", 999999999 - o[f], f, l[f], o[f] }
AWK

cat > "${TMP}/detail.awk" <<'AWK'
BEGIN { FS = "\t" }
# 把 | 换成 ¦、` 换成 ',避免破坏 markdown 表格
function esc(t) { gsub(/\|/, "¦", t); gsub(/`/, "'", t); return t }
$1 != cur {
    if (cur != "") print ""
    cur = $1
    printf "### `%s`\n\n", cur
    print "| 行 | 变量 | 原代码 | 建议改写 |"
    print "|---|---|---|---|"
}
{ printf "| %d | %s | `%s` | `%s` |\n", $2, $4, esc($5), esc($6) }
AWK

# ---------------------------------------------------------------------------
# 生成报告
# ---------------------------------------------------------------------------
{
    echo "# 未加大括号的变量取值检查报告"
    echo
    echo "- 生成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "- 扫描目录: \`${DIR}\`"
    echo "- 位置参数 \$0~\$9: $( (( POS )) && echo '已检查(-p)' || echo '未检查' )"
    echo "- 扫描脚本数: ${SCANNED}"
    echo "- 有问题的脚本数: ${FILES_HIT}"
    echo "- 有问题的行数: ${LINES_HIT}"
    echo "- 未加括号的取值总次数: ${OCCUR}"
    echo

    if (( LINES_HIT == 0 )); then
        echo "未发现未加大括号的变量取值。"
    else
        echo "## 一、按脚本统计"
        echo
        echo "| 脚本 | 问题行数 | 取值次数 |"
        echo "|---|---|---|"
        awk -f "${TMP}/by_file.awk" "${FINDINGS}" \
            | sort -t$'\t' -k1,1n -k2,2 \
            | awk -F'\t' '{ printf "| `%s` | %d | %d |\n", $2, $3, $4 }'
        echo
        echo "## 二、按变量名统计"
        echo
        echo "| 变量 | 出现行数 | 涉及脚本数 | 建议写法 |"
        echo "|---|---|---|---|"
        awk -f "${TMP}/by_var.awk" "${FINDINGS}" \
            | sort -t$'\t' -k1,1n -k2,2 \
            | awk -F'\t' '{ printf "| `%s` | %d | %d | `${%s}` |\n", $2, $3, $4, $2 }'
        echo
        echo "## 三、按脚本明细"
        echo
        sort -t$'\t' -k1,1 -k2,2n "${FINDINGS}" | awk -f "${TMP}/detail.awk"
    fi

    if (( WARN_COUNT > 0 )); then
        echo
        echo "## 警告"
        echo
        echo "以下文件的引号或 here-doc 状态异常,扫描结果可能不完整,请人工检查:"
        echo
        sed 's/^/- /' "${WARN_FILE}"
    fi
} > "${REPORT}"

echo "扫描脚本: ${SCANNED}  有问题脚本: ${FILES_HIT}  问题行: ${LINES_HIT}  取值次数: ${OCCUR}  警告: ${WARN_COUNT}"
echo "报告已生成: ${REPORT}"

(( LINES_HIT > 0 )) && exit 1
exit 0
