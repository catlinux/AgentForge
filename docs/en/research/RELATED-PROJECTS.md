# Related projects — light exploration (Phase 0.7)

**Status:** light research completed. **Date:** 2026-09-16. **Depth level:** deliberately shallow
(not a full due-diligence pass like the one done for Composio in Phase 0) — the goal is to
identify useful ideas and patterns, not to exhaustively audit every project.

> **Important clarification on the purpose of this document:** AgentForge is **not** being
> designed as an alternative, replacement, improvement, or "conceptual fork" of any of the
> projects analyzed here — including Composio (analyzed in depth in Phase 0, see
> `docs/research/COMPOSIO-ANALYSIS.md`). Composio is only one of many references studied.
> AgentForge is an independent project that studies different existing solutions from the
> AI-agent-tooling ecosystem and adapts whichever concepts it finds useful to its own
> architecture and requirements — never their code, unless a specific license explicitly allows
> it and that is decided in a future phase.

All claims are classified as **VERIFIED FUNCTIONALITY** (confirmed against a primary source,
cited), **INTERPRETATION** (a reasonable inference not textually confirmed), or **REQUIRES DEEPER
RESEARCH** (could not be confirmed at this phase's effort level). No ranking or scoring is
presented — the goal is to extract ideas, not to compare winners.

---

## Nango

### Purpose
VERIFIED FUNCTIONALITY (github.com/NangoHQ/nango, nango.dev/docs): a platform for building product
integrations with 1,000+ APIs — authentication (OAuth/API keys), call execution, scaling, and
observability, for both traditional SaaS and AI agents.

### Main features
Three primitives: **Auth** (managed OAuth/API keys, multi-tenant), **Proxy** (authenticated API
calls with rate-limit/retry handling), **Functions** (deployable TypeScript functions for custom
integration logic, with AI-assisted generation). Plus: syncs, webhooks, agent tool calling.

### Tools / Connectors
Each "tool" is an action function invocable by an agent/LLM/MCP client for a specific connection;
Nango handles credentials, retries, rate limits, and logging on the proxy side. Tool configs
available in OpenAI-compatible or native format.

### Authentication and credentials
Managed OAuth (multiple variants) and API keys, with automatic token refresh, multi-tenant
("connections" per integration), embeddable "white-label auth flow".

### Secrets
INTERPRETATION: connection credentials centralized in the Auth layer. Exact at-rest encryption
mechanism — REQUIRES DEEPER RESEARCH.

### Permissions / authorization
REQUIRES DEEPER RESEARCH for an internal RBAC model of its own; the main control point is the
OAuth scopes requested per connection, not a dedicated policy engine. SSO/MFA only on Cloud, not
self-hosted.

### MCP
Two distinct MCP servers: **Management MCP** (config/debug the environment) and **Tool-Calling MCP
Server** (runtime, tool execution). Important: this is a paid feature, not included in free
self-hosting.

### Execution
TypeScript Functions run on Nango's managed runtime (cloud, or the customer's own infrastructure
under Enterprise Self-Hosted).

### Sessions / state
The "Connection" (persistent credentials + metadata) is the central state concept; syncs maintain
incremental sync state. Agent-session-vs-connection model — REQUIRES DEEPER RESEARCH.

### Audit / observability
"Operations" system with nested "log messages"; OpenTelemetry export (paid Growth tier only). Free
self-hosted: observability limited to Auth+Proxy.

### Self-hosting
Three modes: **Free Self-Hosted** (Auth+Proxy only, no syncs/webhooks/tool calls/MCP/SSO),
**Enterprise Self-Hosted** (all paid features, own infrastructure, annual license + maintenance
fee), **Nango Cloud** (fully managed SaaS, only tier with SAML SSO). The repo is described as
"fully open source" but real functionality is heavily gated by plan.

### License
**Elastic License 2.0 (ELv2)** — source-available, **not OSI-approved**. Prohibits offering the
software as a competing hosted service and circumventing "license key" mechanisms for paid
features. Important caveat: key features for agent use cases (tool calling, MCP server, syncs,
webhooks) are gated behind the paid model even in self-hosting.

### Ideas potentially useful for AgentForge
- "Operations + nested log messages" pattern for structured observability.
- Conceptual separation of Auth / Proxy / Functions as independent layers.
- Two MCP servers with distinct purposes (management/development vs. runtime) — decouples control
  plane from execution plane.
- Principle: "the agent never sees credentials, they're only injected into the call".
- OpenTelemetry as the standard observability format.

### Elements we probably don't need
- The aggressive feature-gating-via-license business model (a commercial decision, not a technical
  pattern).
