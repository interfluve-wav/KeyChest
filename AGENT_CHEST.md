# Agent Chest — HTTP Credential Proxy for AI Agents

Agent Chest is an HTTP credential proxy and vault built into SSH Vault Tauri. It prevents AI agents from ever touching raw API credentials by brokering authentication at the proxy layer.

## The Problem

Secret managers return credentials to the caller and trust them to behave. AI agents break that assumption — they are non-deterministic, prompt-injectable, and increasingly sitting in front of production APIs.

## The Solution

Instead of returning credentials to the agent, Agent Chest forces the agent to proxy requests through it. Credentials stay encrypted in the vault. The proxy injects them into outbound requests and forwards to the target API. The agent never sees the keys.

```
Without Agent Chest:
  Agent → "Give me the key" → Vault → returns sk-prod-key → Agent sends request with key
                                                           ↑ Key in agent memory. Exfiltratable.

With Agent Chest:
  Agent → HTTPS_PROXY=http://127.0.0.1:8080
  Agent → sends normal HTTP request (no key)
  Proxy → matches host to stored credential
  Proxy → injects Authorization header
  Proxy → forwards to target API
  Proxy → logs request to audit trail
           ↑ Agent never saw the credential.
```

## Features

### Brokered Access via HTTPS_PROXY
Agents configure `HTTPS_PROXY` and set `X-Vault-ID`. The proxy intercepts requests, matches the target host to stored credentials, injects auth headers, and forwards. Nothing to exfiltrate.

### Firewall-like Access Rules
Define allow/deny rules by host pattern, path pattern, and HTTP method. Agents can only reach whitelisted endpoints.

| Rule | Host Match | Path Match | Methods | Action |
|------|------------|------------|---------|--------|
| Allow OpenAI | `api.openai.com` | `/v1/*` | GET, POST | Allow |
| Deny Internal | `*.internal.example.com` | `*` | * | Deny |
| Allow GitHub | `api.github.com` | `*` | * | Allow |

### Multi-Vault RBAC
Bind credentials and rules to specific vault IDs. Agent A with vault X can access OpenAI. Agent B with vault Y can only access GitHub. Blast radius is scoped.

### Full Audit Trail
Every request is logged with:
- Timestamp, agent ID, vault ID
- Method, target host, path
- Action (allow, deny, broker, error)
- HTTP status code, matched credential, matched rule
- Source IP, user agent, duration in ms

