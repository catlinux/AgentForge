# ARCHITECTURE.md — AgentForge (Phase 1)

**Status: Phase 1 architectural baseline.** This document functionally supersedes
`architecture/ARCHITECTURE-DRAFT.md` (Phase 0, Catalan) as the working reference, without deleting
it — the draft is kept as a historical record of the initial Phase 0 proposals. This document
captures the decisions already approved (DEC-003 through DEC-006, see `decisions/DECISIONS.md`)
and builds a more concrete architecture on top of them, explicitly marking what remains a proposal
and what remains an open question.

**Date:** 2026-09-16. **Language:** English — see `ARCHITECTURE.md` (Spanish) for the primary
version; this is its equivalent, not a divergent copy.

Classification used throughout: **FACT/VERIFIED** (a fact confirmed in prior research),
**DECISION** (explicitly approved by the user, referenced as `DEC-XXX`), **PROPOSAL** (a reasoned
proposal from this phase, not yet approved), **OPEN QUESTION** (a genuinely open question
requiring a user decision, likely in a later phase).

> **AgentForge is an independent project.** Nowhere in this document is it described as an
> alternative, replacement, fork, or evolution of Composio or of any other project studied in
> `docs/research/` or `docs/en/research/RELATED-PROJECTS.md`. Ideas from those projects are cited
> as occasional inspiration, never as a template to copy.

---

## 1. General architecture

**DECISION (DEC-003):** AgentForge connects to Claude Code as an **in-place extension**, via
hooks (`PreToolUse`/`PostToolUse`) and/or its own MCP servers — never as a separate agent runtime,
nor by wrapping the CLI as a subprocess.

This fixes the overall shape of the system:

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code (agent, reasoning — UNTRUSTED component)            │
│  Already solves: MCP client, local permissions, hooks,           │
│  subagents, skills, local Bash sandboxing, own credentials.      │
│  (see docs/research/CLAUDE-CODE-ANALYSIS.md §10)                 │
└───────────────┬───────────────────────────┬─────────────────────┘
                │ HTTP hooks                │ MCP (stdio/HTTP)
                │ (PreToolUse/PostToolUse)  │
                ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  AGENTFORGE                                                      │
