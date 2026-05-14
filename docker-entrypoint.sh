#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Aegis — Docker Entrypoint
# Waits for MySQL to be ready using a Node.js TCP check, then runs Drizzle
# migrations before starting the application server.
# ─────────────────────────────────────────────────────────────────────────────

echo "[entrypoint] Starting Aegis AI Governance Platform..."

# ── Validate DATABASE_URL ─────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set. Aborting."
  exit 1
fi

# Extract host and port from DATABASE_URL
# Format: mysql://user:password@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^@]+@[^:]+:([0-9]+).*|\1|')
DB_PORT="${DB_PORT:-3306}"

echo "[entrypoint] Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."

MAX_ATTEMPTS=60
ATTEMPT=0

# Use bash /dev/tcp for a simple TCP connectivity check — no external tools needed
until (echo > /dev/tcp/"${DB_HOST}"/"${DB_PORT}") 2>/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [[ $ATTEMPT -ge $MAX_ATTEMPTS ]]; then
    echo "[entrypoint] ERROR: MySQL did not become ready after ${MAX_ATTEMPTS} attempts. Aborting."
    exit 1
  fi
  echo "[entrypoint] MySQL not ready yet (attempt ${ATTEMPT}/${MAX_ATTEMPTS}). Retrying in 2s..."
  sleep 2
done

echo "[entrypoint] MySQL is ready."

# ── Run Drizzle migrations ────────────────────────────────────────────────────
# Uses migrate.mjs (drizzle-orm programmatic migrator) — no drizzle-kit required.
# drizzle-kit is a devDependency and is NOT present in the production image.
echo "[entrypoint] Running database migrations..."
if node /app/migrate.mjs; then
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] ERROR: Database migrations failed. Aborting startup."
  exit 1
fi

# ── Start the application ─────────────────────────────────────────────────────
echo "[entrypoint] Starting application server..."
exec "$@"