### Single Go Binary
The proxy compiles to a single Go binary. Available as a Docker container. No external dependencies.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  SSH Vault Tauri App                                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Frontend (React)                                           │ │
│  │  ├── ProxyManager component — start/stop, credentials,     │ │
│  │  │   rules, RBAC bindings, audit trail                      │ │
│  │  └── Proxy tab in VaultDashboard                            │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │  Rust Backend (proxy.rs)                                    │ │
│  │  ├── Spawns agent-chest-proxy binary                        │ │
│  │  ├── Bridges management API (localhost:8081)               │ │
│  │  └── 13 Tauri commands: start, stop, status, CRUD, audit  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  agent-chest-proxy (Go binary — separate process)                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  Proxy Server │  │  Mgmt API    │  │  Audit Logger       │   │
│  │  :8080        │  │  :8081       │  │  (file + memory)    │   │
│  │  ┌──────────┐ │  │  ┌────────┐  │  └────────────────────┘   │
│  │  │ HTTP     │ │  │  │ CRUD   │  │                            │
│  │  │ CONNECT │ │  │  │ Rules  │  │  ┌────────────────────┐   │
│  │  │ Forward  │ │  │  │ RBAC   │  │  │  In-Memory Stores  │   │
│  │  └──────────┘ │  │  │ Audit  │  │  │  · Credentials     │   │
│  └──────────────┘  │  └────────┘  │  │  · Rules           │   │
│                     │  /api/v1/*    │  │  · Bindings        │   │
│                     └──────────────┘  └────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Build the proxy binary

```bash
cd agent-chest-proxy
go build -o ../src-tauri/ ./cmd/agent-chest-proxy/
```

### 2. Start the app

```bash
npm run tauri dev
```

### 3. Start the proxy

Open the app, unlock a vault, click the **Proxy** tab, and hit **Start Proxy**. Or start it manually:

```bash
./src-tauri/agent-chest-proxy --proxy-port 8080 --mgmt-port 8081
```

### 4. Configure your agent

```bash
export HTTPS_PROXY=http://127.0.0.1:8080
export X_VAULT_ID=your-vault-id-here

# Agent makes normal requests — proxy handles auth
curl https://api.openai.com/v1/chat/completions
```

## Management API Reference

The management API runs on port 8081 by default.

### Status

```
GET /api/v1/status
→ {"status":"running","audit_entries":42}
```

### Credentials

```
GET    /api/v1/credentials          — List all credentials
POST   /api/v1/credentials          — Add credential
GET    /api/v1/credentials/:id      — Get credential
DELETE /api/v1/credentials/:id      — Delete credential
```

**Credential object:**
```json
{
  "id": "uuid",
  "name": "OpenAI API Key",
  "vault_id": "vault-uuid",
  "target_host": "api.openai.com",
  "target_prefix": "/v1",
  "auth_type": "bearer",
  "header_name": "",
  "header_value": "sk-...",
  "created_at": "2026-04-23T00:00:00Z"
}
```

**Auth types:**
| Type | Behavior |
|------|----------|
| `bearer` | Sets `Authorization: Bearer <value>` |
| `api_key_header` | Sets `<header_name>: <value>` (e.g., `steel-api-key: <key>`) |
| `basic_auth` | Sets `Authorization: Basic <value>` (value = base64(user:pass)) |

### Access Rules

```
GET    /api/v1/rules         — List all rules
POST   /api/v1/rules         — Add rule
DELETE /api/v1/rules/:id      — Delete rule
```

**Rule object:**
```json
{
  "id": "uuid",
  "vault_id": "vault-uuid",
  "name": "Allow OpenAI",
  "host_match": "api.openai.com",
  "path_match": "/v1/*",
  "methods": ["GET", "POST"],
  "action": "allow",
  "created_at": "2026-04-23T00:00:00Z"
}
```

**Pattern matching:**
| Pattern | Matches |
|---------|---------|
| `*` | Any host/path |
| `api.openai.com` | Exact match |
| `*.example.com` | Any subdomain of example.com |
| `/v1/*` | Any path starting with /v1/ |

### RBAC Bindings

```
GET    /api/v1/bindings         — List all bindings
POST   /api/v1/bindings         — Create binding
DELETE /api/v1/bindings/:id      — Delete binding
```

**Binding object:**
```json
{
  "id": "uuid",
  "vault_id": "vault-uuid",
  "credential_ids": ["cred-1", "cred-2"],
  "rule_ids": ["rule-1", "rule-2"],
  "created_at": "2026-04-23T00:00:00Z"
}
```

### Audit Log

```
GET /api/v1/audit?limit=100&offset=0
```

**Audit entry:**
```json
{
  "timestamp": "2026-04-23T19:18:59Z",
  "agent_id": "my-agent-1",
  "vault_id": "vault-uuid",
  "method": "GET",
  "target": "api.openai.com",
  "path": "/v1/chat/completions",
  "action": "broker",
  "status_code": 200,
  "credential_id": "cred-uuid",
  "rule": "allowed by rule: Allow OpenAI",
  "source_ip": "127.0.0.1:63939",
  "user_agent": "python-requests/2.31.0",
  "duration_ms": 148
}
```

## Docker

```bash
docker build -t agent-chest-proxy ./agent-chest-proxy
docker run -p 8080:8080 -p 8081:8081 agent-chest-proxy
```

With a config file:
```bash
docker run -p 8080:8080 -p 8081:8081 \
  -v ./config.json:/etc/agent-chest/config.json \
  agent-chest-proxy --config /etc/agent-chest/config.json
```

## Configuration File

```json
{
  "credentials": [
    {
      "id": "prod-openai",
      "name": "OpenAI Production",
      "vault_id": "vault-uuid",
      "target_host": "api.openai.com",
      "target_prefix": "/v1",
      "auth_type": "bearer",
      "header_name": "",
      "header_value": "sk-prod-xxx",
      "created_at": "2026-04-23T00:00:00Z"
    }
  ],
  "rules": [
    {
      "id": "allow-openai",
      "vault_id": "vault-uuid",
      "name": "Allow OpenAI API",
      "host_match": "api.openai.com",
      "path_match": "/v1/*",
      "methods": ["GET", "POST"],
      "action": "allow",
      "created_at": "2026-04-23T00:00:00Z"
    }
  ],
  "bindings": [
    {
      "id": "agent-a-binding",
      "vault_id": "vault-uuid",
      "credential_ids": ["prod-openai"],
      "rule_ids": ["allow-openai"],
      "created_at": "2026-04-23T00:00:00Z"
    }
  ]
}
```

## How Credential Injection Works

| Auth Type | Host Match | Behavior |
|-----------|------------|----------|
| `bearer` | Request host matches `target_host` | Injects `Authorization: Bearer <header_value>` |
| `api_key_header` | Request host matches `target_host` | Injects `<header_name>: <header_value>` (e.g., `steel-api-key: xxx`) |
| `basic_auth` | Request host matches `target_host` | Injects `Authorization: Basic <header_value>` |

For HTTPS (CONNECT) requests where a matching credential exists, the proxy upgrades the connection to a forward-proxy request — it makes the TLS request itself with injected headers and relays the response back, ensuring credentials are injected even over HTTPS.

For HTTPS requests with no matching credential, the proxy tunnels the connection transparently (standard CONNECT behavior).

## Security Considerations

- **Credentials are stored in-memory only** — the Go proxy process has no persistent storage. Credentials are loaded from config or via the management API at runtime.
- **Management API has no auth** — bind to localhost only. In production, put an auth proxy in front.
- **Vault encryption is AES-256-GCM** — the same encryption used for the main vault.
- **Audit logs** can be written to disk for forensics and compliance.
- **Host pattern matching** prevents agents from reaching unintended endpoints.
- **Method filtering** restricts agents to safe HTTP methods (e.g., GET/POST only, no DELETE).