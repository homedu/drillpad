#!/usr/bin/env bash

# 开启严格模式：任何命令出错立即退出、未定义变量报错、管道中任意环节出错都算失败。
# 原脚本没有这个，如果某一步 awk 出错，后面的 mv 依然会执行，可能用一个空/半截文件覆盖掉原始数据。
set -uo pipefail # 'set -e' forces bash exit immediately, cannot run remainder code

##########################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd $SCRIPT_DIR > /dev/null
on_exit() {
    cleanup
    popd > /dev/null
}
trap on_exit EXIT

##########################################################

# 主循环控制标志，收到 SIGHUP 后置 0 退出
_running=1

# 记录本次运行中用过的锁文件，退出时统一清理
declare -A _LOCKS=()

log() {
    printf '%s %s\n' "$(date '+%F %T')" "$*" >&2
}

# ------------------------------------------------------------------
# 信号处理
# ------------------------------------------------------------------
# tmux 在窗口/pane 被关闭（或整个 session/server 关闭）时，
# 会向其内运行的前台进程发送 SIGHUP —— 这就是"tmux 的关闭通知"。
# 只有收到它，脚本才认为应该真正退出。
on_tmux_hangup() {
    log "收到 SIGHUP (视为 tmux 关闭通知)，准备退出主循环..."
    _running=0
}
trap on_tmux_hangup SIGHUP

# Ctrl+C / kill 等其它信号：不是 tmux 的"关闭通知",
# 但也做兜底处理，避免脚本变成杀不掉的僵尸循环。
on_term() {
    log "收到终止信号 (非 tmux 关闭通知)，一并退出..."
    _running=0
}
trap on_term SIGINT SIGTERM

# ------------------------------------------------------------------
# check flock
# ------------------------------------------------------------------
command -v flock >/dev/null 2>&1 || {
    echo "错误: 系统未安装 flock"
    exit 1
}

# ------------------------------------------------------------------
# 参数解析
# ------------------------------------------------------------------
ROOT_DIR="${1:?用法: $0 <目录> [间隔秒数]}"
INTERVAL="${2:-60}"  # 默认每 60 秒扫描一次
TARGET_NAME="correct.tsv"

[[ -d "$ROOT_DIR" ]] || {
    echo "错误: 不是有效目录: $ROOT_DIR" >&2
    exit 1
}

# ------------------------------------------------------------------
# 单个文件的处理：用 awk 遍历每一行，判断是否过期
# （逻辑与原脚本一致；ebhs.tsv / rec.lock 放在该 correct.tsv 所在目录）
# ------------------------------------------------------------------
scan_file() {
    local rec_file="$1"
    local d; d="$(dirname "$rec_file")"

    [[ -f "$rec_file" ]] || {
        log "文件不存在，跳过本次扫描: $rec_file"
        return 0
    }

    # 用 { ...; } 9>lockfile 的形式持锁：块结束时 fd 9 自动关闭，
    # 且打开锁文件失败（如无权限）时只会让本文件失败，不会让整个脚本退出
    local LOCK_FILE="$d/rec.lock"; echo "${LOCK_FILE} --- Ebbinghaus" >> debug.txt
    _LOCKS["$LOCK_FILE"]=1
    {
        flock -w 5 9 || {
            log "获取文件锁超时，跳过: $rec_file"
            return 1
        }

        local now_epoch; now_epoch=$(date +%s)
        local ebhs_file="$d/ebhs.tsv"
        local tmp_file="${rec_file}.tmp.$$"
        awk -F'\t' -v now="$now_epoch" -v ebhs_file="$ebhs_file" '
            # 把 "day/hour/min/sec/week" 这类单位换算成秒
            function unit_to_sec(u) {
                u = tolower(u)
                if (u ~ /^s/)              return 1         # sec / second(s)
                if (u ~ /^min|^m$/)        return 60        # min / minute(s)
                if (u ~ /^h/)              return 3600      # hour(s)
                if (u ~ /^w/)              return 604800    # week(s)
                if (u ~ /^d/)              return 86400     # day(s)
                return 86400                                # 未知单位，默认按天算
            }

            # 用 date -d 把字符串时间转成 epoch 秒数
            function to_epoch(datestr,   cmd, epoch) {
                epoch = ""
                cmd = "date -d \"" datestr "\" +%s 2>/dev/null"
                cmd | getline epoch
                close(cmd)
                return epoch
            }

            {
                if (NF < 3) {
                    # 行格式不完整，原样保留，不做判断
                    print $0
                    next
                }

                ts_epoch = to_epoch($2)

                n = split($3, parts, " ")
                num = parts[1] + 0
                unit_sec = unit_to_sec(parts[2])
                ttl_sec = num * unit_sec

                if (ts_epoch != "" && ttl_sec > 0 && (now - ts_epoch) > ttl_sec) {
                    # 过期: 写入已Ebbinghaus文件, 不写回原文件
                    print $0 >> ebhs_file
                } else {
                    # 未过期或解析失败：保留在原文件
                    print $0
                }
            }
        ' "$rec_file" > "$tmp_file"

        local rc=$?
        if (( rc == 0 )); then
            # 保持原文件权限，然后原子替换
            chmod --reference="$rec_file" "$tmp_file" 2>/dev/null
            mv -f "$tmp_file" "$rec_file"
        else
            log "awk 处理失败(rc=$rc)，保留原文件不变: $rec_file"
            rm -f "$tmp_file"
            return 1
        fi

    } 9>"$LOCK_FILE"
}

# ------------------------------------------------------------------
# 单轮扫描：深度遍历目录，找出所有 correct.tsv 并逐个处理
# 每一轮都重新 find，因此运行期间新出现的文件也会被纳入
# ------------------------------------------------------------------
scan_all() {
    local f count=0

    while IFS= read -r -d '' f; do
        (( _running )) || break
        scan_file "$f"
        (( count++ ))
    done < <(find "$ROOT_DIR" -type f -name "$TARGET_NAME" -print0 2>/dev/null)

    log "本轮扫描完成，共处理 $count 个 $TARGET_NAME"
}

cleanup() {
    local l
    for l in "${!_LOCKS[@]}"; do
        echo "$l" >> debug.txt
        rm -f "$l"
    done
}

# ------------------------------------------------------------------
# 主循环
# ------------------------------------------------------------------
log "开始监控目录: $ROOT_DIR (递归查找 $TARGET_NAME)"
log "过期行写入: 各 $TARGET_NAME 同目录下的 ebhs.tsv"
log "扫描间隔: ${INTERVAL}s, 等待 tmux 关闭通知 (SIGHUP) 以退出"

while (( _running )); do

    scan_all

    # running *.sh with CWD as its file directory, args should be relative to *.sh
    ./Dedup.sh ../users/ -r --inplace || exit 1
    ./Deblank.sh ../users/ || exit 1

    # 把长 sleep 拆成多个 1 秒的短 sleep，
    # 这样收到信号后能及时响应退出，而不用死等一整个 INTERVAL
    for ((i = 0; i < INTERVAL && _running; i++)); do
        sleep 1
    done
done

log "主循环已退出，清理并结束脚本"
exit 0
