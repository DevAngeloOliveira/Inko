FROM python:3.13-slim
WORKDIR /app
ENV UV_PYTHON_DOWNLOADS=0
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
COPY inko_gateway ./inko_gateway
RUN uv sync --locked --no-dev --no-editable
RUN useradd --create-home inko
USER inko
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "inko_gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]
