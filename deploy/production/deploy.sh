#!/usr/bin/env bash
# Ships the current working tree (tracked + untracked, minus ignored files) to the server as an
# immutable release, then builds and (re)starts the production stack from it.
#
#   MOOI_DEPLOY_HOST      ssh destination           (default mydherin@10.10.22.21)
#   MOOI_DEPLOY_DIR       server directory          (default /root/mooi; holds .env and releases/)
#   MOOI_KEEP_RELEASES    releases kept on server   (default 3)
set -euo pipefail

host="${MOOI_DEPLOY_HOST:-mydherin@10.10.22.21}"
dir="${MOOI_DEPLOY_DIR:-/root/mooi}"
keep="${MOOI_KEEP_RELEASES:-3}"

cd "$(git rev-parse --show-toplevel)"

release="$(git rev-parse --short=12 HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  release="${release}-dirty-$(date -u +%Y%m%d%H%M%S)"
fi

printf '==> shipping release %s to %s:%s\n' "$release" "$host" "$dir"
git ls-files -z --cached --others --exclude-standard \
  | while IFS= read -r -d '' file; do [ -e "$file" ] && printf '%s\0' "$file"; done \
  | COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata --null -T - -czf - \
  | ssh "$host" "set -e; mkdir -p '$dir/releases/$release'; tar -xzf - -C '$dir/releases/$release'"

printf '==> building and starting\n'
ssh "$host" bash -s -- "$dir" "$release" "$keep" <<'REMOTE'
set -euo pipefail
dir="$1"; release="$2"; keep="$3"
cd "$dir"
[ -f .env ] || { printf 'missing %s/.env (see deploy/production/.env.example)\n' "$dir" >&2; exit 1; }
chmod 600 .env
docker network inspect mooi-previews >/dev/null 2>&1 || docker network create mooi-previews >/dev/null
export MOOI_RELEASE="$release"
docker compose --env-file .env -f "releases/$release/deploy/production/compose.yml" \
  up -d --build --remove-orphans --wait --wait-timeout 1200
ln -sfn "releases/$release" current

# Keep the newest releases (never the current one) and drop images of older ones.
ls -1dt releases/*/ | sed 's:/$::' | grep -vx "releases/$release" | tail -n +"$keep" | xargs -r rm -rf
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^mooi/' | grep -v ":$release\$" \
  | xargs -r docker rmi >/dev/null 2>&1 || true
docker compose --env-file .env -f "current/deploy/production/compose.yml" ps
REMOTE
printf '==> release %s is live\n' "$release"
