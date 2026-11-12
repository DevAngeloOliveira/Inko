#!/usr/bin/env bash
set -euo pipefail

gateway_url="http://127.0.0.1:${GATEWAY_PORT:-8000}"
web_url="http://127.0.0.1:${WEB_PORT:-3000}"
python_bin="${PYTHON:-python3}"

curl --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 2 \
  --max-time 2 "$gateway_url/health" >/dev/null

curl --fail --silent --show-error --max-time 2 "$gateway_url/ready" >/dev/null

curl --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 2 \
  --max-time 2 "$web_url/" >/dev/null

"$python_bin" - "$gateway_url" <<'PY'
import json
import subprocess
import sys
import time

url = sys.argv[1] + "/api/v1/system/status"
expected = {"catalogo", "usuarios", "circulacao", "relatorios"}
deadline = time.monotonic() + 20
observation = "snapshot unavailable"
while (remaining := deadline - time.monotonic()) > 0:
    try:
        timeout = min(2, remaining)
        raw = subprocess.check_output(
            ["curl", "--fail", "--silent", "--max-time", str(timeout), url], timeout=timeout
        )
        payload = json.loads(raw)
        services = payload["services"]
        statuses = {item["service"]: item["status"] for item in services}
        fresh = payload["stale"] is False and 0 <= payload["ageMs"] <= 15_000
        if fresh and len(services) == 4 and statuses == dict.fromkeys(expected, "up"):
            print("All four Java services are healthy in a fresh Gateway snapshot.")
            break
        observation = f"services={statuses}, fresh={fresh}"
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        observation = type(error).__name__
    time.sleep(max(0, min(1, deadline - time.monotonic())))
else:
    raise SystemExit(f"No fresh, healthy Gateway snapshot within 20 seconds: {observation}")
PY

for service in catalogo usuarios circulacao relatorios; do
  curl --fail --silent --show-error --max-time 3 "$gateway_url/api/v1/$service/ping" |
    "$python_bin" -c 'import json,sys; p=json.load(sys.stdin); assert p["status"]=="ok"'
done

database_count="$(docker compose exec -T postgres psql --username inko_admin --dbname postgres -tAc \
  "SELECT count(*) FROM pg_database WHERE datname IN ('inko_catalogo','inko_usuarios','inko_circulacao')")"
[[ "$database_count" == 3 ]] || {
  echo "Expected three isolated application databases, got: $database_count" >&2
  exit 1
}

INKO_BASE_URL="$web_url" node apps/web/scripts/smoke-static-assets.mjs
echo "INKO seven-container smoke suite succeeded."
