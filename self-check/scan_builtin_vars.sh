#!/usr/bin/env bash
#
# scan_builtin_vars.sh
# 扫描目录下所有 bash/sh 脚本,找出与 BASH 内建变量同名的自定义变量,并生成 Markdown 报告。
#
# 用法:
#   ./scan_builtin_vars.sh [目录=.] [报告文件=builtin_var_report.md]
#
# 退出码: 0 = 没有发现冲突; 1 = 发现冲突; 2 = 参数错误
#
# 级别:
#   CRITICAL  真正的只读变量,赋值会直接报错 (UID, EUID, PPID, BASHOPTS, SHELLOPTS, BASH_VERSINFO)
#   HIGH      赋值会被忽略或被 shell 自动覆盖 (GROUPS, BASHPID, SECONDS, RANDOM, LINENO, PWD, OPTIND, REPLY ...)
#   MEDIUM    特殊/环境变量,覆盖会改变行为或污染环境 (USER, HOME, PATH, IFS, LINES, COLUMNS, TMPDIR ...)
#
# 检测方式(基于文本的启发式扫描,不是完整的 bash 解析器,结果请人工复核):
#   NAME=...  NAME+=...  NAME[i]=...  local/declare/typeset/readonly/export NAME
#   for/select NAME in   read/mapfile/readarray 的目标变量   getopts 的变量   printf -v NAME
# 自动跳过: 整行注释、双引号/单引号字符串内容、here-doc 正文、跨行的单引号块(如多行 awk/jq 程序)
# 不报告: `IFS= read ...` 这类惯用写法,以及 local IFS

set -u

DIR="${1:-.}"
REPORT="${2:-builtin_var_report.md}"

[[ -d "$DIR" ]] || { echo "error: 不是目录: $DIR" >&2; exit 2; }

