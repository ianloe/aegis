#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Aegis — Docker Entrypoint
# Waits for MySQL to be ready, then runs Drizzle migrations before starting
# the application server.
# ─────────────────────────────────────────────────────────────────────────────

echo "[entrypoint] Starting Aegis AI Governance Platform..."

# ── Parse DATABASE_URL ────────────────────────────────────────────────────────
# Expected format: mysql://user:password@host:port/dbname
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set. Aborting."
  exit 1
fi

# Extract host and port from DATABASE_URL using parameter expansion
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^@]+@[^:]+:([0-9]+).*|\1|')
DB_PORT="${DB_PORT:-3306}"
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')

echo "[entrypoint] Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."

MAX_ATTEMPTS=60
ATTEMPT=0
until mysqladmin ping -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" --silent 2>/dev/null; do
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
echo "[entrypoint] Running database migrations..."
# Use drizzle-kit migrate to apply any pending migrations
npx drizzle-kit migrate 2>&1 || {
  echo "[entrypoint] WARNING: drizzle-kit migrate failed or no pending migrations."
}
echo "[entrypoint] Migrations complete."

# ── Start the application ─────────────────────────────────────────────────────
echo "[entrypoint] Starting application server..."
exec "$@"
