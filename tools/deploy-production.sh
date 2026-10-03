#!/usr/bin/env bash
# Deterministic production deploy: ships exactly one commit (never the working tree) to the server as
# an immutable release, builds and starts it, smoke-tests it through Traefik and rolls back to the
# previous release when anything fails.
#
#   tools/deploy-production.sh [git-ref]      (default HEAD; uncommitted changes are never shipped)
#
#   MOOI_DEPLOY_HOST      ssh destination           (default mydherin@10.10.22.21)
#   MOOI_DEPLOY_DIR       server directory          (default /root/mooi; holds .env and releases/)
#   MOOI_KEEP_RELEASES    releases kept on server   (default 3)
set -euo pipefail

host="${MOOI_DEPLOY_HOST:-mydherin@10.10.22.21}"
dir="${MOOI_DEPLOY_DIR:-/root/mooi}"
keep="${MOOI_KEEP_RELEASES:-3}"
ref="${1:-HEAD}"

cd "$(git rev-parse --show-toplevel)"

commit="$(git rev-parse --verify --quiet "$ref^{commit}")" || { printf 'unknown git ref: %s\n' "$ref" >&2; exit 1; }
release="$(git rev-parse --short=12 "$commit")"
if [ "$ref" = HEAD ] && [ -n "$(git status --porcelain)" ]; then
  printf 'warning: uncommitted changes are not deployed; shipping %s as committed\n' "$release" >&2
fi

printf '==> release %s (%s)\n' "$release" "$(git log -1 --format=%s "$commit")"
# A release directory is complete only once its marker exists: reruns skip the upload.
if ssh "$host" "test -f '$dir/releases/$release/.release'"; then
  printf '==> already on %s, skipping upload\n' "$host"
else
  printf '==> shipping to %s:%s\n' "$host" "$dir"
  git archive --format=tar.gz "$commit" \
    | ssh "$host" "set -e; d='$dir/releases/$release'; rm -rf \"\$d\"; mkdir -p \"\$d\"; tar -xzf - -C \"\$d\"; echo '$commit' > \"\$d/.release\""
fi

printf '==> building and starting\n'
ssh "$host" bash -s -- "$dir" "$release" "$keep" <<'REMOTE'
set -euo pipefail
dir="$1"; release="$2"; keep="$3"
cd "$dir"
exec 9>.deploy.lock
flock -n 9 || { echo 'another deploy is running' >&2; exit 1; }
[ -f .env ] || { printf 'missing %s/.env (see deploy/production/.env.example)\n' "$dir" >&2; exit 1; }
chmod 600 .env
domain="$(sed -n 's/^DOMAIN=//p' .env | tail -n 1)"
previous="$(readlink current 2>/dev/null | sed 's:^releases/::' || true)"
docker network inspect mooi-previews >/dev/null 2>&1 || docker network create mooi-previews >/dev/null

up() {
  MOOI_RELEASE="$1" docker compose --env-file .env -f "releases/$1/deploy/production/compose.yml" \
    up -d --build --remove-orphans --wait --wait-timeout 1200
}

smoke() {
  local path status
  for path in / /api/mooi/actuator/health /api/sessions/health; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
      --resolve "$domain:443:127.0.0.1" "https://$domain$path" || true)"
    printf '    %-28s %s\n' "$path" "$status"
    [ "$status" = 200 ] || return 1
  done
}

if up "$release" && smoke; then
  ln -sfn "releases/$release" current
else
  echo "release $release failed" >&2
  if [ -n "$previous" ] && [ "$previous" != "$release" ] && [ -d "releases/$previous" ]; then
    echo "rolling back to $previous" >&2
    up "$previous" && smoke || echo "rollback to $previous is unhealthy too" >&2
  fi
  exit 1
fi

# Keep the newest releases (never the current one) and their images, ready for a rollback.
ls -1dt releases/*/ | sed 's:/$::' | grep -vx "releases/$release" | tail -n +"$keep" | xargs -r rm -rf
kept="$(ls -1 releases | sed 's/.*/:&$/')"
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^mooi/' | grep -v -f <(printf '%s\n' "$kept") \
  | xargs -r docker rmi >/dev/null 2>&1 || true
docker compose --env-file .env -f current/deploy/production/compose.yml ps --format 'table {{.Name}}\t{{.Status}}'
REMOTE
printf '==> release %s is live\n' "$release"
