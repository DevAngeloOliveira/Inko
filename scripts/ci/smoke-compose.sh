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

node apps/web/scripts/smoke-static-assets.mjs
echo "INKO seven-container smoke suite succeeded."
