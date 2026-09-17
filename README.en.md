# AgentForge

**Project status: release `0.1.0` — 15 phases complete (research, governance, core architecture,
Tool Registry, Tool Discovery, Policy Engine, Secrets Broker, remote SSH execution, MCP
integration, Sessions, Audit Log, Connectors, Web Dashboard, Security hardening, Testing and
integration, and Documentation/release). Real TypeScript/Node.js implementation, with automated
tests and CI. `0.1.0` is the first internal release of the project's current state — it does not
imply AgentForge is already a complete production product (there is still no real,
deployable production `main`/CLI). See `STATE.md` for the full, up-to-date detail.**

[Versión en español](README.md)

---

## What is AgentForge

AgentForge is a personal project that builds modular infrastructure letting AI agents —
initially Claude Code — use tools, MCP, connectors, remote systems, APIs, authentication,
permissions, tool discovery, sessions, and automations in a controlled, extensible way, without a
mandatory dependency on any external provider.

The project took ideas and architecture from Composio as one reference point, among others, but
**does not assume Composio should be copied**, nor that its architecture is necessarily the best
fit for this use case. No code from Composio or any other studied project has been reused.

## What problem it solves

Claude Code already solves a significant part of "giving an agent tools" very well: an MCP
client, local permissions, hooks, subagents, Bash sandboxing, and management of its own
credentials. Phase 0 research (see `docs/research/`) identified a concrete set of gaps that
Claude Code does not cover — and AgentForge already implements them:

- **Controlled, audited remote (SSH) execution** — `packages/execution-ssh`, with parameterized
  commands (never arbitrary shell) and synchronous human confirmation for risky actions.
- **A queryable tool registry** — `packages/core` (Tool Registry + Tool Discovery).
- **A unified secrets broker** — `packages/secrets-broker`, a separate process with its own OS
  user and permissions, encrypted storage (AES-256-GCM).
- **A centralized audit log** — every process writes its own events as JSON Lines, with strict
  minimization of sensitive data.
- **Connectors to external services** — `packages/connector-github`, following the same
  controlled-execution pattern as SSH.
- **A read-only web dashboard** — `packages/dashboard`, to visualize the Tool Registry,
  Discovery, Policy Engine, and Audit Log.

AgentForge fills specifically these gaps — it does not reimplement what Claude Code already does
well.

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

## What it does NOT aim to do

- It does not aim to be "a free Composio" or to clone its product.
- It does not aim to duplicate functionality Claude Code already handles well (MCP client, local
  permissions, hooks, subagents, Bash sandboxing, its own credential management).
- It never exposes a generic shell tool to the agent — every remote capability is a concrete
  operation with a fixed template (least-privilege principle).

## Current project status

| Area | Status |
|---|---|
| Technical research (Composio, MCP, Claude Code, VS Code, SSH, security) | **Completed** (Phase 0) |
| Project foundations, documentation, and governance | **Completed** (Phase 0.5) |
| Architecture and technology decisions | **Completed** (Phase 1) |
| Core architecture, Tool Registry, Tool Discovery, Policy Engine | **Completed and implemented** (Phases 2–5) |
| Secrets Broker, remote SSH execution, MCP integration | **Completed and implemented** (Phases 6–8) |
| Sessions, Audit Log, Connectors, Web Dashboard | **Completed and implemented** (Phases 9–12) |
| Security hardening | **Completed** (Phase 13) |
| Testing and integration | **Completed** (Phase 14) |
| Documentation and release | **Completed** (Phase 15) — release `0.1.0` |
| Software implementation | **Yes — 8 real TypeScript/Node.js packages, with automated tests** |
| Git repository | Initialized, with the full history of every phase |
| Remote repository | `https://github.com/catlinux/AgentForge` — visibility decided as Public (DEC-076), real change pending the user's application |
| CI/CD | GitHub Actions, Linux/Windows matrix (DEC-078) |
| License | MIT (see `LICENSE`) |

