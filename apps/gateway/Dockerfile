FROM python:3.13-slim
WORKDIR /app
ENV UV_PYTHON_DOWNLOADS=0
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-build --no-install-project
COPY inko_gateway ./inko_gateway
USER 10001:10001
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "inko_gateway.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--limit-concurrency", "64", "--backlog", "128", "--timeout-keep-alive", "5", "--no-proxy-headers", "--no-access-log", "--http", "h11", "--ws", "none"]
