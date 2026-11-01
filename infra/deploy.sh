#!/usr/bin/env bash
# Build MesaSays on this Mac and put it live on our server.
#
#   infra/deploy.sh deploy@SERVER_IP            build + deploy website + publish IPFS copy
#   infra/deploy.sh deploy@SERVER_IP --no-build deploy what was built last time
#
# Steps: build the Node server (standalone) and the static IPFS copy, send both with rsync over
# SSH (key ~/.ssh/mesasays_hetzner), switch the website to the new release (the previous ones
# stay on the server for rollback: infra/rollback.sh), add + pin the static copy on the server's
# IPFS node, point gateway.mesasays.com at it, and print the new CID for mesasays.eth.
set -euo pipefail

TARGET="${1:-}"
[[ "$TARGET" == *@* ]] || { echo "usage: $0 user@host [--no-build]" >&2; exit 2; }
BUILD=1
[[ "${2:-}" == "--no-build" ]] && BUILD=0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY="${MESASAYS_SSH_KEY:-$HOME/.ssh/mesasays_hetzner}"
SSH_OPTS=(-i "$KEY" -o IdentitiesOnly=yes -o ServerAliveInterval=30)
STAGE="$ROOT/.ipfs-build/release"
RELEASE="$(date -u +%Y%m%d-%H%M%S)"
REMOTE=/srv/mesasays
export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://mesasays.com}"

# shellcheck disable=SC2029  # arguments are meant to expand here, on the Mac
remote() { ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }
[[ -f "$KEY" ]] || { echo "SSH key not found: $KEY" >&2; exit 1; }
remote true || { echo "cannot reach $TARGET over SSH" >&2; exit 1; }

cd "$ROOT"
if [[ $BUILD -eq 1 ]]; then
  echo "==> Building the website (standalone Node server)"
  npm run build:server
  # The standalone folder needs the static assets and public/ next to it.
  rm -rf "$STAGE" && mkdir -p "$STAGE"
  cp -R .next/standalone/. "$STAGE/web"
  cp -R .next/static "$STAGE/web/.next/static"
  cp -R public "$STAGE/web/public"
  rm -rf "$STAGE/web/out"
  # The Say migration script runs on the server with the release's own node_modules (pg).
  mkdir -p "$STAGE/web/infra/postgres"
  cp infra/postgres/migrate-from-supabase.mjs infra/postgres/schema.sql "$STAGE/web/infra/postgres/"
  # Settings come from /etc/mesasays/env on the server: never ship local .env files.
  find "$STAGE/web" -maxdepth 1 -name '.env*' -exec rm -f {} +
  echo "==> Building the static IPFS copy"
  npm run build:ipfs
fi
[[ -f "$STAGE/web/server.js" && -f out/index.html ]] || { echo "nothing built: run without --no-build" >&2; exit 1; }

LOCAL_CID=""
if command -v ipfs >/dev/null; then
  LOCAL_CID="$(ipfs add -r --cid-version=1 --only-hash --quieter out)"
fi

echo "==> Sending release $RELEASE"
PREV="$(remote "readlink $REMOTE/current || true")"
LINK_DEST=()
[[ -n "$PREV" ]] && LINK_DEST=(--link-dest="$REMOTE/$PREV")
rsync -az --delete "${LINK_DEST[@]}" -e "ssh ${SSH_OPTS[*]}" "$STAGE/web/" "$TARGET:$REMOTE/releases/$RELEASE/"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" out/ "$TARGET:$REMOTE/ipfs/current/"

echo "==> Switching the website to $RELEASE"
remote bash -s -- "$REMOTE" "$RELEASE" "$PREV" <<'EOS'
set -euo pipefail
REMOTE="$1"; RELEASE="$2"; PREV="$3"
cd "$REMOTE"
# The server writes its page cache inside .next: the mesasays group may write there.
chgrp -R mesasays "releases/$RELEASE/.next" && chmod -R g+rwX "releases/$RELEASE/.next"
ln -sfn "releases/$RELEASE" current.new && mv -Tf current.new current
sudo systemctl restart mesasays-web
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then ok=1; break; fi
  sleep 1
done
if [[ -z "${ok:-}" ]]; then
  echo "new release does not answer: rolling back to $PREV" >&2
  if [[ -n "$PREV" ]]; then ln -sfn "$PREV" current.new && mv -Tf current.new current; sudo systemctl restart mesasays-web; fi
  exit 1
fi
# Keep the 5 most recent releases.
ls -1dt releases/*/ | tail -n +6 | xargs -r rm -rf
EOS

echo "==> Adding and pinning the static copy on the server's IPFS node"
CID="$(remote bash -s -- "$REMOTE" <<'EOS'
set -euo pipefail
REMOTE="$1"
CID="$(ipfs --api=/ip4/127.0.0.1/tcp/5001 add -r --cid-version=1 --pin=true --quieter "$REMOTE/ipfs/current")"
printf '# Written by infra/deploy.sh: the CID of the current static site.\nvars cid %s\n' "$CID" > /etc/caddy/mesasays-cid.caddy
sudo systemctl reload caddy
printf '%s %s\n' "$(date -u +%FT%TZ)" "$CID" >> "$REMOTE/cids.log"
echo "$CID"
EOS
)"

if [[ -n "$LOCAL_CID" && "$LOCAL_CID" != "$CID" ]]; then
  echo "WARNING: local CID $LOCAL_CID differs from server CID $CID" >&2
fi

cat <<EOF

Deployed release $RELEASE.
  Website:       https://mesasays.com (once DNS points here)
  IPFS copy:     $CID
  Our gateway:   https://gateway.mesasays.com/  (and /ipfs/$CID/)
  mesasays.eth:  set the content hash to ipfs://$CID
                 node infra/ens-contenthash.mjs $CID   (prints the exact value and calldata)
EOF
