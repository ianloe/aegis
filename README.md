# Aegis — AI Governance & Safety Platform

**Aegis** is a self-hosted, open-source AI governance platform designed for enterprises that need to manage, evaluate, and audit AI agents across their organisation. It provides a structured framework for registering AI agents, assessing risk, conducting formal appraisals using the **AI Agent Evaluation Framework (AAEF)**, and detecting shadow AI usage through active network discovery.

Built by [Ian Loe](https://github.com/ianloe) — Managing Director, Group Digital & Technology.

---

## Features

### Agent Registry

- Register and manage all AI agents deployed across the organisation
- Track vendor, model, data classification, deployment environment, and owner
- Assign risk scores and governance status to each agent
- Role-based access control (admin and standard user roles)

### Risk Assessment

- Structured risk scoring across multiple dimensions
- Risk history and trend tracking per agent
- Automated risk level classification (Critical / High / Medium / Low)

### AI Agent Evaluation Framework (AAEF)

- Formal appraisal system based on five evaluation dimensions:
  - **D1** — Task Completion & Accuracy
  - **D2** — Judgement & Contextual Reasoning
  - **D3** — Escalation & Boundary Compliance
  - **D4** — Regulatory & Policy Compliance
  - **D5** — User Experience & Communication Quality
- Weighted Appraisal Score (WAS) calculation with six configurable performance profiles (Default, A–E)
- Override detection for critical compliance failures
- Improvement plan tracker linked to each appraisal
- Organisation-wide AAEF dashboard with WAS distribution and override alerts
- Appraisal cadence management (Tier 1 / 2 / 3)

### AI Discovery Engine

- **Endpoint Probe** — scans 50+ known AI service domains for network reachability
- **Log Analysis** — accepts DNS, proxy, or browser history logs and uses LLM analysis to extract AI tool references
- **Audit Fingerprint** — cross-references the audit trail for unregistered AI API call patterns
- **Pi-hole DNS Connector** — integrates with Pi-hole v6 to pull real DNS query history and surface shadow AI usage across the entire network automatically
- One-click promotion of findings to the agent registry or shadow AI list

### Audit Trail

- Immutable log of all governance actions
- Filterable by agent, action type, user, and date range
- LLM-powered audit summary for suspicious log clusters

### Compliance Reporting

- Status dashboard across key regulatory frameworks (MAS AI Model Risk Management, EU AI Act, PDPA, NIST AI RMF)
- Per-framework compliance posture with gap analysis

### Shadow AI Management

- Track unsanctioned AI tools discovered across the organisation
- Risk classification and remediation workflow
- Integration with Pi-hole for network-level visibility

---

## Technology Stack

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| Frontend          | React 19, Tailwind CSS 4, shadcn/ui |
| Backend           | Node.js, Express 4, tRPC 11         |
| Database          | MySQL 8                             |
| ORM               | Drizzle ORM                         |
| Object Storage    | MinIO (S3-compatible)               |
| Container Runtime | Docker / Podman                     |
| Build Tool        | esbuild (programmatic API)          |
| Testing           | Vitest                              |

---

## Prerequisites

- Docker (or Podman) and Docker Compose installed on your server
- A Linux server with at least 2 GB RAM and 10 GB disk space
- An OpenAI-compatible LLM API key (for AI Discovery log analysis and audit summaries)
- Optional: Pi-hole v6 for automatic shadow AI detection via DNS

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/ianloe/aegis.git
cd aegis
```

### 2. Configure environment variables

```bash
cp env-template.txt .env
```

Edit `.env` and fill in the required values:

```bash
vi .env
```

The minimum required values are:

```env
MYSQL_ROOT_PASSWORD=your_strong_root_password
MYSQL_PASSWORD=your_app_db_password
JWT_SECRET=your_random_64_char_secret
LLM_API_KEY=your_openai_api_key
```

See `env-template.txt` for the full list of options including MinIO credentials, Pi-hole settings, and LLM endpoint configuration.

### 3. Start the platform

```bash
docker compose up -d --build
```

The first build takes approximately 3–5 minutes. The entrypoint will wait for MySQL to be ready, then run all database migrations automatically before starting the application.

### 4. Access the platform

Open `http://your-server-ip:3000` in your browser. The first user to register is automatically assigned the admin role.

---

## Upgrading

To upgrade to a newer version without losing data:

```bash
# Stop the current stack (do NOT use -v — that would delete the database)
docker compose down

# Pull the latest code
git pull origin main

# Rebuild and restart
docker compose up -d --build
```

The migration runner (`migrate.mjs`) is idempotent — it tracks which migrations have already been applied and skips them safely, so re-running it on an existing database is always safe.

---

## Pi-hole Integration

Aegis integrates with Pi-hole v6 to provide real-time shadow AI detection across your network.

1. In Aegis, go to **Discovery → Scan tab → Pi-hole DNS Connector**
2. Enter your Pi-hole base URL (e.g. `https://pihole.yourdomain.net`)
3. Generate an app password in Pi-hole admin under **Settings → API → App Passwords**
4. Enter the app password, enable the connector, and click **Save Settings**
5. Click **Pull Now** to run an immediate scan

Aegis will query the last 24 hours of DNS logs, filter for known AI service domains, and surface any findings in the Discovery Findings tab.

---

## Environment Variables

| Variable              | Required | Description                                                  |
| --------------------- | -------- | ------------------------------------------------------------ |
| `MYSQL_ROOT_PASSWORD` | Yes      | MySQL root password                                          |
| `MYSQL_PASSWORD`      | Yes      | Application database user password                           |
| `MYSQL_DATABASE`      | No       | Database name (default: `aegis`)                             |
| `MYSQL_USER`          | No       | Database username (default: `aegis`)                         |
| `MYSQL_EXPOSE_PORT`   | No       | Host port for MySQL (default: `3306`)                        |
| `JWT_SECRET`          | Yes      | Secret for signing session tokens (min 32 chars)             |
| `LLM_API_KEY`         | Yes      | OpenAI-compatible API key for AI features                    |
| `LLM_API_URL`         | No       | Custom LLM endpoint (default: OpenAI)                        |
| `MINIO_ROOT_USER`     | No       | MinIO admin username (default: `minioadmin`)                 |
| `MINIO_ROOT_PASSWORD` | No       | MinIO admin password                                         |
| `MINIO_EXPOSE_PORT`   | No       | Host port for MinIO console (default: `9001`)                |
| `DB_HOST`             | No       | Database hostname (default: `db` — do not change for Docker) |

> **Important:** Never commit your `.env` file to version control. It is excluded by `.gitignore` by default. Use `env-template.txt` as a reference.

---

## Project Structure

```
aegis/
├── client/                 # React frontend
│   └── src/
│       ├── pages/          # Page components
│       ├── components/     # Reusable UI components
│       └── lib/            # tRPC client and utilities
├── server/                 # Express + tRPC backend
│   ├── routers.ts          # All tRPC procedures
│   ├── db.ts               # Database query helpers
│   ├── aaef.ts             # AAEF evaluation engine
│   ├── discovery.ts        # AI Discovery engine
│   └── pihole.ts           # Pi-hole DNS connector
├── drizzle/                # Database schema and migrations
│   ├── schema.ts           # Table definitions
│   └── *.sql               # Migration files
├── migrate.mjs             # Standalone migration runner
├── build-server.mjs        # esbuild production build script
├── Dockerfile              # Multi-stage container build
├── docker-compose.yml      # Full stack orchestration
├── docker-entrypoint.sh    # Container startup script
└── env-template.txt        # Environment variable reference
```

---

## AAEF — AI Agent Evaluation Framework

The AAEF is a structured appraisal methodology developed by Ian Loe for evaluating AI agents across five dimensions. Each dimension is scored 1–5, and a Weighted Appraisal Score (WAS) is computed based on the selected performance profile.

### Performance Profiles

| Profile | Intended Use                 | D1   | D2   | D3   | D4   | D5   |
| ------- | ---------------------------- | ---- | ---- | ---- | ---- | ---- |
| Default | General purpose              | 20%  | 20%  | 20%  | 20%  | 20%  |
| A       | Autonomous decision-making   | 25%  | 30%  | 20%  | 15%  | 10%  |
| B       | Customer-facing              | 20%  | 20%  | 15%  | 15%  | 30%  |
| C       | Regulated industry           | 20%  | 20%  | 20%  | 30%  | 10%  |
| D       | Research & analysis          | 30%  | 25%  | 15%  | 20%  | 10%  |
| E       | Internal workflow automation | 25%  | 20%  | 25%  | 20%  | 10%  |

### Override Conditions

An agent is flagged for mandatory review when:

- WAS falls below 2.0 (critical threshold)
- Any single dimension scores 1 (critical failure)
- WAS falls below 3.0 for two or more consecutive appraisal periods

---

## Regulatory Alignment

Aegis is designed to support compliance with:

- **MAS AI Model Risk Management** (December 2024) — Singapore financial sector
- **EU AI Act** (2024) — Risk-based classification and high-risk system obligations
- **Singapore PDPA** — AI data governance and advisory guidelines
- **NIST AI RMF** — Govern, Map, Measure, Manage functions

---

## Running Tests

```bash
pnpm test
```

All 50 unit tests cover the AAEF evaluation engine, discovery fingerprinting, Pi-hole connector logic, and tRPC procedure validation.

---

## Licence

MIT Licence. See `LICENSE` for details.

---

## Author

**Ian Loe**
Managing Director, Group Digital & Technology
Adjunct Senior Fellow, Singapore University of Technology and Design (SUTD)

- GitHub: [@ianloe](https://github.com/ianloe)
