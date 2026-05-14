# Aegis — Deployment Guide

This guide covers how to run Aegis on any host with Docker and Docker Compose. The stack consists of three services: the Aegis application server, a MySQL 8 database, and a MinIO object storage instance for file exports.

---

## Prerequisites

The following must be installed on your host machine before you begin.

| Requirement | Minimum Version | Notes |
|---|---|---|
| Docker Engine | 24.x | [Install guide](https://docs.docker.com/engine/install/) |
| Docker Compose plugin | 2.x | Included with Docker Desktop; `docker compose version` to verify |
| `openssl` | Any | To generate a secure JWT secret |

### Rocky Linux quick install

```bash
dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
```

---

## Quick Start

```bash
# 1. Extract the deployment archive
unzip aegis-ai-governance.zip -d /opt/aegis
cd /opt/aegis

# 2. Create your environment file from the template
cp env-template.txt .env

# 3. Generate a secure JWT secret and paste it into .env
openssl rand -hex 64

# 4. Edit .env and replace every CHANGE_ME value (see Configuration section below)
nano .env

# 5. Build and start all services in the background
docker compose up -d --build

# 6. Tail the application logs to confirm a clean start
docker compose logs -f app
```

Once the application prints `Server running on http://localhost:3000/`, open your browser at `http://your-host:3000`.

---

## Configuration

All configuration is passed through environment variables in your `.env` file. The table below describes each variable.

### Database

| Variable | Required | Default | Description |
|---|---|---|---|
| `MYSQL_ROOT_PASSWORD` | Yes | — | Root password for the MySQL container. Not used by the app directly. |
| `MYSQL_DATABASE` | No | `aegis` | Name of the application database. |
| `MYSQL_USER` | No | `aegis` | MySQL user the application connects as. |
| `MYSQL_PASSWORD` | Yes | — | Password for `MYSQL_USER`. |
| `MYSQL_EXPOSE_PORT` | No | `3306` | Host port MySQL is bound to. Set to an empty string to not expose it. |

### Application

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_PORT` | No | `3000` | Host port the Aegis application is served on. |

### Authentication

Aegis uses self-hosted username and password authentication. No external OAuth provider is required. The first user to register via `/register` automatically becomes the administrator.

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | — | Secret used to sign session tokens. Generate with `openssl rand -hex 64`. |
| `INVITE_CODE` | No | *(open)* | If set, all registrations after the first require this code. Recommended for production. |

### LLM API (Optional but recommended)

Required for the **AI Discovery log analysis**, LLM Audit Summaries, and Compliance Report generation features. Supports any OpenAI-compatible endpoint.

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_API_URL` | No | `https://api.openai.com/v1/chat/completions` | OpenAI-compatible chat completions endpoint. |
| `LLM_API_KEY` | No | — | API key for the LLM provider. |

> **Ollama (local LLM):** Set `LLM_API_URL=http://host.docker.internal:11434/v1/chat/completions` and leave `LLM_API_KEY` blank. Use a model with at least 7B parameters for reliable JSON schema compliance (e.g. `llama3`, `mistral`, `qwen2.5`).

### MinIO (Object Storage)

MinIO provides S3-compatible storage for compliance report PDFs and audit log CSV exports. It is included in the Compose stack.

| Variable | Required | Default | Description |
|---|---|---|---|
| `MINIO_ROOT_USER` | No | `aegisadmin` | MinIO admin username. |
| `MINIO_ROOT_PASSWORD` | Yes | — | MinIO admin password. Change before production use. |
| `MINIO_API_PORT` | No | `9000` | Host port for the MinIO S3 API. |
| `MINIO_CONSOLE_PORT` | No | `9001` | Host port for the MinIO web console. |

---

## Database Migrations

Migrations run automatically on container startup via the `docker-entrypoint.sh` script. The entrypoint waits for MySQL to become healthy, then calls `drizzle-kit migrate` before starting the application server.

If you need to run migrations manually:

```bash
docker compose exec app npx drizzle-kit migrate
```

---

## Useful Commands

```bash
# Start all services
docker compose up -d

# Stop all services (data is preserved in named volumes)
docker compose down

# Stop all services AND delete all data volumes (destructive)
docker compose down -v

# Rebuild the application image after a code change
docker compose up -d --build app

# View live application logs
docker compose logs -f app

# View all service logs
docker compose logs -f

# Open a shell inside the running app container
docker compose exec app sh

# Run a one-off database migration
docker compose exec app npx drizzle-kit migrate

# Check the health of all services
docker compose ps
```

---

## Placing Aegis Behind a Reverse Proxy

For production deployments, place Aegis behind a reverse proxy such as Nginx or Caddy to handle TLS termination. The application listens on `PORT` (default `3000`) and does not terminate TLS itself.

### Example Nginx configuration

```nginx
server {
    listen 443 ssl http2;
    server_name aegis.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/aegis.crt;
    ssl_certificate_key /etc/ssl/private/aegis.key;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### Example Caddy configuration (automatic HTTPS)

```
aegis.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

## Updating Aegis

```bash
# Pull the latest code
git pull origin main

# Rebuild and restart the app container only
docker compose up -d --build app

# Migrations run automatically on startup
```

---

## Troubleshooting

**The app container exits immediately on startup.**
Check the logs with `docker compose logs app`. The most common cause is a missing or incorrect `DATABASE_URL` or `JWT_SECRET`. Verify your `.env` file.

**MySQL health check is failing.**
The `db` service can take 20–30 seconds to initialise on first boot. The entrypoint retries for up to 2 minutes. If it still fails, check `docker compose logs db` for MySQL startup errors.

**`drizzle-kit migrate` fails with "table already exists".**
This is safe to ignore on subsequent restarts — Drizzle only applies pending migrations.

**MinIO console is not accessible.**
Confirm `MINIO_CONSOLE_PORT` is not blocked by a firewall and that the `minio` service is healthy: `docker compose ps minio`.

**LLM Analysis or Compliance Reports return errors.**
Verify that `LLM_API_KEY` and `LLM_API_URL` are set correctly in your `.env` file. If you are using Ollama locally, set `LLM_API_URL=http://host.docker.internal:11434/v1/chat/completions` and leave `LLM_API_KEY` blank.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │           Docker Compose Stack           │
                    │                                         │
  Browser ──HTTPS──▶│  Nginx / Caddy (reverse proxy, TLS)    │
                    │         │                               │
                    │         ▼                               │
                    │  ┌─────────────┐   ┌─────────────────┐ │
                    │  │  Aegis App  │──▶│   MySQL 8.0     │ │
                    │  │  (Node.js)  │   │  (aegis-db)     │ │
                    │  │  port 3000  │   └─────────────────┘ │
                    │  │             │                        │
                    │  │             │   ┌─────────────────┐ │
                    │  │             │──▶│   MinIO (S3)    │ │
                    │  └─────────────┘   │  port 9000/9001 │ │
                    │                    └─────────────────┘ │
                    └─────────────────────────────────────────┘
```

---

## Security Recommendations for Production

Before exposing Aegis to the internet, review the following checklist.

- Change every `CHANGE_ME` value in your `.env` file to a strong, unique secret.
- Generate `JWT_SECRET` with `openssl rand -hex 64` — never reuse secrets across environments.
- Set `MYSQL_EXPOSE_PORT` to an empty string or remove the `ports` mapping from the `db` service so MySQL is not accessible from outside the Docker network.
- Place the application behind a reverse proxy with TLS (HTTPS) enabled.
- Restrict MinIO console access (`MINIO_CONSOLE_PORT`) to internal networks or a VPN.
- Run regular backups of the `aegis-db-data` and `aegis-minio-data` Docker volumes.
- Keep Docker, the base images, and all dependencies up to date.
