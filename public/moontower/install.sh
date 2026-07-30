#!/bin/sh
# Moontower installer.
#
#   curl -fsSL https://tanushchauhan.com/moontower/install.sh | sh -s -- \
#       --token mt_enroll_… --name "vps"
#
# To upgrade a machine that is already enrolled, with no token and no downtime:
#
#   curl -fsSL https://tanushchauhan.com/moontower/install.sh | sh -s -- --upgrade
#
# That replaces the agent and its unit files and leaves the key, the schedule
# and the server's history alone. Enrolling is a one-time thing; a server never
# has to be removed and re-added to pick up a new version.
#
# What it does, so you can check before running it as root:
#   1. creates a system user `moontower` with no login shell and no home
#   2. installs one shell script to /usr/local/lib/moontower/moontower.sh
#   3. enrolls with the hub, receiving a key for this server alone
#   4. writes that key to /etc/moontower/config, mode 0600, owned by moontower
#   5. installs a systemd timer (or a cron entry) to run it every 30 seconds
#
# It does not install a package manager repo, a daemon, Docker, or anything
# that stays resident. The agent runs for a few milliseconds and exits.
#
# Uninstall: /usr/local/lib/moontower/uninstall.sh

set -eu

HUB="https://tanushchauhan.com"
NAME=""
TOKEN=""
UPGRADE=0
LIB="/usr/local/lib/moontower"
CONF_DIR="/etc/moontower"
STATE_DIR="/var/lib/moontower"
USER_NAME="moontower"

while [ $# -gt 0 ]; do
    case "$1" in
        --token) TOKEN="${2:-}"; shift 2 ;;
        --name)  NAME="${2:-}";  shift 2 ;;
        --hub)   HUB="${2:-}";   shift 2 ;;
        --upgrade) UPGRADE=1; shift ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done

# An install with no token on a machine that already holds a key is an upgrade,
# not a mistake. Treating it as one is what makes "re-run the installer" true.
if [ "$UPGRADE" -eq 0 ] && [ -z "$TOKEN" ] && [ -r "$CONF_DIR/config" ]; then
    UPGRADE=1
fi

if [ "$UPGRADE" -eq 1 ]; then
    [ -r "$CONF_DIR/config" ] || { echo "moontower: nothing to upgrade, $CONF_DIR/config does not exist" >&2; exit 1; }
else
    [ -n "$TOKEN" ] || { echo "moontower: --token is required, or --upgrade to update an enrolled machine" >&2; exit 2; }
    [ -n "$NAME" ]  || { echo "moontower: --name is required, for example --name vps" >&2; exit 2; }
fi
[ "$(id -u)" -eq 0 ] || { echo "moontower: install needs root (the agent itself does not)" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || { echo "moontower: curl is required" >&2; exit 1; }
[ -r /proc/stat ] || { echo "moontower: /proc/stat is unreadable, is this Linux?" >&2; exit 1; }

if [ "$UPGRADE" -eq 1 ]; then
    echo "moontower: upgrading the agent in place, keeping the existing key"
else
    echo "moontower: installing agent for \"$NAME\""
fi

# ---------- 1. unprivileged user ----------
if ! id "$USER_NAME" >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$USER_NAME" 2>/dev/null \
        || adduser --system --no-create-home --shell /usr/sbin/nologin "$USER_NAME" 2>/dev/null \
        || { echo "moontower: could not create user $USER_NAME" >&2; exit 1; }
fi

# ---------- 2. agent ----------
mkdir -p "$LIB" "$CONF_DIR" "$STATE_DIR"
curl -fsSL "$HUB/moontower/moontower.sh" -o "$LIB/moontower.sh"
chmod 0755 "$LIB/moontower.sh"
chown -R "$USER_NAME" "$STATE_DIR"

# ---------- 3. enrol (new installs only) ----------
# An upgrade must never touch the config: the key in it is the machine's
# identity, and rewriting it is how you would lose a server's history.
if [ "$UPGRADE" -eq 0 ]; then
# Sent as a body field rather than a query string so the single-use token does
# not end up in any proxy or access log along the way.
# `.` is a special builtin, so a missing file exits the shell before any
# `|| fallback` can run. Test for it first.
os_name=Linux
if [ -r /etc/os-release ]; then
    os_name=$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-Linux}")
fi
cores=$(awk '/^processor/{n++}END{print n?n:1}' /proc/cpuinfo)

