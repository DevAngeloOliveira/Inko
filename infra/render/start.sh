#!/bin/sh
set -eu
: "${INKO_SERVICE:?}" "${INKO_SERVICE_KEY:?}" "${PORT:?}"
config=/tmp/inko-caddyfile
umask 077
cat > "$config" <<'CADDY'
{
    admin off
    auto_https off
    persist_config off
}
CADDY

# Each application uses localhost for outbound calls. The proxy adds the
# credential only for the fixed peer hosts supplied by the Blueprint.
add_peer() {
    [ -n "$2" ] || return 0
    case "$2" in
        *[!a-zA-Z0-9.-]*|'') exit 1 ;;
        *.onrender.com) ;;
        *) exit 1 ;;
    esac
    cat >> "$config" <<EOF
http://127.0.0.1:$1 {
    bind 127.0.0.1
    reverse_proxy https://$2 {
        header_up Host $2
        header_up X-Inko-Service {env.INKO_SERVICE_KEY}
    }
}
EOF
}
add_peer 8000 "${GATEWAY_HOST:-}"
add_peer 8081 "${CATALOGO_HOST:-}"
add_peer 8082 "${USUARIOS_HOST:-}"
add_peer 8083 "${CIRCULACAO_HOST:-}"
add_peer 8084 "${RELATORIOS_HOST:-}"

if [ "$INKO_SERVICE" != web ]; then
    cat >> "$config" <<'CADDY'
http://:{$PORT} {
    @internal header X-Inko-Service {$INKO_SERVICE_KEY}
    handle @internal {
        reverse_proxy 127.0.0.1:9000 {
            header_up -X-Inko-Service
        }
    }
    handle {
        respond 403
    }
}
CADDY
fi
export HOME=/tmp XDG_CONFIG_HOME=/tmp XDG_DATA_HOME=/tmp
caddy start --config "$config" --adapter caddyfile
case "$INKO_SERVICE" in
    web) export HOSTNAME=0.0.0.0; exec node apps/web/server.js ;;
    gateway)
        export INKO_GATEWAY_READ_TIMEOUT="${INKO_GATEWAY_READ_TIMEOUT:-2.2}"
        export INKO_GATEWAY_DEADLINE="${INKO_GATEWAY_DEADLINE:-2.35}"
        exec uvicorn inko_gateway.main:app --host 127.0.0.1 --port 9000 --no-proxy-headers --no-access-log
        ;;
    catalogo|circulacao|usuarios)
        export DB_URL="jdbc:postgresql://${DB_HOST:?}:5432/${DB_NAME:?}?currentSchema=$INKO_SERVICE"
        export SPRING_FLYWAY_SCHEMAS="$INKO_SERVICE"
        if [ "$INKO_SERVICE" = circulacao ]; then
            export INKO_CIRCULATION_CONNECT_TIMEOUT="${INKO_CIRCULATION_CONNECT_TIMEOUT:-600ms}"
            export INKO_CIRCULATION_READ_TIMEOUT="${INKO_CIRCULATION_READ_TIMEOUT:-900ms}"
        fi
        ;;
    relatorios)
        export INKO_REPORT_CONNECT_TIMEOUT="${INKO_REPORT_CONNECT_TIMEOUT:-800ms}"
        export INKO_REPORT_READ_TIMEOUT="${INKO_REPORT_READ_TIMEOUT:-1700ms}"
        export INKO_REPORT_BUDGET="${INKO_REPORT_BUDGET:-1900ms}"
        ;;
    *) exit 1 ;;
esac
export SERVER_ADDRESS=127.0.0.1 SERVER_PORT=9000
exec java -XX:MaxRAMPercentage=55 -jar /app/app.jar
