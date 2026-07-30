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

VERSION="1.2.0"
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

# ---------- systemd units ----------
# Which units to watch is set here on the machine, in /etc/moontower/config, and
# never by the hub. That is not laziness: these names become arguments to a
# command, so taking them from the hub would mean a compromise of the website
# could run whatever it liked here, which is the one thing this design refuses
# to allow. The default list is intersected with what is actually installed, so
# a box that has no mariadb simply reports no mariadb.
# A name may contain *, which systemd expands against what is installed. That
# is not a nicety: Debian calls it php8.0-fpm and Ubuntu calls it php8.3-fpm, so
# no fixed list can name the one unit a LAMP box most wants watched.
DEFAULT_UNITS="nginx apache2 caddy docker containerd mariadb mysql postgresql
redis-server valkey dovecot exim4 postfix bind9 named php*-fpm ssh sshd
fail2ban cron crond ufw firewalld vsftpd proftpd spamassassin
clamav-daemon clamav-freshclam"

read_units() {
    # Empty, not zero. A box with no systemd should leave the hub's last
    # snapshot alone rather than telling it "no units, all fine", which reads
    # identically to a healthy machine.
    units_fragment=""
    command -v systemctl >/dev/null 2>&1 || return 0

    # Validate every name before it becomes an argument. Nothing here comes
    # from the network, and checking it anyway is what keeps that true if the
    # config file is ever written by something other than the installer.
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
                # systemd does the expanding, not the shell. The pattern stays
                # quoted the whole way here, so a * can never glob against the
                # filesystem on its way to systemctl.
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

    # systemd's own count, watched or not: one number that catches everything
    # the list above does not happen to name
    failed_units=$(systemctl list-units --state=failed --no-legend --no-pager --plain 2>/dev/null |
        awk 'NF{n++}END{print n+0}')

    # One call for every unit, not one per unit. `show` prints a block per unit
    # separated by a blank line, which is exactly awk's paragraph mode, and it
    # turns 24 process spawns every 30 seconds into two.
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
            # A unit that was never installed is not the same as one that is
            # down. Reporting it as down would leave every box showing red dots
            # for software it has never had.
            if (load != "loaded") next
            # keep the JSON well formed no matter what systemd hands back
            gsub(/[^A-Za-z0-9@._-]/, "", id)
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

# Notify only. The hub can tell us a newer version exists; installing it is
# always a human re-running the installer. Nothing from the hub is executed.
latest=$(printf '%s' "$response" | sed -n 's/.*"latestVersion":"\([^"]*\)".*/\1/p')
if [ -n "$latest" ] && [ "$latest" != "$VERSION" ]; then
    echo "moontower: version $latest is available (running $VERSION); re-run the installer to upgrade"
fi

[ "${MOONTOWER_QUIET:-1}" = "1" ] || echo "moontower: cpu ${cpu_pct}% mem ${mem_pct}% disk ${disk_pct}%"
