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

docker compose exec -T gateway python - <<'PY'
import re
from urllib.request import urlopen

services = ("catalogo", "usuarios", "circulacao", "relatorios")
for port, service in enumerate(services, 8081):
    with urlopen(f"http://{service}:{port}/actuator/prometheus", timeout=5) as response:
        content_type = response.headers.get_content_type()
        body = response.read(2_097_153)
    if content_type not in ("text/plain", "application/openmetrics-text") or len(body) > 2_097_152:
        raise SystemExit(f"Invalid Prometheus response for {service}")
    series = {re.split(r"[{ ]", line, maxsplit=1)[0] for line in body.decode().splitlines() if line and not line.startswith("#")}
    required = {"jvm_memory_used_bytes", "process_uptime_seconds", "http_server_requests_seconds_count"}
    if service != "relatorios":
        required |= {f"hikaricp_connections_{state}" for state in ("active", "idle", "pending", "max")}
    missing = required - series
    if missing:
        raise SystemExit(f"Missing Prometheus series for {service}: {sorted(missing)}")
print("All four internal Java Prometheus endpoints returned the required metrics.")
PY

if [[ "${INKO_CHECK_MONITORING:-0}" == 1 ]]; then
  docker compose exec -T gateway python - <<'PY'
import json
import time
from urllib.request import urlopen

expected = {"inko-java": 4, "inko-gateway": 1}
deadline = time.monotonic() + 45
while True:
    try:
        with urlopen("http://prometheus:9090/api/v1/targets?state=active", timeout=2) as response:
            targets = json.load(response)["data"]["activeTargets"]
        counts = {job: sum(t["labels"].get("job") == job and t["health"] == "up" for t in targets) for job in expected}
        if counts == expected:
            print("Prometheus scrape is UP for all four Java services and the Gateway.")
            break
    except (OSError, ValueError, KeyError):
        pass
    if time.monotonic() >= deadline:
        raise SystemExit("Prometheus targets did not all become UP")
    time.sleep(1)
PY
fi

if [[ "$(curl --silent --show-error --max-time 3 --output /dev/null --write-out '%{http_code}' "$web_url/metrics")" != 404 ]]; then
  echo "Expected Web /metrics to return 404" >&2
  exit 1
fi

INKO_BASE_URL="$web_url" node apps/web/scripts/smoke-static-assets.mjs
echo "INKO seven-container smoke suite succeeded."
