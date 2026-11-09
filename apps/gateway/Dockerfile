FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml ./
COPY inko_gateway ./inko_gateway
RUN pip install --no-cache-dir .
RUN useradd --create-home inko
USER inko
EXPOSE 8000
CMD ["uvicorn", "inko_gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]