response=$(curl -fsS --max-time 20 \
    -H "content-type: application/json" \
    -d "{\"token\":\"$TOKEN\",\"name\":\"$NAME\",\"os\":\"$os_name\",\"cores\":$cores,\"agentVersion\":\"1.2.0\"}" \
    "$HUB/api/moontower/enroll") || { echo "moontower: enrollment failed" >&2; exit 1; }

KEY=$(printf '%s' "$response" | sed -n 's/.*"key":"\([^"]*\)".*/\1/p')
SLUG=$(printf '%s' "$response" | sed -n 's/.*"slug":"\([^"]*\)".*/\1/p')
[ -n "$KEY" ] || { echo "moontower: hub did not return a key: $response" >&2; exit 1; }

# ---------- 4. config ----------
# Written 0600 before the key goes in, so it is never briefly world readable.
umask 077
: > "$CONF_DIR/config"
chmod 0600 "$CONF_DIR/config"
chown "$USER_NAME" "$CONF_DIR/config"
cat > "$CONF_DIR/config" <<EOF
# Moontower agent config. The key below reports for "$SLUG" and can do nothing
# else: it cannot read this server, deploy anything, or touch another machine.
# Revoke it by deleting the server in the hub.
MOONTOWER_HUB="$HUB"
MOONTOWER_KEY="$KEY"
MOONTOWER_STATE="$STATE_DIR/cpu"

# Which systemd units to report, space separated, ".service" optional. Left
# unset the agent uses its built-in list of the usual suspects and skips
# anything this machine does not have installed.
#
# It lives here rather than in the hub on purpose. These names become arguments
# to a command, so accepting them over the network would mean a compromise of
# the website could run whatever it liked on this machine.
#MOONTOWER_UNITS="nginx mariadb dovecot"
EOF
fi

# ---------- 5. schedule ----------
# rewritten on upgrade too, so a change to the sandbox or the interval lands
# without anyone having to know the unit files moved
if command -v systemctl >/dev/null 2>&1 && [ -d /etc/systemd/system ]; then
    cat > /etc/systemd/system/moontower.service <<EOF
[Unit]
Description=Moontower agent
After=network-online.target

[Service]
Type=oneshot
User=$USER_NAME
ExecStart=$LIB/moontower.sh
# it reads /proc and posts one request, so it needs nothing else
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$STATE_DIR
EOF

    cat > /etc/systemd/system/moontower.timer <<EOF
[Unit]
Description=Moontower agent every 30 seconds

[Timer]
OnBootSec=30
OnUnitActiveSec=30
AccuracySec=5

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl enable --now moontower.timer >/dev/null 2>&1
    SCHEDULER="systemd timer (systemctl status moontower.timer)"
else
    # cron cannot do sub-minute, so run it twice a minute with an offset sleep
    cron_line="* * * * * $USER_NAME $LIB/moontower.sh >/dev/null 2>&1; sleep 30; $LIB/moontower.sh >/dev/null 2>&1"
    echo "$cron_line" > /etc/cron.d/moontower
    chmod 0644 /etc/cron.d/moontower
    SCHEDULER="cron (/etc/cron.d/moontower)"
fi

# ---------- uninstall ----------
cat > "$LIB/uninstall.sh" <<EOF
#!/bin/sh
set -eu
systemctl disable --now moontower.timer 2>/dev/null || true
rm -f /etc/systemd/system/moontower.timer /etc/systemd/system/moontower.service /etc/cron.d/moontower
systemctl daemon-reload 2>/dev/null || true
rm -rf "$LIB" "$CONF_DIR" "$STATE_DIR"
userdel $USER_NAME 2>/dev/null || true
echo "moontower: removed. Delete the server in the hub to revoke its key."
EOF
chmod 0755 "$LIB/uninstall.sh"

# first reading now, so the hub shows the server immediately rather than in 30s
su -s /bin/sh "$USER_NAME" -c "$LIB/moontower.sh" || true

if [ "$UPGRADE" -eq 1 ]; then
    cat <<EOF

moontower: upgraded to $(grep -m1 '^VERSION=' "$LIB/moontower.sh" | cut -d'"' -f2).
The key, the schedule and this server's history are unchanged.
EOF
    exit 0
fi

cat <<EOF

moontower: "$NAME" is enrolled and reporting as "$SLUG".

  scheduled by : $SCHEDULER
  agent        : $LIB/moontower.sh
  config       : $CONF_DIR/config (0600, owned by $USER_NAME)
  uninstall    : $LIB/uninstall.sh

The agent runs as $USER_NAME, not root, and only reads /proc and df.
EOF