See `STATE.md` for the detailed, continuously updated project status — it is the single source of
truth on real progress; this README is updated at every phase but may occasionally lag behind if
not explicitly synced.

## Current architecture (implemented)

```
Claude Code (agent, reasoning — treated as untrusted)
        │  MCP (stdio transport)
        ▼
packages/mcp-server — own, single MCP server, agnostic of the execution backend
   ├── packages/core — Tool Registry + Tool Discovery + Policy Engine
   ├── packages/secrets-broker — separate process, encrypted storage
   ├── packages/shared — types, contracts, Audit Log
   ├── packages/execution-ssh — Execution Backend: controlled, audited SSH
   ├── packages/connector-github — Execution Backend: GitHub connector (REST API)
   └── packages/dashboard — read-only web interface
        ▼
Local / remote systems (home Debian server, Contabo VPS, GitHub — never touched without
explicit, separate authorization; all verification runs against mocks/fixtures)
```

Every component runs as a separate process, communicated over its own IPC channels (named pipe on
Windows, Unix domain socket on Linux/macOS), with uniform fail-closed behavior on any ambiguity.
Full detail for every decision lives in `architecture/ARCHITECTURE.en.md` (and its Spanish
equivalent `architecture/ARCHITECTURE.md`) and in `decisions/DECISIONS.md` — over 80 approved
decisions across 15 phases. The original Phase 0 document, `architecture/ARCHITECTURE-DRAFT.md`,
is kept as a historical reference.

## Core principles

1. The agent/LLM is a reasoning component that can potentially be manipulated (prompt injection)
   — it never has direct access to credentials nor freely constructs execution commands.
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

The 15 phases planned for this stage of the project are complete. The ROADMAP contemplates
Phase 16 (Stable Release) as the next proposed step, not yet started or authorized. See
`ROADMAP.md` for the full plan.

One minor decision still pending: the Phase 0 language inconsistency (research written in
Catalan versus the rest of the project's Spanish/English) — deliberately left unresolved. See
`decisions/DECISIONS.md`, "PENDING" section.

## Project layout

```
AgentForge/
├── .claude/
│   └── CLAUDE.md              — operating manual for Claude Code
├── .github/
│   └── workflows/ci.yml        — CI (GitHub Actions, Linux/Windows matrix)
├── docs/
│   └── research/               — Phase 0 research (Catalan): Composio, MCP, Claude Code, sources
├── research/
│   └── SSH-SECURITY-NOTES.md   — SSH/security research notes (Catalan)
├── architecture/
│   ├── ARCHITECTURE.md         — full architecture (Spanish, primary)
│   ├── ARCHITECTURE.en.md      — full architecture (English)
│   ├── TECH-STACK-ANALYSIS.md/.en.md      — technology stack analysis
│   ├── CORE-STRUCTURE-ANALYSIS.md/.en.md  — core structure analysis
│   └── ARCHITECTURE-DRAFT.md   — original Phase 0 proposal (Catalan, historical)
├── decisions/
│   └── DECISIONS.md            — 80+ approved decisions across 15 phases
├── packages/
│   ├── shared/                 — shared types, contracts, Audit Log, utilities
│   ├── core/                   — Tool Registry, Tool Discovery, Policy Engine
│   ├── secrets-broker/         — encrypted secret storage, separate process
│   ├── execution-ssh/          — Execution Backend: controlled, audited SSH
│   ├── connector-github/       — Execution Backend: GitHub connector
│   ├── mcp-server/             — own MCP server
│   └── dashboard/              — read-only web interface
├── tests/
│   └── integration/            — real cross-process integration tests (Phase 14)
├── LICENSE                     — MIT
├── STATE.md                    — current project state (source of truth)
├── README.md / README.en.md    — this document
├── CHANGELOG.md
├── ROADMAP.md
├── CONTRIBUTING.md
├── DEVELOPMENT.md
└── SECURITY.md
```

## License

**MIT** (DEC-075, Phase 15). See `LICENSE` at the repository root.
