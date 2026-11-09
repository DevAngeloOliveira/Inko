#!/usr/bin/env bash
set -euo pipefail

curl --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 2 \
  http://127.0.0.1:8000/health >/dev/null

curl --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 2 \
  http://127.0.0.1:3000/ >/dev/null

curl --fail --silent --show-error \
  http://127.0.0.1:8000/api/v1/system/status |
  python3 -c '
import json
import sys

payload = json.load(sys.stdin)
expected = {"catalogo", "usuarios", "circulacao", "relatorios"}
statuses = {item["service"]: item["status"] for item in payload["services"]}
if set(statuses) != expected or any(value != "up" for value in statuses.values()):
    raise SystemExit(f"Unexpected INKO service health: {statuses}")
print("All four Java services are healthy through FastAPI Gateway.")
'

for service in catalogo usuarios circulacao relatorios; do
  curl --fail --silent --show-error "http://127.0.0.1:8000/api/v1/$service/ping" |
    python3 -c 'import json,sys; p=json.load(sys.stdin); assert p["status"]=="ok"'
done

database_count="$(docker compose exec -T postgres psql --username inko_admin --dbname postgres -tAc \
  "SELECT count(*) FROM pg_database WHERE datname IN ('inko_catalogo','inko_usuarios','inko_circulacao')")"
[[ "$database_count" == 3 ]] || {
  echo "Expected three isolated application databases, got: $database_count" >&2
  exit 1
}

node apps/web/scripts/smoke-static-assets.mjs
echo "INKO seven-container smoke suite succeeded."
