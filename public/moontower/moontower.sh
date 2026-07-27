#!/bin/sh
# Moontower agent. Reads /proc, posts a reading, exits.
#
# POSIX sh on purpose: this has to run on whatever a given box happens to be,
# and every Linux has /bin/sh and curl. There is no runtime to install and
# nothing to keep up to date.
#
# It needs no privileges. /proc/stat, /proc/meminfo and /proc/loadavg are world
# readable, and `df` needs nothing special, so this runs as its own unprivileged
# user with no capabilities and no sudo.
#
# The hub's reply is configuration only. This script never evaluates anything it
# receives: a compromised hub can change which numbers are collected and can lie
# about the latest version, but it cannot run code here.

set -eu

VERSION="1.0.0"
CONFIG="${MOONTOWER_CONFIG:-/etc/moontower/config}"

[ -r "$CONFIG" ] || { echo "moontower: cannot read $CONFIG" >&2; exit 1; }
# shellcheck source=/dev/null
. "$CONFIG"

: "${MOONTOWER_HUB:?MOONTOWER_HUB not set in config}"
: "${MOONTOWER_KEY:?MOONTOWER_KEY not set in config}"

STATE="${MOONTOWER_STATE:-/var/lib/moontower/cpu}"

# ---------- CPU ----------
# A percentage is a rate, so it needs two readings. The previous one is kept on
# disk because this process exits between samples; the first run after a boot
# has nothing to compare against and reports 0 rather than inventing a spike.
read_cpu() {
    # cpu user nice system idle iowait irq softirq steal ...
    set -- $(awk '/^cpu /{print $2,$3,$4,$5,$6,$7,$8,$9}' /proc/stat)
    idle=$(( $4 + $5 ))                                    # idle + iowait
    total=$(( $1 + $2 + $3 + $4 + $5 + $6 + $7 + $8 ))
    busy=$(( total - idle ))

    cpu_pct=0
    if [ -r "$STATE" ]; then
        read -r prev_busy prev_total < "$STATE" || true
        d_total=$(( total - prev_total ))
        d_busy=$(( busy - prev_busy ))
        # a counter that went backwards means the machine rebooted; skip it
        if [ "$d_total" -gt 0 ] && [ "$d_busy" -ge 0 ]; then
            cpu_pct=$(awk -v b="$d_busy" -v t="$d_total" 'BEGIN{printf "%.1f", (b/t)*100}')
        fi
    fi

    mkdir -p "$(dirname "$STATE")"
    printf '%s %s\n' "$busy" "$total" > "$STATE"
}

# ---------- memory ----------
# MemTotal - MemAvailable, which is what `free` calls used. MemFree excludes
# reclaimable page cache and makes every healthy Linux box look nearly full.
read_memory() {
    mem_total_kb=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
    mem_avail_kb=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)
    # MemAvailable arrived in kernel 3.14; fall back for anything older
    [ -n "${mem_avail_kb:-}" ] || mem_avail_kb=$(awk '/^MemFree:/{print $2}' /proc/meminfo)

    mem_used_mb=$(( (mem_total_kb - mem_avail_kb) / 1024 ))
    mem_total_mb=$(( mem_total_kb / 1024 ))
    mem_pct=$(awk -v u="$mem_used_mb" -v t="$mem_total_mb" 'BEGIN{printf "%.1f", t?(u/t)*100:0}')
}

# ---------- disk and load ----------
read_disk() {
    set -- $(df -Pk / | awk 'NR==2{print $2,$3}')
    disk_total_gb=$(awk -v k="$1" 'BEGIN{printf "%.1f", k/1048576}')
    disk_used_gb=$(awk -v k="$2" 'BEGIN{printf "%.1f", k/1048576}')
    disk_pct=$(awk -v u="$2" -v t="$1" 'BEGIN{printf "%.1f", t?(u/t)*100:0}')
}

read_load() {
    load1=$(awk '{print $1}' /proc/loadavg)
    uptime_seconds=$(awk '{printf "%d", $1}' /proc/uptime)
    cores=$(awk '/^processor/{n++}END{print n?n:1}' /proc/cpuinfo)
    # `.` is a POSIX special builtin: if the file is missing, the shell exits
    # outright and a `|| fallback` never runs. Guard with a file test, and read
    # it inside the subshell so a failure cannot take the agent down.
    os_name=Linux
    if [ -r /etc/os-release ]; then
        os_name=$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-Linux}")
    fi
}

read_cpu
read_memory
read_disk
read_load

payload=$(cat <<EOF
{"cpuPct":$cpu_pct,"memPct":$mem_pct,"memUsedMb":$mem_used_mb,"memTotalMb":$mem_total_mb,
 "diskPct":$disk_pct,"diskUsedGb":$disk_used_gb,"diskTotalGb":$disk_total_gb,"load1":$load1,
 "uptimeSeconds":$uptime_seconds,"cores":$cores,"os":"$os_name","agentVersion":"$VERSION"}
EOF
)

response=$(curl -fsS --max-time 15 \
    -H "authorization: Bearer $MOONTOWER_KEY" \
    -H "content-type: application/json" \
    -d "$payload" \
    "$MOONTOWER_HUB/api/moontower/ingest" 2>&1) || {
        echo "moontower: report failed: $response" >&2
        exit 1
    }

# Notify only. The hub can tell us a newer version exists; installing it is
# always a human re-running the installer. Nothing from the hub is executed.
latest=$(printf '%s' "$response" | sed -n 's/.*"latestVersion":"\([^"]*\)".*/\1/p')
if [ -n "$latest" ] && [ "$latest" != "$VERSION" ]; then
    echo "moontower: version $latest is available (running $VERSION); re-run the installer to upgrade"
fi

[ "${MOONTOWER_QUIET:-1}" = "1" ] || echo "moontower: cpu ${cpu_pct}% mem ${mem_pct}% disk ${disk_pct}%"
