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

# Releases before the `mooi-prod` project ship deploy/production/compose.yml; later ones compose.prod.yml.
stack() {
  local release="$1" file
  shift
  for file in compose.prod.yml compose.yml; do
    if [ -f "releases/$release/deploy/production/$file" ]; then
      MOOI_RELEASE="$release" docker compose --env-file .env -f "releases/$release/deploy/production/$file" "$@"
      return
    fi
  done
  printf 'release %s has no production compose file\n' "$release" >&2
  return 1
}

# Another production project (a renamed one, or the other side of a rollback across the rename) holds
# the same routes and data: stop it, keeping its data, right before this one starts.
retire_others() {
  local keep="$1" other
  for other in $(docker ps -a --format '{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.project.config_files"}}' \
      | awk -F'|' -v root="$PWD/releases/" -v keep="$keep" 'index($2, root) == 1 && $1 != keep { print $1 }' | sort -u); do
    printf '==> retiring production project %s\n' "$other"
    docker compose -p "$other" down --remove-orphans
  done
}

up() {
  local project
  project="$(stack "$1" config | sed -n 's/^name: //p' | head -n 1)"
  [ -n "$project" ] || return 1
  # Images build while the running release keeps serving; only then is anything replaced.
  stack "$1" build && retire_others "$project" && stack "$1" up -d --remove-orphans --wait --wait-timeout 1200
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
stack "$release" ps --format 'table {{.Name}}\t{{.Status}}'
REMOTE
printf '==> release %s is live\n' "$release"
