#!/usr/bin/env bash
set -euo pipefail
umask 077

backup_root="${1:-backups}"
mkdir -p "$backup_root"
destination="$(mktemp -d "$backup_root/inko-$(date -u +%Y%m%dT%H%M%SZ)-XXXX")"

for database in inko_catalogo inko_usuarios inko_circulacao; do
  docker compose --env-file .env -f compose.yaml exec -T postgres \
    pg_dump --format=custom --username=inko_admin --dbname="$database" \
    > "$destination/$database.dump"
  test -s "$destination/$database.dump"
  docker compose --env-file .env -f compose.yaml exec -T postgres \
    pg_restore --list < "$destination/$database.dump" >/dev/null
done

(cd "$destination" && sha256sum ./*.dump > SHA256SUMS)
chmod 700 "$destination"
chmod 600 "$destination"/*.dump "$destination/SHA256SUMS"
echo "INKO backup ready: $destination"
