#!/bin/sh
# Moontower agent. Reads /proc, posts one reading, exits.
#
# POSIX sh, so it runs anywhere with /bin/sh and curl. It needs no privileges
# and never executes anything the hub sends back.

set -eu

VERSION="1.2.0"
CONFIG="${MOONTOWER_CONFIG:-/etc/moontower/config}"

[ -r "$CONFIG" ] || { echo "moontower: cannot read $CONFIG" >&2; exit 1; }
# shellcheck source=/dev/null
. "$CONFIG"

: "${MOONTOWER_HUB:?MOONTOWER_HUB not set in config}"
: "${MOONTOWER_KEY:?MOONTOWER_KEY not set in config}"

STATE="${MOONTOWER_STATE:-/var/lib/moontower/cpu}"

# ---------- CPU ----------
# The previous reading is kept on disk, since this exits between samples.
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
        # a counter that went backwards means a reboot; skip it
        if [ "$d_total" -gt 0 ] && [ "$d_busy" -ge 0 ]; then
            cpu_pct=$(awk -v b="$d_busy" -v t="$d_total" 'BEGIN{printf "%.1f", (b/t)*100}')
        fi
    fi

    mkdir -p "$(dirname "$STATE")"
    printf '%s %s\n' "$busy" "$total" > "$STATE"
}

# ---------- memory ----------
# MemTotal - MemAvailable, as `free` reports it
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

# ---------- systemd units ----------
# The watchlist comes from /etc/moontower/config, never from the hub, because
# these names become command arguments. The defaults are intersected with what
# is installed, and * is expanded by systemd (php*-fpm differs by distro).
DEFAULT_UNITS="nginx apache2 caddy docker containerd mariadb mysql postgresql
redis-server valkey dovecot exim4 postfix bind9 named php*-fpm ssh sshd
fail2ban cron crond ufw firewalld vsftpd proftpd spamassassin
clamav-daemon clamav-freshclam"

read_units() {
    # empty rather than zero when there is no systemd, so the hub keeps its last snapshot
    units_fragment=""
    command -v systemctl >/dev/null 2>&1 || return 0

    # validated even though nothing here comes from the network
    set --
    for unit in ${MOONTOWER_UNITS:-$DEFAULT_UNITS}; do
        case "$unit" in
            *[!A-Za-z0-9@._*-]*) continue ;;
        esac
        case "$unit" in
            *.service) name="$unit" ;;
            *)         name="$unit.service" ;;
        esac

        case "$name" in
            *"*"*)
                # the pattern stays quoted so the shell never globs it
                for found in $(systemctl list-units --all --plain --no-legend "$name" 2>/dev/null | awk '{print $1}'); do
                    case "$found" in
                        *[!A-Za-z0-9@._-]*) continue ;;
                    esac
                    set -- "$@" "$found"
                done
                ;;
            *) set -- "$@" "$name" ;;
        esac
    done
    [ $# -gt 0 ] || return 0

    # systemd's own failed count, watched or not
    failed_units=$(systemctl list-units --state=failed --no-legend --no-pager --plain 2>/dev/null |
        awk 'NF{n++}END{print n+0}')

    # one `show` call for every unit, read in awk paragraph mode
    units_json=$(systemctl show -p Id -p LoadState -p ActiveState -p SubState -p NRestarts \
        "$@" 2>/dev/null | awk '
        BEGIN { RS = ""; FS = "\n"; sep = "" }
        {
            id = ""; load = ""; active = ""; state = ""; restarts = 0
            for (i = 1; i <= NF; i++) {
                key = substr($i, 1, index($i, "=") - 1)
                val = substr($i, index($i, "=") + 1)
                if (key == "Id") id = val
                else if (key == "LoadState") load = val
                else if (key == "ActiveState") active = val
                else if (key == "SubState") state = val
                else if (key == "NRestarts") restarts = val
            }
            # not installed is not the same as down
            if (load != "loaded") next
            # keep the JSON well formed no matter what systemd hands back
            gsub(/[^A-Za-z0-9@._-]/, "", id)
            # Debian aliases (ssh/sshd, mysql/mariadb) resolve to one Id; report it once
            if (id in seen) next
            seen[id] = 1
            gsub(/[^a-z-]/, "", active)
            gsub(/[^a-z-]/, "", state)
            if (restarts !~ /^[0-9]+$/) restarts = 0
            printf "%s{\"n\":\"%s\",\"a\":\"%s\",\"s\":\"%s\",\"r\":%s}", sep, id, active, state, restarts
            sep = ","
        }')

    units_fragment=",\"failedUnits\":${failed_units:-0},\"units\":[$units_json]"
}

read_load() {
    load1=$(awk '{print $1}' /proc/loadavg)
    uptime_seconds=$(awk '{printf "%d", $1}' /proc/uptime)
    cores=$(awk '/^processor/{n++}END{print n?n:1}' /proc/cpuinfo)
    # `.` exits the shell if the file is missing, so test first and source in a subshell
    os_name=Linux
    if [ -r /etc/os-release ]; then
        os_name=$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-Linux}")
    fi
}

read_cpu
read_memory
read_disk
read_load
read_units

payload=$(cat <<EOF
{"cpuPct":$cpu_pct,"memPct":$mem_pct,"memUsedMb":$mem_used_mb,"memTotalMb":$mem_total_mb,
 "diskPct":$disk_pct,"diskUsedGb":$disk_used_gb,"diskTotalGb":$disk_total_gb,"load1":$load1,
 "uptimeSeconds":$uptime_seconds,"cores":$cores,"os":"$os_name","agentVersion":"$VERSION"$units_fragment}
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

# notify only; upgrading is always a manual reinstall
latest=$(printf '%s' "$response" | sed -n 's/.*"latestVersion":"\([^"]*\)".*/\1/p')
if [ -n "$latest" ] && [ "$latest" != "$VERSION" ]; then
    echo "moontower: version $latest is available (running $VERSION). upgrade with:"
    echo "  curl -fsSL $MOONTOWER_HUB/moontower/install.sh | sh -s -- --upgrade"
fi

[ "${MOONTOWER_QUIET:-1}" = "1" ] || echo "moontower: cpu ${cpu_pct}% mem ${mem_pct}% disk ${disk_pct}%"