TMP=$(mktemp -d) || exit 2
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------------------
# 公共 awk 库: 建议改名 / 原因 / markdown 转义
# ---------------------------------------------------------------------------
cat > "$TMP/lib.awk" <<'AWK'
BEGIN {
    n = split("GROUPS:GROUP_LIST USER:CUR_USER LOGNAME:LOGIN_NAME LINES:MATCHED_LINES COLUMNS:COL_COUNT " \
              "PATH:TARGET_PATH HOME:HOME_DIR SHELL:SHELL_NAME TERM:TERM_NAME PWD:WORK_DIR OLDPWD:PREV_DIR " \
              "SECONDS:ELAPSED_SECS RANDOM:RAND_NUM REPLY:READ_REPLY HOSTNAME:HOST_NAME UID:USER_UID " \
              "EUID:EFFECTIVE_UID PPID:PARENT_PID OPTARG:OPT_ARG OPTIND:OPT_IDX LINENO:LINE_NO " \
              "BASHPID:SELF_PID FUNCNAME:FUNC_NAME TMPDIR:TMP_DIR LANG:LANG_CODE TZ:TIME_ZONE " \
              "IFS:FIELD_SEP PS1:PROMPT_STR MAPFILE:MAP_LINES SHLVL:SHELL_LEVEL", pairs, " ")
    for (i = 1; i <= n; i++) { split(pairs[i], kv, ":"); sg[kv[1]] = kv[2] }
}
function suggest(name) { return (name in sg) ? sg[name] : "MY_" name }
function reason(s) {
    if (s == "CRITICAL") return "只读变量,赋值会报错"
    if (s == "HIGH")     return "shell 自动维护,赋值被忽略或被覆盖"
    return "特殊/环境变量,覆盖会影响行为"
}
# 把 | 换成 ¦、` 换成 ',避免破坏 markdown 表格
function esc(t) { gsub(/\|/, "¦", t); gsub(/`/, "'", t); return t }
AWK

# ---------------------------------------------------------------------------
# 扫描用 awk: 输出 TSV  级别 \t 文件 \t 行号 \t 变量名 \t 方式 \t 原始代码
# ---------------------------------------------------------------------------
cat > "$TMP/scan.awk" <<'AWK'
function addlist(str, level,   a, n, i) {
    n = split(str, a, " ")
    for (i = 1; i <= n; i++) sev[a[i]] = level
}
BEGIN {
    addlist("BASHOPTS SHELLOPTS EUID UID PPID BASH_VERSINFO", "CRITICAL")
    addlist("GROUPS BASHPID FUNCNAME DIRSTACK BASH BASH_VERSION BASH_SUBSHELL BASH_COMMAND BASH_SOURCE " \
            "BASH_LINENO BASH_ARGC BASH_ARGV BASH_ARGV0 BASH_ALIASES BASH_CMDS BASH_REMATCH SHLVL " \
            "HOSTNAME HOSTTYPE OSTYPE MACHTYPE RANDOM SRANDOM SECONDS EPOCHSECONDS EPOCHREALTIME " \
            "LINENO PWD OLDPWD PIPESTATUS COPROC OPTIND OPTARG OPTERR REPLY HISTCMD", "HIGH")
    addlist("USER LOGNAME HOME PATH IFS SHELL TERM LINES COLUMNS PS1 PS2 PS3 PS4 PROMPT_COMMAND " \
            "TIMEFORMAT TMOUT TMPDIR LANG LANGUAGE TZ MAIL MAILPATH MAILCHECK CDPATH GLOBIGNORE FIGNORE " \
            "HISTFILE HISTSIZE HISTFILESIZE HISTCONTROL HISTIGNORE HISTTIMEFORMAT HOSTFILE INPUTRC " \
            "IGNOREEOF POSIXLY_CORRECT ENV MAPFILE FCEDIT EXECIGNORE CHILD_MAX auto_resume histchars " \
            "BASH_ENV BASH_XTRACEFD BASH_COMPAT BASH_LOADABLES_PATH", "MEDIUM")
}

function classify(n) {
    if (n in sev) return sev[n]
    if (n ~ /^COMP_/) return "HIGH"
    if (n ~ /^BASH_/) return "HIGH"
    if (n ~ /^LC_/)   return "MEDIUM"
    return ""
}

function rec(name, kind,   s, o, key) {
    s = classify(name)
    if (s == "") return
    # 惯用写法不报告: IFS= read ... / local IFS
    if (name == "IFS" && (kind == "local" || line ~ /IFS=[^ \t]*[ \t]+(read|while|mapfile|readarray)/)) return
    key = FNR SUBSEP name
    if (key in done) return
    done[key] = 1
    o = raw
    gsub(/\t/, " ", o); sub(/^ +/, "", o); sub(/ +$/, "", o)
    if (length(o) > 110) o = substr(o, 1, 107) "..."
    printf "%s\t%s\t%d\t%s\t%s\t%s\n", s, file, FNR, name, kind, o
}

function kindof(l) {
    if (l ~ /(^|[ \t;&|({])local[ \t]/)    return "local"
    if (l ~ /(^|[ \t;&|({])readonly[ \t]/) return "readonly"
    if (l ~ /(^|[ \t;&|({])(declare|typeset)[ \t]/) return "declare"
    if (l ~ /(^|[ \t;&|({])export[ \t]/)   return "export"
    return "assign"
}

{
    raw = $0
    sub(/\r$/, "", raw)
    line = raw

    # here-doc 正文: 跳过直到结束标记
    if (inhd) { t = line; sub(/^[ \t]+/, "", t); sub(/[ \t]+$/, "", t); if (t == hd) inhd = 0; next }

    # 跨行单引号块(多行 awk/jq 程序等): 跳过,直到引号闭合
    if (inSQ) { n = gsub(/'/, "'", line); if (n % 2 == 1) inSQ = 0; next }

    if (line ~ /^[ \t]*#/) next

    # 在清理引号前先检测 here-doc 起始,处理完本行后再生效
    newhd = ""
    if (match(raw, /(^|[^<])<<-?[ \t]*['"]?[A-Za-z_]/)) {
        s = substr(raw, RSTART + RLENGTH - 1)
        match(s, /^[A-Za-z_][A-Za-z0-9_]*/)
        newhd = substr(s, 1, RLENGTH)
    }

    # 清理字符串与行尾注释
    gsub(/"[^"]*"/, "\"\"", line)
    gsub(/\\'/, "", line)
    gsub(/'[^']*'/, "\"\"", line)
    p = index(line, "'")
    if (p) { inSQ = 1; line = substr(line, 1, p - 1) }
    gsub(/[ \t]+#.*$/, "", line)

    # 1) 赋值: NAME= / NAME+= / NAME[i]=
    s = line
    while (match(s, /(^|[^]A-Za-z0-9_${}.\/-])[A-Za-z_][A-Za-z0-9_]*(\[[^]]*\])?\+?=([^=~]|$)/)) {
        m = substr(s, RSTART, RLENGTH)
        s = substr(s, RSTART + RLENGTH - 1)
        sub(/^[^A-Za-z_]+/, "", m)
        match(m, /^[A-Za-z_][A-Za-z0-9_]*/)
        rec(substr(m, 1, RLENGTH), kindof(line))
    }

    # 2) for / select NAME in
    if (match(line, /(^|[ \t;&|({])(for|select)[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]+in([ \t]|$)/)) {
        seg = substr(line, RSTART, RLENGTH); sub(/^[ \t;&|({]+/, "", seg)
        split(seg, tk, /[ \t]+/); rec(tk[2], tk[1])
    }

    # 3) read / mapfile / readarray 的目标变量
    s = line
    while (match(s, /(^|[ \t;&|({])(read|mapfile|readarray)[ \t]+[^;&|)<>]*/)) {
        seg = substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH)
        sub(/^[ \t;&|({]+/, "", seg)
        n = split(seg, tk, /[ \t]+/)
        cmd = tk[1]
        argopts = (cmd == "read") ? "dnNptu" : "dnOsCcu"
        skip = 0
        for (i = 2; i <= n; i++) {
            t = tk[i]
            if (t == "") continue
            if (skip) { skip = 0; continue }
            if (t ~ /^-/) {
                last = substr(t, length(t), 1)
                if (t ~ /^-[A-Za-z]+$/ && index(argopts, last) > 0) skip = 1
                continue
            }
            if (t ~ /^[A-Za-z_][A-Za-z0-9_]*$/) rec(t, cmd)
        }
    }

    # 4) getopts optstring NAME
    if (match(line, /(^|[ \t;&|({])getopts[ \t]+[^ \t]+[ \t]+[A-Za-z_][A-Za-z0-9_]*/)) {
        seg = substr(line, RSTART, RLENGTH); sub(/^[ \t;&|({]+/, "", seg)
        split(seg, tk, /[ \t]+/); rec(tk[3], "getopts")
    }

    # 5) printf -v NAME
    if (match(line, /printf[ \t]+-v[ \t]+[A-Za-z_][A-Za-z0-9_]*/)) {
        seg = substr(line, RSTART, RLENGTH)
        split(seg, tk, /[ \t]+/); rec(tk[3], "printf -v")
    }

    # 6) local / declare / typeset / readonly / export NAME (含不带 = 的声明)
    s = line
    while (match(s, /(^|[ \t;&|({])(local|declare|typeset|readonly|export)[ \t]+[^;&|)]*/)) {
        seg = substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH)
        sub(/^[ \t;&|({]+/, "", seg)
        n = split(seg, tk, /[ \t]+/)
        kind = tk[1]
        for (i = 2; i <= n; i++) {
            t = tk[i]
            if (t == "" || t ~ /^[-+]/) continue
            nm = t; sub(/[=\[+].*$/, "", nm)
            if (nm ~ /^[A-Za-z_][A-Za-z0-9_]*$/) rec(nm, kind)
        }
    }

    if (newhd != "") { inhd = 1; hd = newhd }
}
AWK

# ---------------------------------------------------------------------------
# 找脚本: *.sh / *.bash,以及 shebang 是 bash/sh 的无扩展名文件
# ---------------------------------------------------------------------------
FINDINGS="$TMP/findings.tsv"; : > "$FINDINGS"
SCANNED_LIST="$TMP/scanned.txt"; : > "$SCANNED_LIST"
SHEBANG_RE='^#!.*(/|[[:space:]])(ba)?sh([[:space:]]|$)'
REPORT_ABS=$(cd "$(dirname "$REPORT")" 2>/dev/null && pwd)/$(basename "$REPORT")

while IFS= read -r -d '' f; do
    [[ "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")" == "$REPORT_ABS" ]] && continue
    ok=0
    case "$f" in
        *.sh|*.bash) ok=1 ;;
        *.*) ok=0 ;;
        *)
            first=$(head -c 200 "$f" 2>/dev/null | head -n 1 | tr -d '\0')
            [[ "$first" =~ $SHEBANG_RE ]] && ok=1
        ;;
    esac
    (( ok )) || continue
    echo "$f" >> "$SCANNED_LIST"
    awk -v file="$f" -f "$TMP/scan.awk" "$f" >> "$FINDINGS"
done < <(find "$DIR" \( -name .git -o -name node_modules \) -prune -o \
    -type f -size -2048k -print0 2>/dev/null)

SCANNED=$(wc -l < "$SCANNED_LIST" | tr -d ' ')
TOTAL=$(wc -l < "$FINDINGS" | tr -d ' ')
FILES_WITH=$(cut -f2 "$FINDINGS" | sort -u | wc -l | tr -d ' ')
N_CRIT=$(awk -F'\t' '$1=="CRITICAL"' "$FINDINGS" | wc -l | tr -d ' ')
N_HIGH=$(awk -F'\t' '$1=="HIGH"' "$FINDINGS" | wc -l | tr -d ' ')
N_MED=$(awk -F'\t' '$1=="MEDIUM"' "$FINDINGS" | wc -l | tr -d ' ')

# ---------------------------------------------------------------------------
# 报告用 awk (汇总表 / 明细表)
# ---------------------------------------------------------------------------
cat > "$TMP/summary_fmt.awk" <<'AWK'
{ printf "| %s | `%s` | %d | %d | `%s` | %s |\n", $4, $3, $5, $6, suggest($3), reason($4) }
AWK

cat > "$TMP/detail_fmt.awk" <<'AWK'
BEGIN { FS = "\t" }
$2 != cur {
    if (cur != "") print ""
    cur = $2
    printf "### `%s`\n\n", cur
    print "| 行 | 级别 | 变量 | 方式 | 建议改名 | 代码 |"
    print "|---|---|---|---|---|---|"
}
{ printf "| %d | %s | `%s` | %s | `%s` | `%s` |\n", $3, $1, $4, $5, suggest($4), esc($6) }
AWK

# ---------------------------------------------------------------------------
# 生成报告
# ---------------------------------------------------------------------------
{
    echo "# BASH 内建变量名冲突检查报告"
    echo
    echo "- 生成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "- 扫描目录: \`$DIR\`"
    echo "- 扫描脚本数: $SCANNED"
    echo "- 有冲突的脚本数: $FILES_WITH"
    echo "- 冲突总数: $TOTAL"
    echo
    echo "| 级别 | 数量 | 含义 |"
    echo "|---|---|---|"
    echo "| CRITICAL | $N_CRIT | 只读变量,赋值会直接报错,必须改 |"
    echo "| HIGH | $N_HIGH | 赋值被忽略或被 shell 覆盖,隐蔽 bug,强烈建议改 |"
    echo "| MEDIUM | $N_MED | 特殊/环境变量,覆盖会影响行为,建议改 |"
    echo

    if (( TOTAL == 0 )); then
        echo "未发现与内建变量冲突的自定义变量。"
    else
        echo "## 一、按变量名汇总"
        echo
        echo "| 级别 | 变量 | 出现次数 | 涉及脚本数 | 建议改名 | 原因 |"
        echo "|---|---|---|---|---|---|"
        awk -F'\t' '
        { cnt[$4]++; s[$4] = $1; if (!(($4, $2) in fs)) { fs[$4, $2] = 1; nf[$4]++ } }
        END {
            for (n in cnt) {
                r = (s[n] == "CRITICAL") ? 1 : (s[n] == "HIGH") ? 2 : 3
                printf "%d\t%09d\t%s\t%s\t%d\t%d\n", r, 999999999 - cnt[n], n, s[n], cnt[n], nf[n]
            }
        }' "$FINDINGS" \
            | sort -t$'\t' -k1,1n -k2,2n -k3,3 \
            | awk -F'\t' -f "$TMP/lib.awk" -f "$TMP/summary_fmt.awk"
        echo
        echo "## 二、按脚本明细"
        echo
        sort -t$'\t' -k2,2 -k3,3n "$FINDINGS" \
            | awk -f "$TMP/lib.awk" -f "$TMP/detail_fmt.awk"
    fi
} > "$REPORT"

echo "扫描脚本: $SCANNED  有冲突脚本: $FILES_WITH  冲突: $TOTAL (CRITICAL=$N_CRIT HIGH=$N_HIGH MEDIUM=$N_MED)"
echo "报告已生成: $REPORT"

(( TOTAL > 0 )) && exit 1
exit 0
