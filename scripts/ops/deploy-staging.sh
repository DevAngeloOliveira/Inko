#!/usr/bin/env bash
set -euo pipefail

: "${INKO_RELEASE_TAG:?Set INKO_RELEASE_TAG to an already-published version}"
[[ -f .env ]] || { echo "Staging .env file is required and must be managed on the host" >&2; exit 1; }

args=(docker compose --env-file .env -f compose.yaml -f compose.release.yaml)

"${args[@]}" config --quiet

if docker compose --env-file .env -f compose.yaml ps --services --status running | grep -qx postgres; then
  bash scripts/ops/backup-postgres.sh backups
fi

"${args[@]}" pull postgres catalogo usuarios circulacao relatorios gateway web
"${args[@]}" up --detach --no-build --wait --wait-timeout 600

curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 3 \
  http://127.0.0.1:8000/health >/dev/null
curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 3 \
  http://127.0.0.1:3000/ >/dev/null

echo "INKO staging updated to ${INKO_RELEASE_TAG}."
