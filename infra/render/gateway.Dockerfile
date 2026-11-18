FROM caddy:2.11.9-alpine AS proxy
FROM python:3.13-slim
WORKDIR /app
ENV UV_PYTHON_DOWNLOADS=0
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /uvx /bin/
COPY apps/gateway/pyproject.toml apps/gateway/uv.lock ./
RUN uv sync --locked --no-dev --no-build --no-install-project
COPY apps/gateway/inko_gateway ./inko_gateway
USER 10001:10001
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
COPY --from=proxy /usr/bin/caddy /usr/local/bin/caddy
COPY --chmod=555 infra/render/start.sh /usr/local/bin/start-inko
CMD ["/usr/local/bin/start-inko"]
