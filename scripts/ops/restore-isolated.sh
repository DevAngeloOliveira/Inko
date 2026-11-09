#!/usr/bin/env bash
set -euo pipefail

directory="${1:?Usage: bash scripts/ops/restore-isolated.sh BACKUP_DIRECTORY DATABASE TARGET_NAME --confirm-isolated}"
database="${2:-}"
target="${3:-}"
confirmation="${4:-}"

case "$database" in
  inko_catalogo|inko_usuarios|inko_circulacao) ;;
  *) echo "Unsupported source database" >&2; exit 2 ;;
esac

if [[ ! "$target" =~ ^inko_restore_[a-z0-9_]{1,40}$ ]] || [[ "$confirmation" != "--confirm-isolated" ]]; then
  echo "Target must start with inko_restore_ and require --confirm-isolated" >&2
  exit 2
fi

bash scripts/ops/verify-backup.sh "$directory"
docker compose --env-file .env -f compose.yaml exec -T postgres \
  createdb --username inko_admin --encoding UTF8 "$target"
docker compose --env-file .env -f compose.yaml exec -T postgres \
  pg_restore --no-owner --no-privileges --username inko_admin --dbname "$target" \
  < "$directory/$database.dump"

echo "Restored $database into isolated database $target."