- The catalog of 1,000+ prebuilt connectors as a goal in itself.
- The "white-label auth flow" for third-party SaaS products (a different use case than
  AgentForge's).

---

## Arcade (Arcade AI)

### Purpose
VERIFIED FUNCTIONALITY (docs.arcade.dev): "the enterprise-ready actions runtime for AI agents".
Three pillars: **Authorization** (OAuth 2.0/API keys/user tokens), **Execution** (reliable tools at
scale), **Governance** (centralized control, visibility, compliance).

### Main features
`arcade-mcp` Python framework for building MCP servers and tools; 7,500+ prebuilt tools across 81
MCP servers; CLI (`arcade new`, `arcade deploy`); integration with Claude Desktop/Cursor/VS Code;
central tool registry with versioning.

### Tools / Connectors
Decorator-based API covering the full MCP spec; scopes declared via helper classes
(`GitHub(scopes=["repo"])`). Two-zone architecture: **Local Zone** (single-user development) and
**Platform Zone** (Arcade Engine — control plane with project/user management, tool registry,
auth/secrets, distributed runtime).

### Authentication and credentials
"Check-then-request" pattern: checks whether the user already authorized the required scopes; if
not, kicks off OAuth with an explicit consent URL. Token remembered until expiry/revocation,
injected into the tool's Context on the next invocation — **the client/LLM never sees the
token**.

### Secrets
Centralized storage (`.env` for development only; Dashboard/CLI recommended in production),
"encrypted environment" with runtime injection. Exact cryptographic detail — REQUIRES DEEPER
RESEARCH.

### Permissions / authorization
Fine-grained, per-action authorization, integrable with the customer's IdP/DLP/SIEM; hooks and
rate limiting for runtime enforcement; "visibility filtering" in the shared tool registry.

### MCP
Central to the product — "the MCP runtime for production AI agents". The `arcade-mcp` framework is
the foundation for building MCP servers; the Engine exposes the 7,500+ tools as MCP servers and
allows registering external MCP servers under the same governance framework.

### Execution
Distributed runtime inside the Arcade Engine (production); in development, a local MCP server
(stdio/HTTP).

### Sessions / state
INTERPRETATION: per-provider user tokens/authorizations + versioned tool registry. Exact
agent/conversation session model — REQUIRES DEEPER RESEARCH.

### Audit / observability
"OpenTelemetry audit logs" tracking tool execution and access patterns, as a core part of the
Governance pillar.

### Self-hosting
Arcade Cloud (managed), self-hosted full Engine (Helm/Kubernetes, Azure/AWS/GCP marketplace), or
"Hybrid MCP servers" (own MCP servers connected to Arcade Cloud for auth/governance).

### License
Main repo (`arcade-ai`/`arcade-mcp`): **MIT**. Some repos (docs, TS packages): Apache 2.0.
**Important caveat**: no clear evidence that the **Arcade Engine** (production control plane)
shares the MIT license of the development framework — the hosting docs don't explicitly mention
its license. REQUIRES DEEPER RESEARCH.

### Ideas potentially useful for AgentForge
- Explicit "Local Zone" (development) vs. "Platform Zone" (production/governance) separation as an
  architectural mental model.
- "Check-then-request" authorization pattern with token injection into the Context, never visible
  to the LLM.
- Centralized tool registry with versioning and "visibility filtering".
- OpenTelemetry-based auditing from initial design.
- Registering external MCP servers ("vendor-managed") under the same governance framework as
  first-party tools.

### Elements we probably don't need
- The catalog of 7,500+ prebuilt tools.
- Specific third-party framework integrations (LangChain, CrewAI, etc.).
- The marketplace-based commercial model for self-hosting.

---

## Windmill

### Purpose
VERIFIED FUNCTIONALITY (official README): an open-source developer infrastructure platform that
turns scripts into webhooks/workflows/UIs — a self-hosted alternative to Retool (UIs) and Temporal
(workflow orchestration).

### Main features
Scripts (Python/TypeScript/Go/Bash/SQL/GraphQL/PowerShell/Rust) automatically turned into
executable UIs; composition into "flows" or low-code apps; triggers (schedules, webhooks, Kafka,
WebSockets, email); community script Hub.

### Tools / Connectors
Managed via **"Resources"**: JSON objects attached to a **"Resource Type"** (JSON schema, 200+
prebuilt types, customizable). Supports dynamic placeholders resolved at execution time (`$var:`
for secrets, `$res:` to embed another resource, `$WM_*` contextual variables).

### Authentication and credentials
Configurable SSO/OAuth (Google Workspace, Microsoft/Azure, Okta); service accounts (tokens) for
login-free automation.

### Secrets
Sensitive credentials stored as encrypted "Variables"; when a Resource references a secret via
`$var:`, only the reference stays in version history — the secret itself never enters it.
Append-only history (up to 100 versions) with selective purging of old inline credentials. Exact
cryptographic detail — REQUIRES DEEPER RESEARCH.

### Permissions / authorization
Multi-level model: Superadmin/Devops/Regular user (instance); Admin/Developer/Operator/Service
Accounts (workspace); fine-grained ACLs (Owner/Writer/Viewer) per entity; path-based organization
(`u/<user>/`, `f/<folder>/` with cascading permissions); **"Run on behalf of"** (execution with a
designated user's identity); Guests and Anonymous Viewers.

### MCP
Not mentioned in the README — Windmill does not appear MCP-centric. REQUIRES DEEPER RESEARCH
whether a recent feature has added it.

### Execution
Stateless workers (Rust) consuming a Postgres-backed queue; isolation via **nsjail**
(filesystem/resources) and PID namespace; ~50ms overhead per job lifecycle.

### Sessions / state
State persistence across runs via the `wmill.getState()`/`setState()` API.

### Audit / observability
Logs always available, optional JSON format; Prometheus metrics **Enterprise Edition only**.

### Self-hosting
Docker Compose, Helm/Kubernetes, cloud deployment. **Important dual model**: the binary without
the "enterprise" flag is pure AGPLv3, but the distributed Community Edition includes proprietary,
non-public-source components — it cannot be resold, offered as a managed service, modified, or
repackaged without explicit agreement.

### License
Multiple-license model: **AGPLv3** (backend/frontend by default), **Apache 2.0** (clients,
OpenAPI/OpenFlow specs), **proprietary/commercial** (features under the "enterprise" flag, not in
the source repo).

### Ideas potentially useful for AgentForge
- **Resource / Resource Type pattern** (JSON schema + reusable types + community Hub) for defining
  connectors declaratively and with versioning.
- **Runtime-resolved placeholders** (`$var:`, `$res:`) to keep secrets out of config history.
- **Fine-grained, path-based ACLs** combined with workspace roles.
- **"Run on behalf of"** (delegated execution with a scoped identity) — relevant to the remote
  execution auth problem AgentForge already flagged in Phase 0.
- Process-level sandboxing (nsjail) as an execution-isolation reference.
- Append-only config history with selective secret purging.

### Elements we probably don't need
- The full DAG-style workflow engine (low-latency orchestration comparable to Airflow/Temporal) —
  out of scope for tool-use infrastructure.
- Automatic UI generation (low-code app builder).
- Kafka/WebSockets/email triggers as workflow-kickoff mechanisms.
- The dual business model with closed proprietary components — a pattern to avoid, not adopt.

---

## IBM ContextForge (MCP Gateway / `IBM/mcp-context-forge`)

### Purpose
VERIFIED FUNCTIONALITY: an MCP gateway, proxy, and registry — a central management point for
tools/resources/prompts accessible by MCP-compatible LLM applications. Converts REST↔MCP, composes
"virtual MCP servers", converts between transports (stdio/SSE/Streamable HTTP/WebSocket).

### Main features
Federates multiple MCP servers, A2A servers, and REST/gRPC APIs under one unified endpoint;
centralized discovery; rate-limiting; observability; "virtual server" composition; optional admin
UI; plugin system; scales to multi-cluster Kubernetes with Redis-backed federation/caching.

### Tools / Connectors
Central tools/prompts/resources registry **with versioning and rollback**; automatic REST-to-MCP
adaptation (JSON Schema extraction); namespaced-federation discovery; multiple remote gateways as
peers with health-checking.

### Authentication and credentials
Email + Argon2id hashing; JWT (HS256/RS256); SSO (GitHub, Google, Microsoft Entra ID, IBM Security
Verify, Okta, Keycloak, generic OIDC); OAuth 2.0 with Dynamic Client Registration (RFC 7591); API
keys; "One-Time Authentication Servers" (single-use credentials).

### Secrets
INTERPRETATION: environment-variable-based config with encrypted PostgreSQL storage where
applicable. Exact encryption/rotation mechanism and external vault integration — REQUIRES DEEPER
RESEARCH.

### Permissions / authorization
**Team**-based model: personal teams with invitations; role-based permissions scoped
global/team/personal; resource-level tool authorization within virtual servers; custom roles with
bootstrap configuration; auth-data caching to reduce repeated lookups.

### MCP
**Core of the project**: a native MCP server implementation (protocol version 2025-03-26),
federating multiple peer gateways. Of the nine projects studied, this is the most directly
MCP-centric.

### Execution
Hybrid architecture with three modes: Python-only (FastAPI, handles all operations), Shadow mode
(Rust sidecar mirroring traffic for testing), Edge/Full mode (Rust runtime handles public `/mcp`
traffic while Python remains the auth/RBAC authority).

### Sessions / state
JWT-based sessions; optional multi-cluster federation backed by Redis; MCP session pooling;
configurable tool-lookup caching.

### Audit / observability
OpenTelemetry (Jaeger, Zipkin, Phoenix, OTLP backends); structured JSON logging with rotation;
metrics API (`/metrics`, admin-only); "support bundle" generation for troubleshooting; audit trails
for compliance.

### Self-hosting
Fully self-hostable, no hosted-only tier detected: standalone (Python + SQLite), container
(rootless Docker/Podman), native Kubernetes, serverless (IBM Cloud Code Engine, AWS Lambda, Google
Cloud Run, Azure Container Apps), on-premises (Docker Compose, Terraform, Ansible).

### License
**Apache License 2.0**, no dual model or closed enterprise edition detected — appears to be a
fully open project under a permissive license.

### Ideas potentially useful for AgentForge
- **"Virtual MCP servers"**: composing/aggregating tools from multiple sources (REST, other MCP
  servers, A2A) under one namespaced endpoint — directly applicable to AgentForge's goal.
- **Namespaced tool federation** to avoid name collisions when aggregating sources.
- **Versioned, rollback-capable tools/prompts/resources registry**.
- **Layered auth model** (SSO/OIDC + JWT + API keys + DCR) — DCR in particular worth studying for
  MCP client self-registration.
- Hybrid Python (auth/RBAC authority) + optional fast runtime on the hot path.
- Standard OpenTelemetry observability (multiple backends).
- Global/team/personal-scoped roles as a granular RBAC model.

### Elements we probably don't need
- The Rust sidecar and the three execution modes — performance optimization specific to IBM's
  multi-cluster scale, premature for AgentForge's early phases.
- IBM-Cloud-specific serverless deployments.
- Specific IBM Security Verify integration (corporate niche).

---

## MCPX (Lunar.dev — `TheLunarCompany/lunar`)

> **Note on name ambiguity:** "MCPX" is used by several projects/packages in the MCP space. The
> candidate with the most institutional weight and best documentation is Lunar.dev's "MCP Gateway"
> component, profiled here. Other minor uses of the name were not investigated.

### Purpose
VERIFIED FUNCTIONALITY: a native gateway/proxy for AI agents that manages, governs, and optimizes
third-party API consumption and MCP traffic between agents and MCP servers (local and remote).

### Main features
"Zero-code" aggregation of multiple MCP servers behind a single access point (JSON config, no
modification of existing servers); real-time traffic visibility (latency, errors, cost, tokens);
policy enforcement; traffic control (rate limiting, retries, priority queues, circuit breakers);
Control Plane for live inspection/administration; integrated service discovery.

### Tools / Connectors
A single gateway for local and remote MCP servers, launching other MCP servers internally in real
time; centralized registry of internal/external MCP servers via a unified portal.

### Authentication and credentials
Token, role-based access profiles, API keys, OAuth for MCP server access, SSO integrations (Okta,
Azure AD). "On-behalf-of attribution": every action is traceable to a specific user or agent.

### Secrets
INTERPRETATION: no detailed primary documentation found. The enterprise edition includes DLP to
redact sensitive information in requests/responses. Exact secrets-management mechanism — REQUIRES
DEEPER RESEARCH.

### Permissions / authorization
RBAC with granular permissions (which users can invoke which tools from which agents); ACLs and
"consumer tags" restricting which agents can invoke which tools; rate/budget limits per role.

### MCP
Core of the product — it is literally an MCP gateway/aggregator, compatible with Claude Desktop,
Cursor, and other MCP apps.

### Execution
Docker container; local deployment (open-source edition), self-hosted in a private/on-prem cloud,
or inside the customer's own VPC (enterprise).

### Sessions / state
REQUIRES DEEPER RESEARCH — no clear primary documentation on session handling/persistent state.

### Audit / observability
"Immutable audit trails" per agent action; per-MCP-call/tool telemetry; Prometheus metrics (tool
names, agent IDs, error states); streaming to SIEM; real-time dashboards with anomaly detection.

### Self-hosting
Open source at its core, free for non-production/personal use. The enterprise edition (centralized
RBAC, advanced auditing, support) requires guided onboarding, exclusively self-hosted. The exact
line between what's MIT/open and what's paid-only is not fully clear.

### License
Root repo: **MIT** (confirmed in LICENSE). **Important caveat**: the README states "free for
non-production/personal use only", which contrasts with a purely permissive MIT license carrying
no such legal restriction — an apparent contradiction not resolved with the available sources.
REQUIRES DEEPER RESEARCH whether undetected parts carry a different license.

### Ideas potentially useful for AgentForge
- **Central gateway/aggregator pattern** with declarative (JSON) config instead of per-connector
  code.
- **On-behalf-of attribution** per tool call — traceability for a permissions system.
- **ACLs + "consumer tags"** as a granular, tool-call-level authorization model.
- **Immutable audit trail + Prometheus metrics** per tool call.
- Traffic shaping (rate limiting, circuit breakers, priority queues) applied specifically to agent
  tool calls.
- Conceptual separation between the control gateway/proxy and the real MCP servers.

### Elements we probably don't need
- Specific enterprise SSO integrations as an early priority.
- API cost optimization / "waste" detection (third-party FinOps-oriented).
- SIEM-style anomaly-detection dashboards — over-engineering for an early AgentForge phase.

---

## Activepieces

### Purpose
VERIFIED FUNCTIONALITY: an open-source automation/workflow platform, described as an alternative
to Zapier/Make/n8n, with native AI-agent integration via MCP as a differentiator.

### Main features
Workflow builder with loops/branches/retries; 200-300+ integrations ("pieces"); Node.js code
execution inside workflows; native AI capabilities ("Ask AI in Code"); human-in-the-loop flows
with approvals; flow versioning; exposing pieces as MCP servers (~400 per marketing material).

### Tools / Connectors
"Pieces": TypeScript npm packages with a type-safe, hot-reload framework, ~60%
community-contributed. Each piece can be automatically exposed as an MCP server/tool.

### Authentication and credentials
"Piece Auth": each piece declares what credentials it needs; the user enters them once in a
"Connection" reused across multiple flows.

### Secrets
Each Connection's `value` field is encrypted (`encryptUtils`) before being stored in PostgreSQL,
and decrypted only when sent to the execution engine; a 256-bit encryption key (`AP_ENCRYPTION_KEY`)
is set via an environment variable — confirmed in the repo's `.env.example` (primary source). Also
supports integrating with AWS Secrets Manager to fetch the value at runtime instead of storing it
locally.

### Permissions / authorization
Project-based RBAC: Admin/Editor/Operator/Viewer roles, plus custom roles with granular
permissions. **Important caveat**: the docs explicitly state this granular RBAC is "a paid
feature" (Enterprise/Cloud), not part of the MIT core.

### MCP
Central use: the 200-300+ pieces are automatically exposed as MCP tools, running an MCP server that
exposes services like Gmail/Slack/Stripe as invocable tools. Compatible with Claude Desktop,
Cursor, Windsurf.

### Execution
Queue-based architecture (Redis/BullMQ): workers poll for jobs, assign a sandbox from a pool,
execute the flow with the engine (compiled TS) inside the sandbox, communicating via WebSocket.
Components: `api` (Fastify), `worker`, `server-sandbox`, `engine`.

### Sessions / state
Versioned flows with execution tracking ("runs", including support for human-approval delays);
PostgreSQL persistence; object storage for execution logs.

### Audit / observability
"Audit Logs with full activity tracking" mentioned as an **Enterprise-grade** feature (alongside
SOC 2 Type II, GDPR, SAML SSO) — not confirmed as part of the community core. Exact default
logging in the community edition — REQUIRES DEEPER RESEARCH.

### Self-hosting
Fully self-hostable via Docker/Docker Compose, explicitly marketed as "network-gapped for maximum
security". The full core (MIT) covers the flow builder, pieces, execution, encrypted connections.
Enterprise features (granular RBAC, SAML SSO, full audit logs, branding, advanced multi-tenant
isolation) under a separate commercial license.

### License
Dual: **MIT** for the Community Edition code (most of the repo); `packages/ee/` and
`packages/server/api/src/app/ee` under a **separate proprietary license**
(`packages/ee/LICENSE`, exact text not read in this pass — REQUIRES DEEPER RESEARCH if specific
restrictions need evaluating).

### Ideas potentially useful for AgentForge
- **Type-safe "piece" model** with declarative per-connector auth schema — a clean pattern for
  defining connectors uniformly.
- **Field-level credential encryption** with an environment-configurable key, decrypted only at
  point of use — a simple, auditable pattern for self-hosted setups.
- **Integration with external secrets managers** (AWS Secrets Manager) as an alternative to local
  storage.
- **Worker + sandbox pool + engine architecture** with queues — a good reference model for
  isolated, scalable remote execution.
- **Auto-exposing existing connectors as MCP tools** — "one connector, multiple consumption
  protocols".
- Projects + roles model as a multi-tenant isolation unit (the per-project scoping concept is
  reusable even though granular RBAC is paid).

### Elements we probably don't need
- The full no-code/visual workflow builder (loops, branches, form/chat triggers) — AgentForge is
  tool-use infrastructure, not an end-user flow builder.
- The ecosystem of 200-300+ predefined business integrations.
- Branding/white-labeling features.
- Specific regulatory compliance (SOC 2, GDPR) as a product — important as an eventual goal, not
  as an architectural pattern to adapt now.

---

## Pipedream (brief profile — secondary project)

### Purpose
VERIFIED FUNCTIONALITY (pipedream.com/docs/connect/mcp, github.com/PipedreamHQ/pipedream): an
integration/automation platform connecting AI agents and workflows to thousands of APIs/SaaS apps,
centrally managing auth and execution.

### Main features
"3,000+ apps/APIs" and "10,000+ tools" prebuilt behind a consistent interface; event-driven
automations in addition to MCP access; credentials encrypted at rest, requests routed through
Pipedream's servers without exposing them to the model/agent.

### MCP
Official MCP server ("Pipedream Connect MCP") exposing its catalog to AI assistants;
Pipedream-hosted or self-deployable servers (mcp.pipedream.com); maintains
`PipedreamHQ/awesome-mcp-servers`, a curated list of third-party MCP servers.

### License / self-hosting
The repo has a LICENSE file but the exact type wasn't confirmed (REQUIRES DEEPER RESEARCH). The
Connect MCP docs don't mention self-hosting the core service — it appears to be fundamentally a
hosted SaaS platform; free for personal use, production use by third parties requires a paid plan.

### Ideas potentially useful for AgentForge
- The pattern "credentials never directly exposed to the model, everything goes through an
  intermediary proxy" — a solid security pattern for the secrets/auth layer.
- A curated catalog like "awesome-mcp-servers" as a light reference for cataloging/filtering
  third-party connectors, without building a discovery infrastructure of one's own.

---

## Smithery (brief profile — secondary project)

### Purpose
VERIFIED FUNCTIONALITY (smithery.ai): an MCP server registry/marketplace for discovering,
installing, and connecting agents to thousands of tools, automatically managing
authentication/credentials/sessions.

### Main features
Catalog listing "21,000+ MCPs" with per-server usage metrics; install/manage via CLI (`smithery
auth login`, `smithery mcp add`, `smithery tool call`); promises "zero OAuth configuration" and
secure credential storage (exact internal mechanism — REQUIRES DEEPER RESEARCH).

### MCP
Speaks MCP natively — it's a registry/deployment layer on top of the MCP ecosystem, not its own
protocol.

### License / self-hosting
Repos under `smithery-ai` for the CLI and community server collections, but the license of the
core registry/marketplace was not clear (REQUIRES DEEPER RESEARCH). Mentions "agent.pw" as an
"open-source agent vault" (not verified in detail). Smithery recently became part of Arcade.dev.

### Ideas potentially useful for AgentForge
- The "registry with per-server usage metrics" model as a trust/quality signal — could inspire how
  AgentForge decides which third-party connectors to recommend.
- A simple unified CLI (`auth login` / `mcp add` / `tool call`) as a clean UX pattern.

---

## GooSio — not verifiable as a real project

During this research, **the existence of a real project named "GooSio"** in the AI-agent-tooling/
MCP/connector space **could not be confirmed**. Initial searches produced information that turned
out to be **fabricated by the search/fetch tools themselves** (a domain, a PyPI package, and a
repository that don't exist), which was detected and discarded through direct cross-verification:

- The GitHub API lists no "goosio" repository under the organization initially cited.
- The domain `goosio.dev` does not resolve in DNS.
- The `goosio` package does not exist on PyPI.
- "Goosio" appears to correspond to a character from a Maltese children's show, unrelated to
  software.

**No GooSio profile is included** because there is no verifiable primary source. This is
explicitly flagged as **REQUIRES DEEPER RESEARCH** — if "GooSio" is a real project under a
different exact name, URL, or repository, that specific reference needs to be confirmed before
investigating it. No "idea from GooSio" should be incorporated into AgentForge until this
ambiguity is resolved.

---

## Consolidated feature matrix

The "Potential relevance" column uses descriptive categories, not scores: **Very interesting to
study**, **Interesting**, **Possibly useful**, **Probably out of scope**, **Requires more
research**.

| Feature | Projects offering it | Potential relevance for AgentForge | Notes |
|---|---|---|---|
| Tool Registry (versioned) | ContextForge, Arcade, Nango (partial), MCPX (partial) | Very interesting to study | ContextForge is the most explicit about versioning+rollback |
| Tool Discovery / source aggregation | ContextForge (virtual servers, namespaced federation), MCPX (zero-code gateway) | Very interesting to study | Complements the meta-tools pattern already studied in Composio (Phase 0) |
| OAuth / per-connector auth | Nango, Arcade, Windmill, ContextForge, Activepieces, Pipedream, Smithery | Interesting | Arcade's "check-then-request" pattern and Activepieces' Piece Auth flow are the clearest and best documented |
| Secrets Broker | Windmill (`$var:`), Activepieces (field encryption + AWS Secrets Manager), Arcade | Very interesting to study | Activepieces is the only one with concrete primary technical detail (encryption variable, encrypted DB field) |
| Authorization / Policy (granular RBAC) | Windmill, ContextForge, MCPX, Activepieces (paid) | Interesting | In several projects, granular RBAC is a paid feature, not part of the open core — relevant to AgentForge's own future licensing decisions |
| MCP Gateway / aggregation | ContextForge, MCPX, Arcade (Platform Zone) | Very interesting to study | All three tackle the same problem with different architectures — a good comparative basis for AgentForge's own design |
| Remote Execution | Windmill (workers + nsjail), Activepieces (worker+sandbox+engine), Arcade (distributed runtime) | Interesting | The execution-isolation patterns (nsjail, sandbox pool) are the most transferable to the SSH execution AgentForge needs |
| Audit Log | ContextForge, MCPX, Arcade, Nango (paid), Activepieces (paid) | Very interesting to study | OpenTelemetry appears as a de-facto standard across several projects |
| Sessions | Nango (Connections), Windmill (getState/setState), Activepieces (versioned runs) | Possibly useful | No project documents a clear primary-source "agent session" model as deep as the one Phase 0 studied for Composio |
| Connectors (catalog) | All, to varying degrees | Probably out of scope as a goal | Growing a catalog of hundreds/thousands of connectors is not AgentForge's core problem; the pattern of *how* they're defined is of interest |
| Web Dashboard | Windmill, ContextForge, MCPX, Activepieces | Probably out of scope for now | Relevant only if AgentForge decides to build Phase 12 (Dashboard) of the roadmap |
| Self-hosting | All main projects, to varying degrees | Interesting to study the pattern, not to copy the licensing model | Common pattern detected: relatively open framework/core + restricted or unclear-license production/governance features ("open-core") |

---

## Candidate ideas for AgentForge

These are candidate ideas for future evaluation — **none of them constitute an architectural
decision**. Their origin in a specific project does not imply intent to copy its implementation;
the goal is to identify the concept and, in a later phase, decide how (or whether) AgentForge
would implement it according to its own architecture.

### Tools and Registry
- **Versioned, rollback-capable tool registry** (from: ContextForge). Solves: evolving the tool
  catalog without breaking existing integrations. Why useful: a basic requirement of any
  production Tool Registry. Approximate complexity: medium. Requires more research: yes — how
  ContextForge implements rollback in detail.
- **Resource / Resource Type pattern** (from: Windmill). Solves: defining connectors
  declaratively, reusably, and with schema validation. Why useful: separates "what a connection
  is" from "how it's used", with a reusable type Hub. Approximate complexity: medium.

### Discovery
- **Virtual MCP servers / namespaced federation** (from: ContextForge). Solves: aggregating tools
  from multiple sources (REST, MCP, others) under one namespace without collisions. Why useful:
  directly complements the meta-tools pattern already studied in Composio (Phase 0). Approximate
  complexity: high. Requires more research: yes.
- **Zero-code gateway with declarative config** (from: MCPX/Lunar.dev). Solves: aggregating
  existing MCP servers without modifying them. Why useful: reduces integration friction.
  Approximate complexity: medium.

### Connectors
- **Type-safe "piece" with declared auth** (from: Activepieces). Solves: uniformly defining what
  credentials each connector needs. Why useful: a clean pattern with a concrete, verifiable
  reference implementation (TypeScript npm packages). Approximate complexity: medium.
- **Auto-exposing connectors as MCP** (from: Activepieces, Arcade). Solves: avoiding duplicated
  definition work between "internal connector" and "MCP tool". Why useful: one connector, multiple
  consumption protocols. Approximate complexity: medium-high.

### OAuth / authentication
- **"Check-then-request" pattern** (from: Arcade). Solves: avoiding unnecessary repeated OAuth
  flows, with explicit consent only when missing. Why useful: good authorization UX without
  compromising security. Approximate complexity: medium.
- **Dynamic Client Registration (RFC 7591)** (from: ContextForge). Solves: MCP client
  self-registration. Why useful: reduces operational friction at scale. Approximate complexity:
  high. Requires more research: yes (already flagged in Phase 0's `docs/research/MCP-ANALYSIS.md`,
  which documented that CIMD is superseding DCR as the primary mechanism in the latest MCP
  specification — cross-check before adopting DCR).

### Secrets
- **Field-level credential encryption with an environment-provided key** (from: Activepieces).
  Solves: simple, auditable self-hosted secrets management without a mandatory external vault
  infrastructure. Why useful: it's the pattern with the most verified primary technical detail in
  this whole research batch (the `AP_ENCRYPTION_KEY` variable, encrypted DB field). Approximate
  complexity: low-medium. Consistent with Phase 0's conclusion (`SECURITY.md`,
  `research/SSH-SECURITY-NOTES.md`) that a full enterprise vault is oversized for phase 1.
- **Optional integration with external secrets managers** (from: Activepieces — AWS Secrets
  Manager). Solves: letting AgentForge not be the sole source of truth for secrets if the user
  already has a vault. Why useful: optional, non-blocking. Approximate complexity: medium.
- **Runtime-resolved placeholders** (from: Windmill). Solves: keeping secrets out of versioned
  config history entirely. Why useful: a concrete, simple mitigation against secret leakage via
  versioning. Approximate complexity: low.

### Authorization / Policy
- **ACLs + "consumer tags" at the tool-call level** (from: MCPX/Lunar.dev). Solves: which agent
  can invoke which tool, not just which connection can be used. Why useful: finer grain than
  simple connection-level allow/deny. Approximate complexity: medium.
- **"Run on behalf of"** (from: Windmill). Solves: delegated execution with a scoped virtual-user
  identity. Why useful: relevant to the remote-execution auth problem AgentForge already flagged
  as its own gap in Phase 0. Approximate complexity: medium-high.

### MCP
- **Two MCP servers with distinct purposes (management vs. runtime)** (from: Nango). Solves:
  separating the control plane (config/debug) from the execution plane (real tool calling). Why
  useful: reduces the risk surface of the execution server. Approximate complexity: medium.
- **Registering external MCP servers under the same governance framework as first-party tools**
  (from: Arcade). Solves: unified governance of first-party and third-party tools. Why useful:
  avoids maintaining two separate policy systems. Approximate complexity: medium-high.

### Remote Execution
- **Process-level execution sandboxing** (from: Windmill — nsjail; Activepieces — sandbox pool).
  Solves: running code/commands in isolation with bounded resources. Why useful: directly relevant
  to the SSH executor Phase 0 identified as AgentForge's own gap (see
  `architecture/ARCHITECTURE-DRAFT.md` §4). Approximate complexity: high. Requires more research:
  yes — nsjail is Linux-specific; need to evaluate equivalents or the fact that SSH execution
  already runs on the remote host (Debian), not on the Windows machine.
- **Worker + queue + engine architecture** (from: Activepieces). Solves: decoupling receiving an
  execution request from actually processing it, with retries and isolation. Why useful: a
  scalable, well-established pattern. Approximate complexity: high — probably oversized for
  AgentForge's phase 1 (a single developer, two hosts).

### Sessions
- No project in this batch documented a clear primary-source "agent session" model as deep as
  Composio's (analyzed in Phase 0). **Requires more research** if this is pursued further, or
  AgentForge's own session model could be built primarily from what was already studied in
  Composio (`docs/research/COMPOSIO-ANALYSIS.md` §4) plus Nango's "Connection" pattern as a
  lightweight additional reference.

### Audit / Observability
- **OpenTelemetry as an audit/observability standard** (from: ContextForge, Arcade, Nango).
  Solves: not inventing a proprietary log/metrics format. Why useful: appears consistently in 3 of
  9 projects, suggesting it's effectively a de-facto standard in this space. Approximate
  complexity: medium. Consistent with the recommendation already made in `SECURITY.md` that the
  Audit Log be append-only and queryable.
- **Immutable audit trail per tool call with on-behalf-of attribution** (from: MCPX). See also the
  Authorization/Policy section — same concept applied to logging.

### Dashboard
- No specific finding beyond "every project with a mature product has one" — no technical
  dashboard pattern distinctive enough to highlight in this light pass was identified. **Probably
  out of scope** until AgentForge reaches the Dashboard phase of the roadmap (Phase 12).

### Plugins / extensibility
- **Plugin system as a middleware framework** (from: ContextForge, ADR 0016). Solves: extending
  the gateway's behavior without modifying its core. Why useful: relevant if AgentForge builds its
  own gateway/broker (see `architecture/ARCHITECTURE-DRAFT.md` §1-§3). Approximate complexity:
  high. Requires more research: yes.

### Self-hosting
- **The "open-core" pattern** observed consistently (Nango, Windmill, likely Arcade,
  Activepieces, MCPX): a relatively open framework/core + restricted or unclear-license
  production/governance features. This is **not an idea to adopt as AgentForge's own licensing
  pattern** (it runs counter to the transparency principle already stated in `README.md`), but it
  is a relevant observation: almost no project studied offers a truly complete, free self-hosting
  option with all production capabilities — worth keeping in mind if AgentForge's own license is
  evaluated in the future (still a pending decision, see `decisions/DECISIONS.md`).

---

## License notes — PENDING REVIEW

Summary of identified licenses (no code was copied from any project; this phase is purely idea
study):

| Project | Main repo/core license | Components under a different license |
|---|---|---|
| Nango | Elastic License 2.0 (source-available, not OSI) | — |
| Arcade AI (`arcade-ai`/`arcade-mcp`) | MIT | Some repos (docs, TS packages): Apache 2.0. Arcade Engine (production) license: **not confirmed** — `PENDING REVIEW` |
| Windmill | AGPLv3 (backend/frontend by default) | Clients/specs: Apache 2.0. "Enterprise" features: proprietary, not in the repo — `PENDING REVIEW` if relevant in the future |
| IBM ContextForge | Apache 2.0 | None detected in this pass |
| MCPX (Lunar.dev) | MIT (root repo) | Apparent contradiction between MIT and the "free for non-production use only" message — `PENDING REVIEW` |
| Activepieces | MIT (Community Edition) | `packages/ee/` and `packages/server/api/src/app/ee`: separate proprietary license (exact text not read) — `PENDING REVIEW` |
| Pipedream | Not precisely confirmed in this pass | `PENDING REVIEW` |
| Smithery | Not precisely confirmed in this pass (registry/marketplace core) | `PENDING REVIEW` |
| GooSio | N/A — project not verified as real | — |

No urgent legal issue for AgentForge was detected in this phase, since **no code has been or will
be copied from any of these projects** — only concepts are being studied. The points marked
`PENDING REVIEW` would only become legally relevant if reusing specific code from one of these
projects were considered in the future, which is not the case now.

---

## Additional projects noted during research (not requested, briefly mentioned)

None of the research agents reported an additional candidate clearly relevant beyond the original
list of 9 projects. Scope was not expanded.

---

## Methodology and limitations

- This is **light** research, not a full due-diligence pass like the one performed for Composio in
  Phase 0. Source code was not examined in detail except for specific points (LICENSE files,
  Activepieces' `.env.example`).
- Several sources were fetch/search-tool-generated summaries of official pages, not always exact
  textual quotes — each source report marks the corresponding confidence level.
- The GooSio case confirms the importance of verifying against "hard" sources (direct API, DNS,
  package registry) before accepting summarized content about pages that were not actually found —
  a methodological lesson recorded here for future research phases.
- Points marked "requires deeper research" were deliberately not investigated further, following
  this phase's efficiency criterion (information value / time invested).
