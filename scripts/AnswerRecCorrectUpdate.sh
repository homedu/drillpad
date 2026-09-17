#!/usr/bin/env bash

# 开启严格模式：任何命令出错立即退出、未定义变量报错、管道中任意环节出错都算失败。
# 原脚本没有这个，如果某一步 awk 出错，后面的 mv 依然会执行，可能用一个空/半截文件覆盖掉原始数据。
set -euo pipefail

#
# 用途：
#   在一个 tmux 窗口/pane 中长期驻留运行，每隔一段时间用 awk 遍历一个 TSV 文件，
#   TSV 每行格式为：
#       <id>\t<记录时间, 如 "2026-09-17 23:03:32">\t<有效期, 如 "2 day" / "1 day" / "3 hour">
#   若 (当前系统时间 - 记录时间) > 有效期，则认为该行"过期"：
#       - 从原文件中删除该行
#       - 把该行追加写入另一个"已删除"文件
#
#   该脚本只在收到 tmux 关闭窗口/pane 时发出的 SIGHUP 信号时才退出主循环，
#   其余信号（Ctrl+C 等）不算作"关闭通知"，只是常规兜底处理。
#
# 用法：
#   ./tmux_ttl_watcher.sh <TSV文件路径> <已删除行存放文件路径> [扫描间隔秒数，默认60]
#
# 建议运行方式（在 tmux 里）：
#   tmux new-window -n ttl-watcher './tmux_ttl_watcher.sh data.tsv deleted.tsv 60'
#   或者直接在某个 tmux pane 里前台运行：
#   ./tmux_ttl_watcher.sh data.tsv deleted.tsv 60
#

# ------------------------------------------------------------------
# 参数解析
# ------------------------------------------------------------------
TSV_FILE="${1:?用法: $0 <TSV文件> <已删除行文件> [间隔秒数]}"
DELETED_FILE="${2:?用法: $0 <TSV文件> <已删除行文件> [间隔秒数]}"
INTERVAL="${3:-60}"          # 默认每 60 秒扫描一次

LOCK_FILE="${TSV_FILE}.lock"
TMP_FILE="${TSV_FILE}.tmp.$$"

# 主循环控制标志，收到 SIGHUP 后置 0 退出
_running=1

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
# 单次扫描：用 awk 遍历每一行，判断是否过期
# ------------------------------------------------------------------
scan_once() {
    [[ -f "$TSV_FILE" ]] || { log "文件不存在，跳过本次扫描: $TSV_FILE"; return 0; }

    # 用 flock 加锁，避免和其它写入该文件的进程冲突（若系统无 flock 命令则跳过锁）
    if command -v flock >/dev/null 2>&1; then
        exec 9>"$LOCK_FILE"
        if ! flock -w 5 9; then
            log "获取文件锁超时，跳过本次扫描"
            exec 9>&-
            return 1
        fi
    fi

    local now_epoch
    now_epoch=$(date +%s)

    awk -F'\t' -v now="$now_epoch" -v deleted_file="$DELETED_FILE" '
        # 把 "day/hour/min/sec/week" 这类单位换算成秒
        function unit_to_sec(u) {
            u = tolower(u)
            if (u ~ /^s/)              return 1        # sec / second(s)
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
                # 过期：写入已删除文件，不写回原文件
                print $0 >> deleted_file
            } else {
                # 未过期或解析失败：保留在原文件
                print $0
            }
        }
    ' "$TSV_FILE" > "$TMP_FILE"

    # 原子替换原文件
    mv -f "$TMP_FILE" "$TSV_FILE"

    if command -v flock >/dev/null 2>&1; then
        flock -u 9
        exec 9>&-
    fi
}

# ------------------------------------------------------------------
# 主循环
# ------------------------------------------------------------------
log "开始监控: $TSV_FILE"
log "过期行写入: $DELETED_FILE"
log "扫描间隔: ${INTERVAL}s, 等待 tmux 关闭通知 (SIGHUP) 以退出"

while (( _running )); do
    scan_once

    # 把长 sleep 拆成多个 1 秒的短 sleep，
    # 这样收到信号后能及时响应退出，而不用死等一整个 INTERVAL
    for ((i = 0; i < INTERVAL && _running; i++)); do
        sleep 1
    done
done

log "主循环已退出，清理并结束脚本"
rm -f "$LOCK_FILE"
exit 0
