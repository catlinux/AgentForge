# Core structure analysis — AgentForge (Phase 2)

**Status: the 5 decisions in this document are APPROVED — see DEC-008 to DEC-012 in
`decisions/DECISIONS.md` (2026-09-16), including the cross-platform clarification of Decision 3.
This document is kept as the analysis and justification behind those decisions. NO folder,
configuration file, or code has been created yet — see DEC-012.**

Complements `architecture/ARCHITECTURE.en.md` (Phase 1) and `architecture/TECH-STACK-ANALYSIS.en.md`
(DEC-007: TypeScript/Node.js). English translation postponed, same as
`TECH-STACK-ANALYSIS.md`, until the documentation was more stable (translated in Phase 15,
DEC-079).

**Date:** 2026-09-16.

**Starting constraints** (non-negotiable, already approved):
- DEC-003 — in-place extension via hooks/own MCP servers.
- DEC-004 — Secrets Broker as a **separate process, its own OS user**.
- DEC-005 — MCP Modern-only.
- DEC-006 — SSH with per-host dedicated keys.
- DEC-007 — TypeScript/Node.js as the sole stack.
- A single developer, avoid premature complexity, but without creating something that will need
  to be redone as it grows (more MCP servers, execution backends, Policy Engine, Audit Log,
  possible future multi-user support).

---

## Decision 1 — Repository structure

### Alternatives
- **A. Monorepo with workspaces** (npm/pnpm/yarn workspaces): separate packages —
  `packages/shared`, `packages/core`, `packages/secrets-broker`, with room for
  `packages/mcp-<name>` / `packages/execution-<name>` as they are added.
- **B. Single package with internal folders** (`src/core`, `src/secrets-broker`, `src/shared`), a
  single `package.json`, multiple entry points/output bundles.
- **C. Multi-repo** (one Git repository per component).

### Pros/cons for AgentForge
- **A (monorepo+workspaces):** each package declares its own dependencies — the Secrets Broker
  can have a minimal, auditable dependency footprint distinct from Core's, which reinforces at
  the *packaging* level (not only at runtime) the trust boundary DEC-004 already requires.
  Growing with more MCP servers or execution backends is literally adding a new package, without
  touching existing ones — this fits directly with the future-growth requirement. Cost: somewhat
  more initial configuration (one `package.json` per package, a shared base config) — modest
  with current tooling, no extra monorepo orchestrator (Nx/Turborepo) needed at this scale.
- **B (single package):** simpler to bootstrap (one `node_modules`, one lockfile), but every
  component shares the same dependencies — the Secrets Broker would inherit Core/MCP
  dependencies even if it doesn't need them, unnecessarily widening its attack surface (exactly
  the component DEC-004 wants most isolated). Process separation is still possible (distinct
  entry scripts), but with no barrier preventing the Broker's code from accidentally importing
  something from Core. Growing by adding more servers/backends accumulates subfolders in a
  single `src/` tree, with no enforced boundaries — more likely to require restructuring later.
- **C (multi-repo):** cross-repo coordination (versioning shared types, cross-repo commits) is
  real complexity with no benefit for a single developer — discarded outright, contrary to the
  explicit principle of avoiding unnecessary complexity.

### Dependencies on other decisions
- Determines whether the package manager needs workspace support (all three Decision 2
  candidates support it).
- Makes it easier to reinforce Decision 3 (IPC): with separate packages it is easier to guarantee
  the Secrets Broker never directly imports Core's HTTP/MCP libraries.
- Determines where Decision 4's shared configuration lives (a base `tsconfig`/ESLint at the
  root, extended per package).

### Consequences of changing it later
- Migrating from B (single package) to A (workspaces) later is a mechanical but real refactor:
  moving folders into packages, adding a `package.json` per package, adjusting imports — not
  catastrophic, but exactly the kind of "rewrite later" the user asked to avoid where avoidable
  from the start.
- Migrating from A to C (multi-repo) would be more disruptive (splitting Git history) — not
  expected to be necessary at this scale.

### Recommendation
**A — Monorepo with workspaces**, with initial packages `packages/shared`, `packages/core`,
`packages/secrets-broker`. This is the option that best serves both requirement 3 (Core and
Secrets Broker genuinely separate, also reinforced at the packaging level) and requirement 5
(future growth by adding packages, not by restructuring).

---

## Decision 2 — Package manager

### Alternatives
- **npm** (bundled with Node, no extra install).
- **pnpm** (trivial install via Corepack on modern Node; content-addressable store, faster
  install with less disk usage).