│                                                                   │
│  ┌───────────────┐   ┌───────────────┐   ┌────────────────────┐ │
│  │ Policy Hook    │   │ MCP Server(s) │   │ Tool Registry      │ │
│  │ Service        │   │ (ssh, others) │◄──┤ (catalog + schema) │ │
│  │ (cross-cutting)│   │               │   └────────────────────┘ │
│  └───────┬────────┘   └───────┬───────┘                          │
│          │                    │                                  │
│          └─────────┬──────────┘                                  │
│                     ▼                                             │
│          ┌─────────────────────┐                                 │
│          │ Permission / Policy │                                 │
│          │ Engine (own)        │                                 │
│          └──────────┬──────────┘                                 │
│                     ▼                                             │
│          ┌─────────────────────┐        ┌─────────────────────┐ │
│          │ Execution Backends  │◄──IPC──┤ Secrets Broker       │ │
│          │ (SSH executor, etc.)│  local  │ (SEPARATE process,   │ │
│          └──────────┬──────────┘        │  own OS user —       │ │
│                     │                    │  DEC-004)            │ │
│                     │                    └─────────────────────┘ │
│                     ▼                                             │
│          ┌─────────────────────┐                                 │
│          │ Audit Log           │ (append-only, outside the        │
│          │                     │  agent's own write access)       │
│          └─────────────────────┘                                 │
└───────────────┬────────────────────────────────────────────────┘
                │ SSH (per-host dedicated keys — DEC-006)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Remote systems: home Debian server, Contabo VPS                 │
│  (Phase 0: FORBIDDEN to touch. Phase 1: design only.)            │
└─────────────────────────────────────────────────────────────────┘
```

**PROPOSAL:** two entry points from Claude Code, with distinct responsibilities (see §3 of
`architecture/ARCHITECTURE-DRAFT.md`, already proposed in Phase 0, kept here):
- AgentForge's **own MCP servers** expose *new capabilities* (concrete SSH tools, connectors) —
  Claude Code already speaks MCP natively, so this reuses all the existing
  transport/auth/approval infrastructure without duplicating it.
- **HTTP hooks** (`PreToolUse`/`PostToolUse`) apply *cross-cutting policy* (auditing, blocking,
  risk classification) to any tool, including third-party MCP tools the user adds — not just
  AgentForge's own.

**OPEN QUESTION:** whether both mechanisms are needed from day one, or whether it's possible to
start with only AgentForge's own MCP servers and add cross-cutting hooks later once there are
multiple tool sources to govern. **Proposed:** start with **MCP only** in Phase 2 (simpler, covers
the initial SSH-execution use case) and add cross-cutting hooks once there's more than one tool
source to govern — but this is a sequencing PROPOSAL, not a final architecture decision.

---

## 2. Main components and responsibilities

| Component | Responsibility | Status |
|---|---|---|
| **Tool Registry** | Catalog of available tools (local + remote) with schema, version, and metadata. Source of truth for "what exists". | PROPOSAL |
| **Tool Discovery** | Mechanism for an agent to find/select relevant tools without loading the whole catalog into context. | PROPOSAL — see §5 |
| **Permission / Policy Engine** | Classifies actions by risk/reversibility and decides to auto-run, require an allowlist, or demand human confirmation. Only for what Claude Code doesn't already cover (actions going through the gateway). | PROPOSAL |
| **Secrets Broker** | Custodies credentials (SSH keys, tokens). Separate process, own OS user (DEC-004). Never exposes secrets directly to the agent. | DECISION (threat model) + PROPOSAL (implementation) |
| **Execution Backends** | Run real actions: SSH executor (phase 1), API connectors (future). Build commands in a parameterized way, never by interpolating LLM-generated strings. | PROPOSAL |
| **Audit Log** | Append-only record of every proposed/executed action, policy decision, and outcome. Outside the agent's write access. | PROPOSAL |
| **Own MCP Server(s)** | Expose AgentForge's capabilities to Claude Code (and any other compatible MCP client) following the `2026-07-28` specification (DEC-005). | DECISION (scope) + PROPOSAL (implementation) |
| **Policy Hook Service** | Receives `PreToolUse`/`PostToolUse` events from Claude Code, applies cross-cutting policy. | PROPOSAL, sequenced after own MCP (see §1) |

**PROPOSAL — what is NOT a separate component:** no full external policy engine (OPA-style) is
proposed, no standalone "Session Manager" service in phase 1, and no functional web dashboard.
See §16 for what's out of scope for this phase.

---

## 3. Trust boundaries

**FACT/VERIFIED** (already researched in Phase 0, `research/SSH-SECURITY-NOTES.md` §7, and
confirmed by DEC-004): the agent/LLM is a manipulable reasoning component (direct or indirect
prompt injection via tool output) and **must not be treated as trusted** for security decisions.

**PROPOSAL — concrete trust boundaries for AgentForge:**

```
Untrusted zone              Policy-enforcement zone              Credentials zone
┌─────────────────┐        ┌──────────────────────────┐        ┌──────────────────┐
│  Claude Code /   │  MCP/  │  AgentForge Core          │  local │  Secrets Broker   │
│  LLM agent       │─hooks─►│  (Tool Registry, Policy   │─ IPC──►│  (separate        │
│                  │        │   Engine, Execution        │        │   process, own    │
│  Never sees:     │        │   Backends, Audit Log)     │        │   OS user)        │
│  - SSH keys      │        │                            │        │                   │
│  - tokens        │        │  Never runs code the LLM   │        │  Only component   │
│                  │        │  built as a free-form      │        │  with direct      │
│                  │        │  string.                   │        │  access to        │
│                  │        │                            │        │  credentials.     │
└─────────────────┘        └──────────────────────────┘        └──────────────────┘
```

**PROPOSAL — concrete boundary rules:**
1. No data crossing from the untrusted zone into the policy zone is executed directly; it's
   validated against a schema (a specific tool's typed parameters), never as a free-form shell
   string.
2. The policy zone never has direct read access to credentials — it requests them from the
   Secrets Broker by reference (e.g. "use credential `ssh:home-debian`"), never by value.
3. The Secrets Broker only hands out a credential after validating that the request comes from an
   execution already approved by the Policy Engine — it does not serve direct requests from the
   agent.
4. The output of a remote execution (stdout/stderr) is treated as untrusted data when it crosses
   back to the agent — it is not granted implicit action authority (indirect prompt-injection
   mitigation, already documented in `research/SSH-SECURITY-NOTES.md` §6).

**OPEN QUESTION:** the exact IPC mechanism between AgentForge Core and the Secrets Broker (local
Unix socket/named pipe, loopback HTTP with token auth, etc.) — depends on the technology stack,
not yet chosen (see §17).

---

## 4. Flow between agent, AgentForge, tools, and remote systems

**PROPOSAL — flow for a remote-execution action (phase 1's main use case):**

1. Claude Code (the agent) decides to invoke a tool exposed by one of AgentForge's MCP servers
   (e.g. `docker_restart(service="apache", host="home-debian")`).
2. AgentForge's MCP server receives the call with parameters already validated against JSON
   Schema (MCP's own responsibility, not AgentForge's — see
   `docs/research/MCP-ANALYSIS.md` §3).
3. The Permission/Policy Engine classifies the action (read-only / reversible write / destructive,
   see `architecture/ARCHITECTURE-DRAFT.md` §4, kept as PROPOSAL) and decides: auto-run, require
   an allowlist, or block pending synchronous human confirmation.
4. If execution proceeds: the Execution Backend (SSH executor) requests the credential from the
   Secrets Broker by reference (`ssh:home-debian`), never by direct value.
5. The Secrets Broker validates that the request comes from an approved execution and hands the
   credential only to the Execution Backend, within its own process space.
6. The Execution Backend builds the SSH command in a parameterized way (never interpolating LLM
   text) and runs it against the corresponding remote host.
7. The result (stdout/stderr/exit code, each as a separate field) is recorded in the Audit Log and
   returned to the agent as data — not as new execution authority.
8. Any follow-up action the agent wants to take "because of" that result goes through step 3
   again — there is no automatic chaining of actions bypassing policy.

**OPEN QUESTION:** exactly how "synchronous human confirmation" in step 3 is represented in
practice within Claude Code — a confirmation prompt of AgentForge's own (outside Claude Code), or
does it rely on Claude Code's existing tool-approval mechanism
(`docs/research/CLAUDE-CODE-ANALYSIS.md` §1, §3)? **Preliminary PROPOSAL:** rely on Claude Code's
native approval mechanism where possible (less duplication), reserving an AgentForge-specific
mechanism only for cases needing richer confirmation than a simple allow/deny (e.g. showing the
exact diff of what will run remotely).

---

## 5. Tool Registry model

**DECISION (DEC-013 to DEC-017, Phase 3):** the Tool Registry's data model, storage, scope,
identity/versioning, and monorepo location are already decided — see `decisions/DECISIONS.md`.
Summary: AgentForge's own **MCP-compatible** (not MCP-native) data model in `packages/shared`,
with `identity`/`qualified name`/`schema fingerprint` as separate identity concepts and explicit
no-automatic-inheritance rules; storage as versioned declarative config + non-authoritative cache
(no database); static (configured origins) + dynamic (discovery) catalog, with the Registry
(catalogs) / Discovery (filters, §6) / Policy Engine (authorizes, §7) boundary strictly kept;
module in `packages/core/src/registry/`, no dedicated package. The rest of this section is kept as
the original Phase 1 context/inspiration, now superseded in detail by the Phase 3 decisions.

**PROPOSAL (historical context, Phase 1 — see DEC-013 to DEC-017 above for what is now decided):**

- The Tool Registry is the catalog of tools AgentForge exposes (via its own MCP servers), with:
  a unique identifier, input/output schema (JSON Schema, consistent with the format MCP uses —
  `docs/research/MCP-ANALYSIS.md` §3), a risk classification (read-only / reversible write /
  destructive — direct input to the Policy Engine), applicable host(s) (for remote-execution
  tools), and a version.
- Inspiration from Phase 0.7 research (`docs/en/research/RELATED-PROJECTS.md`, "Tools and
  Registry" section): Windmill's **Resource / Resource Type** pattern (JSON schema + reusable
  types) and IBM ContextForge's **versioned, rollback-capable** registry are valid conceptual
  references — no specific implementation is proposed to be copied.
- Unlike Composio (`docs/research/COMPOSIO-ANALYSIS.md` §2), AgentForge's Tool Registry does not
  need to model thousands of third-party integrations — its initial scope is a small, growing set
  of first-party remote-execution tools, plus whatever third-party MCP servers the user decides to
  add directly to Claude Code (which already manages its own catalog via `.mcp.json`, with no need
  for AgentForge to duplicate it).

~~**OPEN QUESTION:** the concrete definition format (YAML/JSON/TOML) and whether the registry
lives in git-versioned config files or in dedicated storage (a local database)~~ — **resolved in
Phase 3, see DEC-014.**

---

## 6. Tool Discovery

**DECISION (DEC-018 to DEC-022, Phase 4):** reduction strategy, declarative configuration, output
shape, `stale` handling, and monorepo location are already decided — see
`decisions/DECISIONS.md`. Summary: static filter by configuration (no usage/history or semantic
relevance yet, interface left open to add those later); own JSON configuration file, separate from
the Registry's origin config; output via a dedicated reduced projection (`DiscoveredToolView`),
never exposing internal `identity`/`schemaFingerprint` nor coupling directly to the MCP format;
automatic exclusion of `stale` entries (DEC-016); module in `packages/core/src/discovery/`, no
dedicated package. The rest of this section is kept as the original Phase 1 context/inspiration,
now superseded in detail by the Phase 4 decisions.

**PROPOSAL (historical context, Phase 1 — see DEC-018 to DEC-022 above for what is now decided):**

- For phase 1, with a small catalog (likely fewer than 20 initial tools: SSH execution + a few
  specific actions), the problem of "reducing the number of tools exposed to the LLM's context"
  that Composio's Tool Router solves (`docs/research/COMPOSIO-ANALYSIS.md` §3) **is not yet a real
  problem for AgentForge**. It is proposed **not to implement dynamic discovery in phase 1** —
  expose the full catalog directly via standard MCP (`tools/list`), letting Claude Code handle
  selection as it does for any other MCP server.
- If the catalog grows significantly in future phases, the **meta-tools** pattern (a search tool
  like `COMPOSIO_SEARCH_TOOLS` instead of exposing the whole catalog directly) is the most
  promising idea identified across all the research — both from Composio and from IBM
  ContextForge's namespaced federation (`docs/en/research/RELATED-PROJECTS.md`, "Discovery"
  section). This is explicitly left as **future work, not phase 1**.

~~**OPEN QUESTION:** none blocking for phase 1~~ — **resolved in Phase 4, see DEC-018 to
DEC-022.** The meta-tools/search pattern remains future work outside this phase.

---

## 7. Permissions and Policy Engine

**DECISION (DEC-023 to DEC-029, Phase 5):** the origin and granularity of risk classification,
rule engine, result shape, schema-change invalidation, persistence, and configuration/location of
the Policy Engine are already decided — see `decisions/DECISIONS.md`. Summary: a three-tier risk
classification (`read-only`/`reversible-write`/`destructive`) declared explicitly by the user in
the Policy Engine's **own configuration**, indexed by `identity` — **important correction to the
original PROPOSAL below:** the classification does NOT live in the Tool Registry or in
`ToolEntry` (that would have required modifying the model approved in DEC-013/DEC-016); it lives
in a dedicated Policy Engine file, never inferred nor self-declared by the origin MCP server
(DEC-023). Constant per `identity`, using the reasonable worst case when a tool's impact varies by
argument — modulating risk by argument is out of scope for this phase (DEC-023b). A rule engine
derived from risk with simple `allow`/`deny` overrides per `identity`, no expressive rule language
(DEC-024, resolves the OPEN QUESTION below). A ternary result with a structured reason (DEC-025).
Automatic invalidation of approval on `schemaFingerprint` change, no compatibility heuristic
(DEC-026). No persistence/auditing of its own (DEC-027). Configuration in its own JSON file, in
`packages/core/src/policy/`, no dedicated package (DEC-028, DEC-029).

**PROPOSAL (historical context, Phase 1 — see DEC-023 to DEC-029 above for what is now decided,
including the correction on where risk classification lives):**

- Claude Code's local permission engine (`.claude/settings.json`, allow/ask/deny rules) is **not
  duplicated** — it remains the authority for the agent's local actions
  (`docs/research/CLAUDE-CODE-ANALYSIS.md` §3).
- AgentForge's Policy Engine applies **only** to actions passing through its own MCP servers or
  the Policy Hook Service — i.e., remote execution and any other capability AgentForge exposes.
- Three-tier classification (already proposed in `architecture/ARCHITECTURE-DRAFT.md` §4, kept):
  1. **Read-only** → auto-execute, logged, no confirmation.
  2. **Reversible write / low impact** → auto-execute only if on an explicit allowlist; otherwise
     requires confirmation.
  3. **Destructive / high impact** → synchronous human confirmation always, no exceptions, no
     "auto-approve after N successful runs".
- ~~Each tool's risk classification lives in the Tool Registry (§5)~~ — **corrected by DEC-023: it
  lives in the Policy Engine's own configuration, not in the Tool Registry or `ToolEntry`**,
  precisely to avoid modifying the model already approved in DEC-013/DEC-016.
- **FACT/VERIFIED, applied as a design principle:** enforcement of this policy lives in code the
  LLM cannot alter, never only as a prompt instruction — consistent with the distinction Anthropic
  itself draws between CLAUDE.md (guidance) and settings/hooks (hard enforcement)
  (`docs/research/CLAUDE-CODE-ANALYSIS.md` §2, §10).

~~**OPEN QUESTION:** whether the Policy Engine needs its own rule language (even a simple one) or
whether the three-tier classification + flat allowlists are enough for phase 1.~~ — **resolved in
Phase 5, see DEC-024**: no expressive rule language, risk-derived engine + simple per-`identity`
overrides.

---

## 8. Secrets management

**DECISION (DEC-004):** the Secrets Broker runs as a **separate process, with its own operating
system user and permissions** — it never shares process space or OS identity with the
agent/Claude Code.

**DECISION (DEC-030 to DEC-036, Phase 6):** storage, secret model, master key, API,
identity/access control, and authorization evidence are already decided — see
`decisions/DECISIONS.md`. Summary: **own encrypted file** (AES-256-GCM, not relying on Windows
Credential Manager or any OS credential store — corrects the PROPOSAL below, which assumed
Credential Manager without having evaluated its unavailability in headless Linux deployments);
`SecretRecord` model with 5 kinds; master key in a separate file with OS permissions, unattended
startup; minimal API `get`/`create`/`update`/`delete`/`exists`/`listMetadata`; own `SecretId`
with no self-declared binding from Core. **Explicitly documented security limitation (DEC-036):**
with the Policy Engine (§7) running in the same process as Core (DEC-029), it cannot act as an
independent authority against a compromised Core — the Secrets Broker protects storage and
prevents direct access to secrets outside its own process, but it cannot prevent a compromised
Core from obtaining secrets through the legitimate authorization flow already available to it.
Closing that gap for real would require separating Policy Engine from Core into another process —
a larger decision, not made here, a candidate for a future hardening phase (Phase 13).

**PROPOSAL (historical context, Phase 1 — see DEC-030 to DEC-036 above for what is now decided,
including the correction on the storage mechanism):**

- **SSH key and passphrase storage:** Windows Credential Manager, accessed only by the Secrets
  Broker process (not by the process hosting the agent, nor directly by the Execution Backend) —
  already proposed in `architecture/ARCHITECTURE-DRAFT.md` §5, now reinforced by DEC-004: the fact
  that the Broker runs as a distinct OS user reduces (though doesn't fully eliminate) the risk of
  a compromised process in the agent's space reading the credential store directly.
- **Other credentials** (API tokens): SOPS+age or a similarly simple equivalent, also managed from
  the Secrets Broker process — see additional inspiration from Phase 0.7
  (`docs/en/research/RELATED-PROJECTS.md`, "Secrets" section): Activepieces' **field-level
  credential encryption with an environment-provided key** (`AP_ENCRYPTION_KEY`) pattern is the
  one with the most verified primary technical detail across all the research — a concrete
  candidate to adapt (not copy code) if a first-party storage layer is chosen instead of relying
  solely on Windows Credential Manager.
- **Request interface:** the rest of AgentForge never reads secrets directly — it asks the Secrets
  Broker to "use credential X for this already-approved operation", and the Broker injects the
  credential at execution time (Arcade's "check-then-request" pattern and "injected into the
  Context without exposing to the LLM", `docs/en/research/RELATED-PROJECTS.md`, "OAuth /
  authentication" section — applicable here even though AgentForge doesn't use OAuth for SSH).
- **Enterprise secrets manager/vault:** ruled out for phase 1 (already decided conceptually in
  Phase 0, confirmed by Phase 0.7 research: almost no project studied offers truly complete, free
  self-hosting of its secrets-management capabilities — an additional reason not to depend on a
  third-party tool of this kind).

~~**OPEN QUESTION:** exact IPC mechanism between AgentForge Core and the Secrets Broker (see
§3)~~ — **resolved in Phase 2 (DEC-010) and Phase 6 (DEC-030 to DEC-036).**

---

## 9. Remote execution / SSH

**DECISION (DEC-006):** dedicated ed25519 keys per host (home Debian server, Contabo VPS), no
agent forwarding, for phase 1.

**DECISION (DEC-037 to DEC-042, Phase 7):** command model, human confirmation, host
configuration, output limits, timeout, and Execution's location are already decided — see
`decisions/DECISIONS.md`. Summary: commands via a **fixed template per tool** (never arbitrary
shell, consistent with the hybrid allowlisted catalog sketched below); synchronous human
confirmation **owned by Execution itself**, bound to a deterministic hash
(identity+parameters+host+schemaFingerprint), single-use, with timeout and deny-by-default —
Claude Code hooks (`PreToolUse`) were explicitly ruled out after technical verification: they
offer no pause-and-resume with external state, nor any verifiable human-approval signal to
external processes; host configuration in its own JSON file; stdout/stderr with a size limit,
never logged in the clear; SSH connection timeout with forced close; Execution lives in
`packages/execution-ssh`, its own package (pattern already reserved by DEC-008). **Explicitly
documented limitation:** DEC-038's confirmation mechanism requires an operator with direct
interactive access to the Execution process — it does not cover deployments without an available
interactive session, where every `requires-confirmation` operation is denied by default.

**PROPOSAL (historical context, Phase 1 — see DEC-037 to DEC-042 above for what is now decided):**

- A hybrid tool catalog: a growing set of specific allowlisted tools (`apache_status()`,
  `docker_restart(service)`, `disk_usage()`...) for anticipated operations, plus a very restricted
  `execute_restricted()` fallback (`command=` in `authorized_keys`, `no-pty`,
  `no-port-forwarding`, `no-agent-forwarding`, a server-side validating wrapper with a
  sub-command allowlist) that **always** requires synchronous human confirmation.
- `known_hosts` pinned manually/out-of-band before any automated connection;
  `StrictHostKeyChecking yes` in steady state.
- Differentiated timeouts (connection vs. execution); always capturing stdout+stderr+exit code as
  separate fields; no automatic retries of non-idempotent operations.
- Additional inspiration from Phase 0.7: the **process-level execution sandboxing** pattern
  (nsjail in Windmill, sandbox pool in Activepieces — `docs/en/research/RELATED-PROJECTS.md`,
  "Remote Execution" section) is relevant but marked **out of scope for phase 1**: nsjail is
  Linux-specific and SSH execution already runs on the remote host (Debian), not on the Windows
  machine — real isolation should come from the remote host's own configuration (a dedicated
  system user, minimal permissions), not from AgentForge on the client side.

**OPEN QUESTION:** whether each remote host should have a dedicated, restricted system user for
AgentForge operations (instead of a more privileged account) — this decision affects the remote
servers themselves and therefore **cannot be implemented in this phase** (touching external
systems is forbidden), but should be planned for when Phase 7 (remote execution/SSH) of the
roadmap is authorized.

---

## 10. MCP integration

**DECISION (DEC-005):** **Modern-only** scope — AgentForge's own MCP servers/clients target
exclusively the `2026-07-28` specification.

**PROPOSAL built on this:**

- No central dependency is built on **sampling** or **roots** (both deprecated in the current
  specification — `docs/research/MCP-ANALYSIS.md` §3).
- The security mitigations documented in the specification (token passthrough, SSRF, confused
  deputy — `docs/research/MCP-ANALYSIS.md` §7) are applied from the initial design of any own MCP
  server, not bolted on afterward.
- AgentForge's own MCP servers are, in practice, the main surface through which Claude Code
  accesses the gateway's capabilities (see §1) — i.e., MCP is not "one more integration" but the
  primary transport mechanism between Claude Code and AgentForge.
- **Risk explicitly accepted by DEC-005:** possible lack of interoperability with third-party MCP
  servers that still speak the "Legacy" protocol version. This doesn't affect AgentForge's own
  servers (built from scratch on Modern), but would be relevant if AgentForge ever wanted to
  *federate* existing third-party MCP servers (IBM ContextForge's "virtual MCP servers" pattern,
  `docs/en/research/RELATED-PROJECTS.md`) — to be reviewed case by case, not now.

**OPEN QUESTION:** none blocking — DEC-005 closes this section's main question for phase 1.

---

## 11. Sessions and state

**PROPOSAL:**

- No project studied in Phase 0.7 documented, with clear primary-source detail, an "agent session"
  model as developed as Composio's (user identity + tool access + auth state + execution state in
  one addressable object — `docs/research/COMPOSIO-ANALYSIS.md` §4). It is proposed to take that
  model as a **conceptual reference** (not code) for AgentForge's future session design,
  lightly complemented by Nango's "Connection" concept (`docs/en/research/RELATED-PROJECTS.md`).
- For phase 1, given AgentForge has a single user (the developer themselves) and a small number of
  hosts, **no independent Session Manager component is proposed yet** — the relevant "session
  state" at this early stage is simply: which credentials are available for which host (managed by
  the Secrets Broker, §8) and the action history (managed by the Audit Log, §12). A richer session
  concept (multi-user, multiple concurrent agents) is left as explicit future work.

**OPEN QUESTION:** whether AgentForge will need to support multiple concurrent agents/users at
some point (relevant to deciding whether to design the richer session model already, even without
implementing it). **Preliminary PROPOSAL:** don't design for multi-user in phase 1 — the roadmap
(`ROADMAP.md`) already contemplates a dedicated Phase 9 — Sessions if it turns out to be needed.

---

## 12. Audit and observability

**PROPOSAL** (already sketched in Phase 0, refined with Phase 0.7 findings):

- Minimum fields per record: full resolved command, target host, tool/operation name, parameters
  supplied by the LLM, timestamp, duration, exit code, a reference to truncated/hashed output,
  whether confirmation was needed and how it was resolved (auto-approved / human-approved /
  denied).
- Append-only log, stored outside the agent's own write access.
- **Relevant Phase 0.7 finding:** OpenTelemetry appears as a de-facto standard in 3 of the 9
  projects studied (IBM ContextForge, Arcade, Nango — `docs/en/research/RELATED-PROJECTS.md`,
  "Audit / Observability" section). **PROPOSAL:** adopt OpenTelemetry as the instrumentation
  format instead of inventing a proprietary one, once event volume justifies it — for phase 1,
  with low volume, a simple structured log (JSON Lines to a file) is sufficient and more
  proportionate.
- MCPX/Lunar.dev's **"on-behalf-of" attribution** pattern (every action traceable to a specific
  user or agent, `docs/en/research/RELATED-PROJECTS.md`) is directly applicable even with a single
  human user: every audit entry should be able to distinguish between "the agent decided this
  autonomously" and "the human explicitly approved it" — relevant for forensic reconstruction in
  case of an incident.

**OPEN QUESTION:** exact format/storage (local JSON Lines file vs. SQLite vs. other) — depends on
the technology stack (§17). **Preliminary PROPOSAL:** start with an append-only JSON Lines file
(simple, no dependencies, easy to inspect manually), migrate to queryable storage (SQLite) if
volume or query needs justify it.

---

## 13. Storage / persistence

**PROPOSAL:**

- For phase 1, given the scope described above (small tool catalog, a single user, two remote
  hosts), **no database is proposed as an entry requirement**. The Tool Registry can live in
  versioned config files (§5); the Audit Log in append-only files (§12); minimal session state can
  be derived from the above without additional storage.
- If in later phases tool/host volume or audit history needs justify it, it is proposed to migrate
  to SQLite (embedded, no additional server infrastructure, consistent with `README.md`'s
  local-first principle) before a database engine with its own server.

**OPEN QUESTION:** none blocking for phase 1 — this decision can be postponed without conditioning
the rest of the architecture.

---

## 14. Internal/external API

**PROPOSAL:**

- **Internal API** (between AgentForge's own components — Core, Secrets Broker, Execution
  Backends): necessary because of DEC-004 itself (separate processes require some communication
  mechanism). See §3, §8 — exact mechanism still open, depends on the stack.
- **External API** (for MCP clients other than Claude Code, or third-party tools, to interact with
  AgentForge): **not proposed for phase 1**. The initial scope is to serve Claude Code exclusively
  via MCP; a broader first-party HTTP/REST API is left as explicit future work if AgentForge needs
  to support other clients.

**OPEN QUESTION:** none blocking for phase 1.

---

## 15. Dashboard / Web UI (at the architectural level)

**PROPOSAL:**

- The roadmap (`ROADMAP.md`) already contemplates a separate Phase 12 — Web Dashboard. This
  document does not design the dashboard in detail, but records one architectural constraint: **if
  a dashboard is built in the future, it must consume the same components Claude Code consumes**
  (Tool Registry, Audit Log, Policy Engine) through a well-defined interface — it must not become
  a second access path to credentials or execution that bypasses the Policy Engine or the Secrets
  Broker.
- Phase 0.7 research did not identify any technical dashboard pattern differentiated enough to
  highlight in this phase (`docs/en/research/RELATED-PROJECTS.md`, "Dashboard" section) — this is
  explicitly left as future-phase work.

**OPEN QUESTION:** none for phase 1 — this component is deliberately out of scope.

---

## 16. What AgentForge implements vs. what's left to Claude Code / MCP / existing components

Responsibility table, consolidating `docs/research/CLAUDE-CODE-ANALYSIS.md` §10 with this phase's
decisions:

| Responsibility | Who handles it | Reason |
|---|---|---|
| MCP client (transports, OAuth, scopes, tool approval) | **Claude Code** | Already mature and actively maintained — duplicating it would be pure risk with no benefit (DEC-003) |
| Project context loading (CLAUDE.md, rules, auto memory) | **Claude Code** | Fully solved, no gaps identified |
| Local permission engine (agent's local actions) | **Claude Code** | Granular and already proven; AgentForge doesn't touch it |
| Local Bash sandboxing | **Claude Code** | Real OS-level enforcement, not applicable to remote execution anyway |
| Subagents (multi-agent within one session) | **Claude Code** | Covers the "specialized agent with restricted tools" use case within a session |
| Skills / slash commands | **Claude Code** | Reusable-procedure mechanism already solved |
| Claude Code's own credential management | **Claude Code** | Its own API key, solved with a rotation hook (`apiKeyHelper`) |
| Controlled, audited remote (SSH) execution | **AgentForge** | Confirmed gap — Claude Code's Bash is local-only |
| Cross-project tool registry | **AgentForge** (Tool Registry) | Confirmed gap — MCP is configured per project/user in Claude Code, no central registry |
| Unified Secrets Broker across tools | **AgentForge** | Confirmed gap — Claude Code delegates to per-credential "shell-out" hooks, no unified vault |
| Centralized audit log across sessions/machines | **AgentForge** | Confirmed gap — Claude Code doesn't aggregate history across sessions |
| Policy Engine for remote actions | **AgentForge** | Confirmed gap — Claude Code's permission engine is local-only |
| Multi-agent/multi-machine orchestration | **Out of scope for now** | Confirmed gap but not prioritized in phase 1; revisit in future phases if needed |

---

## 17. Main technology dependencies

**DECISION (DEC-007):** **TypeScript/Node.js**, as the single stack for all of AgentForge (Core,
own MCP servers, and the Secrets Broker as a separate process in the same language). Full
alternatives analysis in `architecture/TECH-STACK-ANALYSIS.md` (Spanish; English translation
pending).

**Direct consequences of this decision:**
- The official TypeScript MCP SDK (Tier 1, confirmed mature —
  `docs/research/MCP-ANALYSIS.md` §8) as the foundation for AgentForge's own MCP servers (§10).
- The `ssh2` library for the SSH Execution Backend (§9) — avoids the timeout/exit-code
  limitations documented for Paramiko in `research/SSH-SECURITY-NOTES.md` §3.
- Windows Credential Manager access (§8) via a Node library (exact package to be confirmed in
  Phase 2) from the Secrets Broker process.
- The Secrets Broker is deployed as an independent Node process under a distinct Windows account
  (DEC-004), which requires Node to be available on that account's `PATH` — a small, non-blocking
  setup cost.

**OPEN QUESTION (deliberately deferred to Phase 2, to avoid over-deciding in this phase):** the
concrete HTTP framework within Node (Express/Fastify/other) for the Policy Hook Service (§1) if
ultimately implemented; the concrete Windows Credential Manager access package; packaging/
distribution details for the Secrets Broker as an independent process.

---

## 18. Security

See `SECURITY.md` for the general principles already documented in Phase 0.5. This document adds,
specific to Phase 1:

- **FACT/VERIFIED, applied as a design constraint:** decisions DEC-003 through DEC-006 are,
  together, AgentForge's architectural answer to the "the agent/LLM is an untrusted component"
  principle (`SECURITY.md`): in-place extension (Claude Code isn't given a new runtime with more
  attack surface), Secrets Broker in a separate process (real, not just logical, isolation), MCP
  Modern-only (applies the specification's latest security mitigations from the start), dedicated
  SSH keys per host (bounded blast radius per host).
- **OPEN QUESTION** already flagged in §3: IPC mechanism between Core and Secrets Broker — its
  choice has direct security implications (a Unix socket with restricted file permissions is
  simpler to reason about than a local HTTP port, for example) and should be decided together with
  the technology stack.

---

## 19. Extensibility and future internationalization (i18n)

**PROPOSAL:**

- The separated-component architecture (Tool Registry, Policy Engine, Secrets Broker, Execution
  Backends) allows adding new Execution Backends (API connectors, other protocols) without
  touching the Policy Engine or the Secrets Broker — this is, in part, the same separation-of-
  concerns principle observed in several Phase 0.7 projects (Auth/Proxy/Functions in Nango, Local
  Zone/Platform Zone in Arcade).
- **i18n:** following `README.md` (Spanish initial interface, architecture prepared for future
  i18n without implementing it yet), it is proposed that any human-facing text AgentForge
  generates in the future (confirmation messages, readable log entries, error messages) avoid
  hardcoding strings directly into business logic — without implementing a full i18n system in
  this phase, it's enough to not couple language to logic from the start (e.g., separating message
  keys from their text, even if the initial text catalog is Spanish-only).

**OPEN QUESTION:** none blocking — this section is guidance to avoid blocking future i18n, not an
implementation decision now.

---

## 20. Summary of decisions vs. proposals vs. open questions from this phase

### DECISIONS approved in this phase
- DEC-003 — Relationship with Claude Code: in-place extension.
- DEC-004 — Secrets Broker: separate process, own OS user.
- DEC-005 — MCP scope: Modern-only (`2026-07-28`).
- DEC-006 — Remote execution: dedicated SSH keys per host, no SSH CA in phase 1.
- DEC-007 — Technology stack: TypeScript/Node.js (see `architecture/TECH-STACK-ANALYSIS.md`).

### OPEN QUESTIONS remaining (not blocking closing Phase 1, to be resolved in later phases or
during implementation)
1. Exact sequencing: start with own MCP and add cross-cutting hooks later, or both from the
   start? (§1)
2. ~~Synchronous human confirmation mechanism: native to Claude Code or AgentForge's own
   interface?~~ — **resolved in Phase 7, see DEC-038**: Execution's own interface — Claude Code
   hooks were ruled out after explicit technical verification.
   (§4)
3. ~~Tool Registry definition format and where it lives (files vs. dedicated storage) (§5)~~ —
   **resolved in Phase 3, see DEC-013, DEC-014, DEC-017** (own MCP-compatible model in
   `packages/shared`; declarative config + non-authoritative cache; module in
   `packages/core/src/registry/`, no dedicated package).
4. ~~Policy Engine rule language: flat allowlists or something more expressive? (§7)~~ —
   **resolved in Phase 5, see DEC-023 to DEC-029.**
5. ~~Exact IPC mechanism between AgentForge Core and the Secrets Broker (§3, §8, §18)~~ —
   **resolved in Phase 2, see DEC-010** (Windows named pipe / Linux-macOS Unix domain socket,
   behind an agnostic transport interface in `packages/shared`).
6. Dedicated system user on each remote host (Debian, Contabo) — cannot be resolved without
   touching those systems, pending until Phase 7 is authorized (§9)
7. Audit Log format/storage (JSON Lines file vs. SQLite) (§12)
8. Future multi-user/multi-agent support (§11)
9. Concrete HTTP framework, Windows Credential Manager package, and Secrets Broker packaging
   within the now-decided TypeScript/Node.js stack (§17)
10. Project license (carried over from earlier phases, see `decisions/DECISIONS.md`)

None of these questions block considering Phase 1 complete as an *architectural baseline* — they
will continue to be resolved as concrete implementation approaches, following the project's
methodology (`.claude/CLAUDE.md`).
