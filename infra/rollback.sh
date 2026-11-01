#!/usr/bin/env bash
# Put the previous website release back (or a given one), in a few seconds.
#   infra/rollback.sh deploy@SERVER_IP              -> the release before the current one
#   infra/rollback.sh deploy@SERVER_IP 20261101-1530 -> that release
# The IPFS copy has no rollback to do: older CIDs stay pinned (see /srv/mesasays/cids.log);
# point mesasays.eth back to an older CID in the ENS app if needed.
set -euo pipefail
TARGET="${1:-}"
[[ "$TARGET" == *@* ]] || { echo "usage: $0 user@host [release]" >&2; exit 2; }
KEY="${MESASAYS_SSH_KEY:-$HOME/.ssh/mesasays_hetzner}"
ssh -i "$KEY" -o IdentitiesOnly=yes "$TARGET" bash -s -- "${2:-}" <<'EOS'
set -euo pipefail
cd /srv/mesasays
current="$(basename "$(readlink current)")"
wanted="${1:-}"
if [[ -z "$wanted" ]]; then
  wanted="$(ls -1 releases | sort -r | grep -v -x "$current" | head -1)"
fi
[[ -n "$wanted" && -d "releases/$wanted" ]] || { echo "no such release: ${wanted:-none}. Available:"; ls -1 releases; exit 1; }
ln -sfn "releases/$wanted" current.new && mv -Tf current.new current
sudo systemctl restart mesasays-web
echo "website now on release $wanted (was $current)"
EOS
