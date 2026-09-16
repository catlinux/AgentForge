# AgentForge

**Project status: research complete, foundations in progress. No functional software has been
implemented yet.**

[Versión en español](README.md)

---

## What is AgentForge

AgentForge is a personal project aimed at building modular infrastructure that lets AI agents —
initially Claude Code — use tools, MCP, connectors, remote systems, APIs, authentication,
permissions, tool discovery, sessions, and automations in a controlled, extensible way, without a
mandatory dependency on any external provider.

The project takes ideas and architecture from Composio as one reference point, among others, but
**does not assume Composio should be copied**, nor that its architecture is necessarily the best
fit for this use case.

## What problem it aims to solve

Claude Code already solves a significant part of "giving an agent tools" very well: an MCP
client, local permissions, hooks, subagents, Bash sandboxing, and management of its own
credentials. Phase 0 research (see `docs/research/`) identified a concrete set of gaps that
Claude Code does **not** cover today:

- Controlled, audited, fine-grained-permission remote (SSH) execution.
- A tool/capability registry queryable across projects and machines.
- A unified secrets broker across multiple tools/MCP servers.
- A centralized audit log across sessions and machines.
- Orchestration of multiple sessions/machines beyond a single Claude Code process.

AgentForge aims to fill specifically these gaps — not to reimplement what Claude Code already
does well.

## Goals

- Leverage open-source ideas and code where the license allows it.
- Avoid unnecessary dependencies.
- Be local-first.
- Be modular and extensible.
- Be secure by design (the agent/LLM is treated as a potentially untrusted component).
- Be transparent: real control over tools and permissions, not just prompt-level guidance.
- Support local and remote tools, across multiple projects and servers.
- Allow integrating external MCP servers and creating custom ones.
- Be able to function without depending on Composio or any specific external service.
- Be able to use external services optionally when they add real value.

## What it does NOT aim to do (for now)

- It does not aim to be "a free Composio" or to clone its product.
- It does not aim to duplicate functionality Claude Code already handles well (MCP client, local
  permissions, hooks, subagents, Bash sandboxing, its own credential management).
- At this stage, it does not aim to have any functional implementation: no backend, no gateway,
  no custom MCP server, no SSH executor, no secrets broker, no dashboard.

## Current project status

| Area | Status |
|---|---|
| Technical research (Composio, MCP, Claude Code, VS Code, SSH, security) | **Completed** (Phase 0) |
| Project foundations, documentation, and governance | **In progress** (Phase 0.5) |
| Architecture decisions | **Pending** — the architecture document is a draft, not an approved decision |
| Software implementation | **Not started** |
| Git repository | Not initialized yet |
| Remote repository (GitHub or other) | Not decided — pending explicit user confirmation |

See `STATE.md` for the detailed, continuously updated project status.

## Current conceptual architecture (proposal, not approved)

```
Claude Code (agent, reasoning — treated as untrusted)
        │  (hooks / own MCP server(s))
        ▼
AgentForge — gateway/broker layer (PROPOSAL)
   ├── Tool Registry
   ├── Permission / Policy Layer
   ├── Secrets Broker
   ├── Audit Log
   └── Execution Backends (SSH, API connectors, own MCP servers)
        ▼
Local / remote systems (home Debian server, Contabo VPS, GitHub, Dropbox, external APIs)
```

This diagram represents the current research direction, **not a fully approved architecture**
(though it already includes 4 approved decisions — DEC-003 through DEC-006, see
`decisions/DECISIONS.md`). Full Phase 1 detail, with each piece justified and classified as
decision/proposal/open question, is in `architecture/ARCHITECTURE.en.md` (and its Spanish
equivalent `architecture/ARCHITECTURE.md`). The original Phase 0 document,
`architecture/ARCHITECTURE-DRAFT.md`, is kept as a historical reference.

## Core principles

1. The agent/LLM is a reasoning component that can potentially be manipulated (prompt injection)
   — it must never have direct access to credentials nor freely construct execution commands.
2. Every policy decision (what can run, what needs human confirmation) is enforced in code, not
   only as a prompt-level instruction.
3. Least privilege: each tool exposes only what it needs, not a generic shell when a specific
   operation is enough.
4. Traceability: every relevant action is audited.
5. Do not duplicate what Claude Code already solves well.

## Research status

Phase 0 (technical research) is complete. It covers Composio (architecture, license, reusable
components), the MCP protocol (specification, security, ecosystem), Claude Code and VS Code (what
they solve and what they don't), and remote execution/SSH and security patterns for agents.

> **Language note:** the Phase 0 research documents (`docs/research/`, `research/`,
> `architecture/ARCHITECTURE-DRAFT.md`) are written in **Catalan**, the language that phase was
> originally commissioned in. Starting with Phase 0.5 the project adopts Spanish as its primary
> language and English as the second language (see above). This cross-phase language
> inconsistency is tracked as **PENDING** in `STATE.md` and has not been resolved unilaterally
> (retroactively translating ~150KB of research is not a governance-phase task and risks
> introducing translation errors into already-verified technical content).

See `docs/research/RESEARCH-REPORT.md` for the full synthesis of findings.

Additionally, Phase 0.7 carried out a light exploration of other projects related to the
AI-agent-tooling ecosystem (Nango, Arcade, Windmill, IBM ContextForge, MCPX, Activepieces, and
more briefly Pipedream and Smithery), to identify further ideas and patterns — not to pick "the
best project" or to model AgentForge after any single one of them. See
`docs/en/research/RELATED-PROJECTS.md`.

## Next steps

Phase 1 (architecture and technology decisions) is **complete**: 5 decisions approved (DEC-003
through DEC-007 — relationship with Claude Code, Secrets Broker threat model, MCP scope, SSH
architecture, and the TypeScript/Node.js technology stack). See `decisions/DECISIONS.md` and
`architecture/ARCHITECTURE.en.md`.

1. Phase 2 — Core architecture (proposed next phase, not started, requires explicit
   authorization).
2. Minor decisions still pending: project license, repository visibility, Phase 2 implementation
   details (see `decisions/DECISIONS.md`, "PENDING" section).

See `ROADMAP.md` for the full proposed plan.

## Project layout

```
AgentForge/
├── .claude/
│   └── CLAUDE.md              — operating manual for Claude Code
├── docs/
│   └── research/               — Phase 0 research (Catalan): Composio, MCP, Claude Code, sources
├── research/
│   └── SSH-SECURITY-NOTES.md   — SSH/security research notes (Catalan)
├── architecture/
│   └── ARCHITECTURE-DRAFT.md   — architecture proposal (Catalan, NOT approved)
├── decisions/
│   └── DECISIONS.md            — actually approved decisions (empty for now)
├── STATE.md                    — current project state (source of truth)
├── README.md / README.en.md    — this document
├── CHANGELOG.md
├── ROADMAP.md
├── CONTRIBUTING.md
├── DEVELOPMENT.md
└── SECURITY.md
```

## License

**Decision pending.** The project does not yet have an assigned license. No license should be
assumed until the user decides one explicitly. See `DEVELOPMENT.md` and
`decisions/DECISIONS.md` for tracking of this pending decision.
