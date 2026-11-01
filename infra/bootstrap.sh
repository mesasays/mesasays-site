#!/usr/bin/env bash
# MesaSays server setup: Ubuntu 24.04 on Hetzner (Germany). Run as root, as many times as you
# like: every step checks what is already there (idempotent).
#
# From the repo, on your Mac:
#   rsync -a -e "ssh -i ~/.ssh/mesasays_hetzner" infra/ root@SERVER_IP:/root/mesasays-infra/
#   ssh -i ~/.ssh/mesasays_hetzner root@SERVER_IP 'bash /root/mesasays-infra/bootstrap.sh'
#
# What it sets up (details in docs/INFRA_EU.md):
#   - user "deploy" (SSH key copied from root) that infra/deploy.sh logs in as
#   - user "mesasays" that runs the website, user "ipfs" that runs Kubo
#   - firewall: only 22, 80, 443 and 4001 (IPFS) open
#   - automatic security updates, SSH without passwords
#   - Caddy (HTTPS), Node 22 LTS, Postgres 16 (local only), Kubo (IPFS)
#   - /etc/mesasays/env with placeholders, the Say database and its app password
set -euo pipefail

# Versions (bump here, re-run the script). Binaries come from GitHub releases or nodejs.org and
# are checked against the published checksums before install.
CADDY_VERSION="2.11.7"
KUBO_VERSION="v0.43.1"
NODE_MAJOR="22"
DEPLOY_USER="deploy"
APP_USER="mesasays"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root"
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] || die "made for Ubuntu 24.04 (found ${PRETTY_NAME:-unknown})"

case "$(dpkg --print-architecture)" in
  amd64) ARCH=amd64; NODE_ARCH=x64 ;;
  arm64) ARCH=arm64; NODE_ARCH=arm64 ;;
  *) die "unsupported architecture $(dpkg --print-architecture)" ;;
esac

export DEBIAN_FRONTEND=noninteractive
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "Base packages"
apt-get update -q
apt-get install -y -q ca-certificates curl rsync ufw unattended-upgrades apt-listchanges \
  postgresql-16 postgresql-client-16 openssl jq xz-utils

log "Automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52mesasays-upgrades <<'EOF'
// Security updates only; reboot at 04:00 (Berlin) when a kernel update needs it.
Unattended-Upgrade::Allowed-Origins { "${distro_id}:${distro_codename}-security"; "${distro_id}ESMApps:${distro_codename}-apps-security"; "${distro_id}ESM:${distro_codename}-infra-security"; };
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF
systemctl enable --now unattended-upgrades >/dev/null
timedatectl set-timezone Europe/Berlin || true

log "Users"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "MesaSays deploy" "$DEPLOY_USER"
id -u "$APP_USER" >/dev/null 2>&1 || adduser --system --group --home /srv/mesasays --no-create-home "$APP_USER"
id -u ipfs >/dev/null 2>&1 || adduser --system --group --home /var/lib/ipfs ipfs
usermod -aG "$APP_USER" "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
if [[ -s /root/.ssh/authorized_keys && ! -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ]]; then
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
# deploy may restart the website and reload Caddy, nothing else as root.
cat > /etc/sudoers.d/mesasays-deploy <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart mesasays-web, /usr/bin/systemctl reload caddy, /usr/bin/systemctl is-active mesasays-web
EOF
chmod 440 /etc/sudoers.d/mesasays-deploy
visudo -cf /etc/sudoers.d/mesasays-deploy >/dev/null

log "SSH: keys only"
cat > /etc/ssh/sshd_config.d/50-mesasays.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t && systemctl reload ssh

log "Firewall"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null   # HTTP/3
ufw allow 4001/tcp >/dev/null  # IPFS swarm
ufw allow 4001/udp >/dev/null  # IPFS swarm (QUIC)
ufw --force enable >/dev/null
ufw status verbose | sed -n '1,20p'

log "Node.js $NODE_MAJOR LTS"
if ! command -v node >/dev/null || [[ "$(node -v)" != v"$NODE_MAJOR".* ]]; then
  base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  curl -fsSL "$base/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  file="$(grep -o "node-v${NODE_MAJOR}\.[0-9.]*-linux-${NODE_ARCH}\.tar\.xz" "$TMP/SHASUMS256.txt" | head -1)"
  [[ -n "$file" ]] || die "could not find the Node $NODE_MAJOR tarball"
  curl -fsSL "$base/$file" -o "$TMP/$file"
  (cd "$TMP" && grep " $file\$" SHASUMS256.txt | sha256sum -c -)
  rm -rf /opt/node && mkdir -p /opt/node
  tar -xJf "$TMP/$file" -C /opt/node --strip-components=1
  ln -sf /opt/node/bin/node /usr/local/bin/node
  ln -sf /opt/node/bin/npm /usr/local/bin/npm
fi
node -v

log "Caddy $CADDY_VERSION"
if ! command -v caddy >/dev/null || ! caddy version | grep -q "v$CADDY_VERSION"; then
  rel="https://github.com/caddyserver/caddy/releases/download/v$CADDY_VERSION"
  deb="caddy_${CADDY_VERSION}_linux_${ARCH}.deb"
  curl -fsSL "$rel/$deb" -o "$TMP/$deb"
  curl -fsSL "$rel/caddy_${CADDY_VERSION}_checksums.txt" -o "$TMP/caddy_checksums.txt"
  (cd "$TMP" && grep " $deb\$" caddy_checksums.txt | sha512sum -c -)
  apt-get install -y -q "$TMP/$deb"
