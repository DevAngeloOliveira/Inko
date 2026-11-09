#!/usr/bin/env bash
set -euo pipefail

directory="${1:?Usage: bash scripts/ops/verify-backup.sh BACKUP_DIRECTORY}"
test -f "$directory/SHA256SUMS"
(cd "$directory" && sha256sum --check SHA256SUMS)

for database in inko_catalogo inko_usuarios inko_circulacao; do
  test -s "$directory/$database.dump"
  docker compose --env-file .env -f compose.yaml exec -T postgres \
    pg_restore --list < "$directory/$database.dump" >/dev/null
done

echo "INKO backup verified (checksum + pg_restore listing)."
