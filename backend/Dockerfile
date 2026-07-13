# Build stage: compile wheels with gcc available
FROM python:3.12-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libc-dev && rm -rf /var/lib/apt/lists/*

RUN python -m venv /venv

COPY pyproject.toml .
COPY app ./app
RUN /venv/bin/pip install --no-cache-dir .

# Runtime stage: slim image, no build toolchain, non-root user
FROM python:3.12-slim

WORKDIR /app

RUN useradd --create-home appuser

COPY --from=build /venv /venv
COPY app ./app

RUN mkdir -p /app/covers /app/backups && chown -R appuser:appuser /app/covers /app/backups

ENV PATH="/venv/bin:$PATH"

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