fi
install -m 644 "$HERE/caddy/Caddyfile" /etc/caddy/Caddyfile
# The current-site CID is rewritten by every deploy; keep the deployed one if present.
if [[ ! -f /etc/caddy/mesasays-cid.caddy ]]; then
  install -m 664 -o "$DEPLOY_USER" -g caddy "$HERE/caddy/mesasays-cid.caddy" /etc/caddy/mesasays-cid.caddy
fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl enable caddy >/dev/null
systemctl reload-or-restart caddy

log "Kubo (IPFS) $KUBO_VERSION"
if ! command -v ipfs >/dev/null || [[ "$(ipfs version --number)" != "${KUBO_VERSION#v}" ]]; then
  rel="https://github.com/ipfs/kubo/releases/download/$KUBO_VERSION"
  tgz="kubo_${KUBO_VERSION}_linux-${ARCH}.tar.gz"
  curl -fsSL "$rel/$tgz" -o "$TMP/$tgz"
  curl -fsSL "$rel/$tgz.sha512" -o "$TMP/$tgz.sha512"
  (cd "$TMP" && sha512sum -c "$tgz.sha512")
  tar -xzf "$TMP/$tgz" -C "$TMP"
  install -m 755 "$TMP/kubo/ipfs" /usr/local/bin/ipfs
fi
install -d -m 750 -o ipfs -g ipfs /var/lib/ipfs
if [[ ! -f /var/lib/ipfs/config ]]; then
  sudo -u ipfs IPFS_PATH=/var/lib/ipfs ipfs init --profile=server >/dev/null
fi
kubo() { sudo -u ipfs IPFS_PATH=/var/lib/ipfs ipfs config "$@"; }
kubo Addresses.API /ip4/127.0.0.1/tcp/5001                 # RPC API: this machine only
kubo Addresses.Gateway /ip4/127.0.0.1/tcp/8080             # gateway: behind Caddy only
kubo --json Gateway.NoFetch true                           # serve only what we pin
kubo --json Gateway.PublicGateways '{"gateway.mesasays.com": {"Paths": ["/ipfs", "/ipns"], "UseSubdomains": false}}'
kubo Datastore.StorageMax 40GB
kubo Provide.Strategy pinned 2>/dev/null || kubo Reprovider.Strategy pinned  # announce only our pins
install -m 644 "$HERE/systemd/ipfs.service" /etc/systemd/system/ipfs.service

log "Postgres 16 (local only) and the Say database"
systemctl enable --now postgresql >/dev/null
# Ubuntu's default already listens on localhost only; make it explicit.
pgconf=/etc/postgresql/16/main/conf.d/50-mesasays.conf
printf "listen_addresses = 'localhost'\n" > "$pgconf"
systemctl reload postgresql
sudo -u postgres psql -tAc "select 1 from pg_database where datname = 'mesasays'" | grep -q 1 \
  || sudo -u postgres createdb mesasays
sudo -u postgres psql -d mesasays -q -v ON_ERROR_STOP=1 -f "$HERE/postgres/schema.sql"

log "Daily Say database backup (kept 14 days, /var/backups/mesasays)"
install -d -m 750 -o postgres -g postgres /var/backups/mesasays
cat > /etc/cron.daily/mesasays-db-backup <<'EOF'
#!/bin/sh
# Copy these files off the server too (docs/INFRA_EU.md, "Backups").
set -e
cd /var/backups/mesasays
sudo -u postgres pg_dump -Fc mesasays > "say-$(date +%F).dump"
find . -name 'say-*.dump' -mtime +14 -delete
EOF
chmod 755 /etc/cron.daily/mesasays-db-backup

log "Website settings: /etc/mesasays/env"
install -d -m 750 -o root -g "$APP_USER" /etc/mesasays
envfile=/etc/mesasays/env
if [[ ! -f "$envfile" ]]; then
  # The database password is generated here, on the server, and never leaves it.
  pw="$(openssl rand -hex 24)"
  sudo -u postgres psql -q -c "alter role mesasays_app password '$pw'"
  cat > "$envfile" <<EOF
# MesaSays website settings (read by systemd unit mesasays-web). Not in git.
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SITE_URL=https://mesasays.com
# Say storage: "supabase" (today) until the switch, then "postgres".
SAY_BACKEND=supabase
DATABASE_URL=postgres://mesasays_app:$pw@127.0.0.1:5432/mesasays
# Only needed while SAY_BACKEND=supabase. Paste the values from Vercel's project settings.
SAY_SUPABASE_URL=CHANGE_ME
SAY_SUPABASE_PUBLISHABLE_KEY=CHANGE_ME
EOF
  chown root:"$APP_USER" "$envfile"
  chmod 640 "$envfile"
fi

log "Website service"
install -d -m 775 -o "$DEPLOY_USER" -g "$APP_USER" /srv/mesasays /srv/mesasays/releases /srv/mesasays/ipfs
install -m 644 "$HERE/systemd/mesasays-web.service" /etc/systemd/system/mesasays-web.service
systemctl daemon-reload
systemctl enable --now ipfs >/dev/null
systemctl enable mesasays-web >/dev/null
if [[ -e /srv/mesasays/current/server.js ]]; then systemctl restart mesasays-web; fi

log "Done"
cat <<EOF
Server ready. Next steps (docs/INFRA_EU.md):
  1. Edit /etc/mesasays/env (SAY_SUPABASE_URL / SAY_SUPABASE_PUBLISHABLE_KEY).
  2. From the Mac: infra/deploy.sh $DEPLOY_USER@$(hostname -I | awk '{print $1}')
Services: caddy=$(systemctl is-active caddy) ipfs=$(systemctl is-active ipfs) postgresql=$(systemctl is-active postgresql) mesasays-web=$(systemctl is-active mesasays-web || true)
EOF