- **yarn** (Classic v1, essentially in maintenance/legacy mode; or Berry/v2+ with PnP).

### Pros/cons for AgentForge
- **npm:** mature, no install friction, sufficient workspace support. Relevant downside here:
  dependency "hoisting" is looser — a package can end up resolving a dependency it never
  explicitly declared because it happened to be available in the shared root `node_modules`
  ("phantom dependency"). For a project where the Secrets Broker's dependency footprint matters
  for security, this looseness is a concrete downside, not just a theoretical one.
- **pnpm:** strict `node_modules` structure — a package **cannot** resolve a module it has not
  declared as its own dependency, even if another package in the monorepo has it installed. This
  **automatically reinforces**, without relying on developer discipline, exactly the boundary
  Decision 1 seeks at the packaging level. Faster install with less disk usage (a minor benefit
  for a single developer, but free). Installed via Corepack (bundled with modern Node) — no real
  friction cost.
- **yarn Berry/PnP:** the most aggressive at eliminating `node_modules` entirely, but with
  documented friction with certain VS Code tooling/extensions that expect a traditional
  `node_modules` — added cost with no clear benefit here. Yarn Classic (v1) is not recommended
  for new projects.

### Dependencies on other decisions
- Directly coupled to Decision 1 (workspaces) — pnpm's workspace support is mature and well
  documented.
- Neutral with respect to Decision 3 and Decision 4.

### Consequences of changing it later
- Switching package managers later is low-risk for a small project (delete lockfile +
  `node_modules`, reinstall), but causes a one-off lockfile churn — better to choose well now
  than change unnecessarily later.

### Recommendation
**pnpm**, precisely because its strict dependency isolation is a concrete — not hypothetical —
reinforcement of the trust boundary already central to this project (DEC-004), with no real
friction cost thanks to Corepack.

---

## Decision 3 — IPC mechanism between Core and Secrets Broker

This is the most consequential of the five decisions: it defines the real contract between the
two processes DEC-004 requires to be kept separate.

### Alternatives
- **A. Windows named pipe** (`\\.\pipe\agentforge-secrets`), accessible from Node via the `net`
  module (the same API as Unix sockets, with a Windows-specific pipe path), with access control
  via Windows ACLs on the pipe itself.
- **B. Local TCP (127.0.0.1 loopback) with token authentication**, generated/rotated by the
  Secrets Broker and shared with Core via a file with restricted permissions.
- **C. Unix domain socket** — supported on recent Windows 10+ builds, but far less
  standard/proven on Windows than named pipes.
- **D. stdio pipe** (Core launches the Secrets Broker as a child process and they communicate via
  stdin/stdout) — **incompatible in practice with DEC-004**: launching a child process under a
  distinct Windows user requires elevation mechanisms (`runas`, a scheduled task), not a simple
  `spawn()`; and if Core had the ability to launch processes as another user, that very
  capability would itself be a privilege-escalation risk if Core were compromised. Discarded for
  this reason, not just technical preference.

### Pros/cons for AgentForge
- **A (named pipe):** a native Windows IPC mechanism, with no network port open at all — nothing
  listens on TCP, which reduces the attack surface (no other process on the network, not even
  local, can attempt to connect via a port). The pipe's own ACLs allow restricting the connection
  to a specific user/SID — that is, the "only Core can talk to the Broker" boundary is enforced
  **at the operating system level**, not merely via an application-level token. Fits naturally
  and directly with the spirit of DEC-004.
- **B (TCP+token):** conceptually simpler and 100% cross-platform (relevant only if Core needed
  to run on Linux/macOS in the future, which is not currently planned). A loopback port, though
  limited to 127.0.0.1, is agnostic to which process connects — protection depends on the token
  staying secret and the token file having correct permissions, not on an OS-enforced boundary
  over the channel itself. A somewhat weaker boundary than A, though reasonable with good token
  hygiene. Easier to debug (can be tested with `curl`).
- **C (Unix socket on Windows):** more recent, less proven support in the Windows ecosystem than
  named pipes — no clear advantage over A for this use case.
- **D (stdio):** discarded, see above.

