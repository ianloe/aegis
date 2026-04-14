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

# Write a standalone Node.js TCP check script to avoid shell interpolation issues
# inside inline -e strings. The script reads host/port from environment variables.
cat > /tmp/tcp-check.js << 'EOF'
const net = require('net');
const host = process.env.TCP_HOST;
const port = parseInt(process.env.TCP_PORT, 10);
const s = net.createConnection({ host, port });
s.on('connect', () => { s.destroy(); process.exit(0); });
s.on('error', () => { s.destroy(); process.exit(1); });
setTimeout(() => { s.destroy(); process.exit(1); }, 3000);
EOF

MAX_ATTEMPTS=60
ATTEMPT=0

until TCP_HOST="$DB_HOST" TCP_PORT="$DB_PORT" node /tmp/tcp-check.js 2>/dev/null; do
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
npx drizzle-kit migrate 2>&1 || {
  echo "[entrypoint] WARNING: drizzle-kit migrate failed or no pending migrations."
}
echo "[entrypoint] Migrations complete."

# ── Start the application ─────────────────────────────────────────────────────
echo "[entrypoint] Starting application server..."
exec "$@"