### Dependencies on other decisions
- Builds on Decision 1: the IPC client/server code and the shared message schema (e.g. "request
  credential X for already-approved execution Y") naturally live in `packages/shared`.
- Independent of Decision 2 and Decision 4.

### Consequences of changing it later
This is the most expensive decision to change without mitigation, because both Core and the
Secrets Broker would have concrete implementations against the chosen transport. **Proposed
mitigation, independent of which option is chosen now:** define a small, transport-agnostic
interface in `packages/shared` (e.g. something conceptually equivalent to
`SecretsBrokerClient.request(message): Promise<response>`), so both processes program against
that interface rather than directly against `net.connect(...)` or `fetch(...)`. This does not
eliminate the cost of switching transports later, but it bounds that cost to the interface's
implementation, not to all the code that uses it.

### Recommendation (preliminary, expanded below)
**A — Windows named pipe with an ACL restricted to the Secrets Broker's user and Core's user**,
wrapped from the start behind a transport-agnostic interface in `packages/shared` (mitigating the
consequence noted above). This is the option that best satisfies requirement 3 (real separation,
reinforced by the operating system, not just by convention) without compromising the ability to
change transports later without a wholesale rewrite.

### Requested expansion — cross-platform (Windows / Linux / future macOS)

**Context that changes the analysis:** Decision 3's original analysis implicitly assumed Windows
as the sole execution OS (it is the current development environment — see `STATE.md`, Platform:
win32). The project, however, has a stated goal (see `README.md`) of also running/executing
against remote systems such as the **home Debian server** (Phase 7 of the roadmap plans SSH
toward that machine). This does not automatically mean Core and the Secrets Broker will run *on*
Linux — two distinct things must be separated:

- **Where Core and Secrets Broker run** (the machine hosting AgentForge): today, with certainty,
  Windows. There is no approved DECISION that it will also run on Linux — it is a reasonable
  future possibility, not a fact.
- **Which systems AgentForge manages as remote targets** (Debian, Contabo VPS): this is SSH
  execution *toward* those machines (Phase 7), it does not mean Core/Secrets Broker are deployed
  there. The Core<->Secrets Broker IPC is local to whichever machine AgentForge runs on.

That said, it is reasonable that the developer might, in the medium term, want to run AgentForge
on the home Debian server itself (not just use it as an SSH target) — which is why it is worth
designing the abstraction now, even though the concrete implementation activated today is only
the Windows one.

**1. How it would work on Windows:**
A named pipe (`\\.\pipe\agentforge-secrets`) created by the Secrets Broker with an ACL (Windows
`SECURITY_ATTRIBUTES`/DACL) that only grants connection access to the SID of the Windows user
under which Core runs (and the Broker's own SID). Node exposes it via the `net` module
(`net.connect()` to a pipe path instead of a host:port — the same API as a socket). No TCP port
is ever open. The boundary ("only Core can talk to the Broker") is enforced by the Windows
kernel when accepting or rejecting the connection, not by application code.

**2. How it would work on Linux (Core and Secrets Broker):**
The direct, standard equivalent on Linux is a **Unix domain socket** (e.g.
`/run/agentforge/secrets.sock`, or `$XDG_RUNTIME_DIR/agentforge/secrets.sock` for a per-user
socket without requiring root privileges), with file permissions (`chmod`/owner:group)
restricting which system user can connect — the same principle as the named pipe's ACL on
Windows, applied via Linux's native mechanism. Node natively supports Unix domain sockets with
the same `net` module, with the same API shape as on Windows (`net.connect({path})`). In other
words: **this is not an exotic alternative** — it is the de facto standard mechanism for local
IPC with OS-level access control on Linux, with the same guarantee level as the named pipe on
Windows (boundary enforced by the kernel/filesystem, not by an application token).

**3. Should a cross-platform abstraction be designed now? Which implementation per OS?**
Yes, it makes sense to design the transport-agnostic interface (already proposed in the original
analysis, in `packages/shared`) with the awareness, from now on, that it will have **two native
implementations**, not one:
- `packages/shared`: a `SecretsBrokerTransport` interface (or equivalent) with methods like
  `connect()`/`request(message)`, with no reference to pipe or socket paths whatsoever.
- Windows implementation: named pipe + ACL (as already described).
- Linux implementation: Unix domain socket + file/directory permissions.
- Implementation selection at runtime via `process.platform` (a standard Node pattern for this
  kind of OS difference) — with no conditional logic scattered through Core's or the Broker's
  code, only at the point where the transport is instantiated.

This is consistent with the principle of "avoiding premature complexity without generating
rework": there is no need to *implement* the Linux variant now (Windows is the only real OS
today, and there is no decision to run AgentForge on Linux), but the interface should avoid
implicitly assuming Windows-exclusive concepts (e.g. it must not leak "Windows ACL" as an
interface concept — it should speak of "access control on the channel," with each
implementation resolving it its own native way).

**4. Does it keep DEC-004's security boundary intact?**
Yes, on both operating systems, with the same guarantee level — and this is key: neither the
Windows ACL nor the Unix socket permissions are "almost as good," they are **the native
equivalent mechanism** on each OS for the same thing (access control on the IPC channel enforced
by the operating system, not by the application). DEC-004 requires the Secrets Broker to be a
separate process under its own OS user — both implementations satisfy that requirement the same
way: only Core's OS user can connect to the Broker's channel, verified by the kernel before a
single line of application code runs. One nuance to document as PENDING (not blocking for this
decision): on Linux, if Core and the Secrets Broker ran inside separate containers or namespaces
instead of as distinct Linux users on the same host, the isolation model would change
(filesystem namespaces, not just user permissions) — this is neither decided nor relevant today
(no containerization is planned in any phase of the current roadmap); it is mentioned only so
"Linux" is not assumed to imply a single deployment model.

**5. Impact of adding macOS in the future:**
Low. For the purposes of this mechanism, macOS is a Unix — it natively supports Unix domain
sockets with the same file-permission semantics as Linux. The "Linux" transport implementation
(Unix domain socket + permissions) would work on macOS with no design changes, likely with no
code changes (Node abstracts the difference). The only nuance is the conventional socket path
(macOS has no standard `/run` or `$XDG_RUNTIME_DIR` — something like
`~/Library/Application Support/AgentForge/` or `/tmp` with restrictive permissions would be used,
to be decided if/when macOS is actually addressed). This does not require redesigning the
`packages/shared` interface, only adding a third path-configuration branch if needed. This is
not a decision to make now — it is simply the observation that the chosen abstraction does not
generate relevant additional cost if macOS enters the picture later.

**6. Is there a simpler alternative with equivalent security?**
It was explicitly reviewed whether something simpler than "two native implementations behind an
interface" exists with the same security level:
- **TCP loopback + token (option B of the original analysis)** would indeed be simpler to
  implement (a single implementation, 100% cross-platform with no per-OS branches) — but, as
  already documented, the security boundary it offers is strictly weaker: protection depends on
  the token staying secret and on the permissions of the file containing it, not on an
  OS-enforced boundary over the channel itself. It is not "equivalent security" — it is a
  different (and lower) security level in exchange for implementation simplicity. It does not
  satisfy the question as posed (same security, simpler), so it is discarded as an answer to
  this point.
- No alternative has been identified that matches the guarantee of "OS-enforced boundary on the
  channel" with less code than "native socket/pipe + native OS access control." The apparent
  added complexity (two implementations) is, in practice, small: both use the same Node `net`
  module with an almost identical API (`net.connect({path: ...})` in both cases) — the real code
  difference is the channel path and how permissions are set, not two conceptually distinct IPC
  mechanisms.

### Final recommendation (Decision 3, after the expansion)
**The recommendation stands — Named pipe (Windows) / Unix domain socket (Linux, and macOS with
no additional changes) with native OS access control**, unified behind the same
transport-agnostic interface in `packages/shared` already proposed. Change from the original
analysis: it is now specified that the interface must be designed **from the start with
cross-platform vocabulary** (without leaking Windows-specific concepts), even though today only
the Windows variant is implemented and activated, since it is the only confirmed real execution
OS. Implementing the Linux/macOS variant is not proposed yet — only that the interface not
exclude it by design, so that adding it later is "a new implementation of the same contract," not
a redesign.

No new decision is recorded and no file is created here — this expansion remains part of this
same analysis document, pending your approval along with the rest.

---

## Decision 4 — Code conventions

### Alternatives
- **Linter/formatter:** ESLint + Prettier (the most established, broadest plugin coverage,
  including security plugins like `eslint-plugin-security` or anti-secret-leak rules) vs. Biome
  (faster, combines lint+format in one tool, still a more limited plugin ecosystem).
- **TypeScript configuration:** `strict: true` from the start vs. a lax configuration tightened
  later.
- **Testing framework:** Vitest (modern, fast, ESM-first, Jest-compatible API, good TS/monorepo
  support) vs. Jest (more established, somewhat more friction with ESM/TS) vs. `node:test`
  (no dependencies, but a less mature mocking/coverage ecosystem).

### Pros/cons for AgentForge
- **ESLint+Prettier:** somewhat slower and with more configuration files than Biome, but far more
  proven for a TypeScript+Node monorepo, and with security plugins directly relevant to a
  project whose `SECURITY.md` insists on secret hygiene. At this scale (one developer, still
  small codebase), lint speed is not a real bottleneck — ecosystem maturity weighs more.
- **Strict TypeScript from the start:** practically zero cost on a new project with no legacy
  code; a real, ongoing benefit (a class of null/undefined errors particularly relevant to a
  Policy Engine that validates untrusted input). Tightening it later on an already-grown
  codebase would be disproportionately more expensive than starting this way.
- **Vitest:** the best fit — modern, fast, native TS/ESM support, Jest-compatible API (Jest
  knowledge/documentation remains useful), good monorepo support (per-package or all-at-once
  tests). `node:test` is tempting for adding no dependencies, but its mocking/coverage ecosystem
  is still less mature — not worth it for a project that will need good test coverage on
  security-sensitive components.

### Dependencies on other decisions
- Needs Decision 1 resolved first: the base configurations (`tsconfig.base.json`, root ESLint
  config) live at the monorepo root and each package extends them.
- Independent of Decision 2 and Decision 3.

### Consequences of changing it later
- Switching linter/formatter later causes one large one-off diff (reformatting all existing
  code) — annoying but mechanical, low risk.
- Switching testing frameworks later means rewriting existing test files — a real but bounded
  cost; better to choose well now while there are no tests to migrate.

### Recommendation
**ESLint + Prettier**, **TypeScript in strict mode from the start**, **Vitest** as the testing
framework. Considering `eslint-plugin-security` is proposed as part of a later hardening phase
(Phase 13 of the roadmap), not a requirement of this phase.

---

## Decision 5 — Create the folder skeleton now, or wait?

### Alternatives
- **A. Create the skeleton now**, as soon as decisions 1-4 are approved (folder structure,
  per-package `package.json`, base configuration — no logic).
- **B. Treat this phase as purely decision/documentation**, and create the skeleton in a later,
  explicitly authorized step, presented for review before executing it (same pattern followed in
  every previous phase: propose → decide → only then act, with explicit confirmation at each
  step).

### Pros/cons
- **A:** moves faster, closes Phase 2 in a single block of work.
- **B:** keeps consistency with the pace the user has set in every previous phase (including this
  explicit request: "Don't create any folders, files, or code yet" / "we don't want to
  implement functionality yet"), and allows reviewing the exact folder tree and the exact content
  of each `package.json` before it exists, the same way the technology stack was reviewed before
  being approved.

### Dependencies on other decisions
None technical — it is purely about sequencing. Depends on decisions 1-4 being approved in order
to present a concrete folder tree for review.

### Consequences of changing it later
None relevant — it is a matter of work ordering, not architecture.

### Recommendation
**B — Wait.** Consistent with the pace already established throughout the project and with the
user's explicit instruction in this same message. Once decisions 1-4 are approved, the folder
tree and the proposed content of each configuration file will be presented for review, before
creating anything.

---

## Final coherent proposal (all 5 decisions together)

1. **Monorepo with workspaces**: `packages/shared`, `packages/core`, `packages/secrets-broker`,
   with explicit room to add `packages/mcp-<name>` / `packages/execution-<name>` as the tool
   catalog grows (without touching existing packages when a new one is added).
2. **pnpm** as the package manager, for its strict dependency isolation — it automatically
   reinforces, at the packaging level, the same trust boundary DEC-004 requires at runtime.
3. **Windows named pipe with ACL** for Core<->Secrets Broker communication, wrapped from the
   start behind a transport-agnostic interface in `packages/shared`, so that a future transport
   change (if ever needed) is bounded to a single implementation.
4. **ESLint + Prettier, strict TypeScript from the start, Vitest** as shared code conventions,
   defined at the monorepo root and extended by each package.
5. **Do not create any file or folder yet.** Present the folder tree and the proposed
   configuration content for explicit review once decisions 1-4 are approved, as a separate step
   authorized by the user.

**Coherence of the set with the user's requirements:**
- *A single developer:* no piece introduces team/orchestration infrastructure (no
  Nx/Turborepo, no CI/CD yet, no enterprise secrets manager).
- *Core and Secrets Broker as separate processes:* reinforced at three distinct layers —
  packaging (separate npm/pnpm packages with their own dependencies), installation (pnpm
  prevents phantom dependencies between packages), and runtime (named pipe with ACL, not just an
  application token).
- *Avoiding premature complexity without generating rework:* every choice has a bounded,
  explicit path for future change (workspaces → nothing to migrate when adding a package; IPC →
  agnostic interface already planned; testing/lint → low change cost since it's greenfield).
- *Future growth (more MCP servers, execution backends, Policy Engine, Audit Log,
  multi-user support):* the package structure is explicitly designed to absorb this by
  addition, not by restructuring.
- *No functionality implemented yet:* no code file, no folder created in this document.
