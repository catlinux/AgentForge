# Technology stack analysis — AgentForge (Phase 1)

> **DECIDED (DEC-007, 2026-09-16):** TypeScript/Node.js, following the recommendation in
> section 4. See `decisions/DECISIONS.md` for the formal record of the decision. This document
> is kept intact as the record of the analysis behind it.

Complements `architecture/ARCHITECTURE.en.md` §17, which left the technology stack as the most
important open question of Phase 1.

**Date:** 2026-09-16.

---

## 1. Constraints coming from the already-approved architecture

These are not preferences — they are direct consequences of DEC-003 to DEC-006
(`decisions/DECISIONS.md`) and therefore **constrain** any stack choice:

1. **DEC-003 (in-place extension):** the main transport toward Claude Code is MCP (own
   servers) — the MCP SDK available in the chosen language must be solid, not experimental.
2. **DEC-005 (MCP Modern-only):** confirmed support for the `2026-07-28` specification is
   needed. Phase 0 research (`docs/research/MCP-ANALYSIS.md` §8) only **directly verified** the
   official **TypeScript** and **Python** SDKs as mature Tier 1. The Go, C#, and Rust SDKs are
   cited as "Tier 1" in MCP's own release blog post, but the research explicitly flagged them as
   `NOT VERIFIED` for real maturity, documentation, and stability — their repositories were never
   directly inspected.
3. **DEC-004 (Secrets Broker as a separate process, its own OS user):** the stack must allow
   running two independent processes on Windows under distinct user identities with reasonable
   ease, one of which can access Windows Credential Manager to hold the SSH key/passphrase
   (`architecture/ARCHITECTURE.en.md` §8).
4. **DEC-006 (SSH with per-host dedicated keys):** a mature SSH client library is needed, with
   good support for separate stdout/stderr/exit-code capture and differentiated timeouts
   (connection vs. execution) — Phase 0 research (`research/SSH-SECURITY-NOTES.md` §3)
   specifically documented that Paramiko (Python) has known, reported limitations in this exact
   combination (reliable timeout + exit code simultaneously).
5. **Development environment:** Windows 11 + VS Code, a single developer, local-first, no
   additional server infrastructure (`DEVELOPMENT.md`).
6. **User's explicit principle for this phase:** avoid unnecessary complexity.

---

## 2. Candidates evaluated

### TypeScript / Node.js

- **MCP:** official Tier 1 SDK, confirmed mature (`docs/research/MCP-ANALYSIS.md` §8) — Apache
  2.0 license (new code) / MIT (existing code), with a documented v2 migration guide.
- **SSH:** the `ssh2` package — mature, widely used in production, without the
  timeout/exit-code limitations documented for Paramiko.
- **Windows Credential Manager:** several libraries (`keytar` and successors, native N-API
  wrappers) allow direct access; alternative: invoking `cmdkey`/PowerShell from the process.
- **Process/user separation (DEC-004):** one Node executable per component, launched under a
  distinct Windows account (Task Scheduler / `runas` / a Windows service via `node-windows`).
  Requires Node to be available on that account's `PATH` — a small configuration cost, not
  blocking.
- **Concurrency model:** native asynchronous I/O, fits well with an MCP server that handles tool
  calls and, potentially, HTTP hooks in parallel.
- **Typing:** TypeScript provides static typing — relevant for a gateway centered on validating
  tool schemas and enforcing policy, where type errors have a security cost, not just a
  correctness one.
- **Ecosystem:** the broadest of the candidates for small HTTP servers (hooks) and command-line
  tools.
- **Risk/complexity:** the npm ecosystem is large and heterogeneous — requires discipline to
  avoid accumulating unnecessary dependencies (contrary to the "avoid unnecessary dependencies"
  principle in `README.md`), but this is a project-discipline matter, not a language limitation.

### Python

- **MCP:** official Tier 1 SDK, confirmed mature (`docs/research/MCP-ANALYSIS.md` §8) — MIT
  license, with a documented v2 migration guide. The `mcp[cli]` package is well documented.
- **SSH:** Paramiko is the standard option, but Phase 0 research
  (`research/SSH-SECURITY-NOTES.md` §3) specifically documented known limitations (combining a
  reliable timeout with exit-code capture requires extra buffering/polling logic, with real
  reported issues). Third-party wrappers exist (`exec-helpers`) that mitigate this, adding one
  more dependency.
- **Windows Credential Manager:** the `keyring` library provides direct, portable access (works
  the same on Windows/macOS/Linux should that be needed in the future), more simply than most
  alternatives in other languages.
- **Process/user separation (DEC-004):** just as viable as Node — one Python
  script/executable per component, under a distinct Windows account. Packaging as a single
  executable (to avoid depending on Python being installed under that other account) is somewhat
  more laborious than in Node (tools like PyInstaller exist but add a build step).
- **Concurrency model:** async support available (`asyncio`, and the MCP SDK uses it), though the
  ecosystem is somewhat less uniform than Node's in this respect.
- **Typing:** gradual typing (type hints + optional mypy) — less strict by default than
  TypeScript, though fully viable if adopted with discipline.
- **Readability/entry curve:** syntax generally considered simpler for short scripts and
  automation logic — relevant if iteration speed is prioritized over typing guarantees in early
  phases.

### Go

- **MCP:** SDK cited as Tier 1 in the release blog post, maintained "in collaboration with
  Google" according to secondary sources — but **not directly verified** in Phase 0
  (`docs/research/MCP-ANALYSIS.md` §8, flagged `NOT VERIFIED`). This introduces real risk:
  betting the main transport mechanism (MCP, per DEC-003) on an SDK whose maturity has not been
  checked.
- **SSH:** `golang.org/x/crypto/ssh` is a solid, widely-used library, without Paramiko's
  documented problems.
- **Deployment:** compiles to a single static binary — fits very well with DEC-004's requirement
  (separate process under another user: just copy an `.exe`, no runtime to install under that
  other Windows account). This is Go's clearest advantage for this specific project.
- **Windows Credential Manager:** third-party libraries exist (e.g. `go-keyring`), but with less
  verified use/maintenance than their Node/Python equivalents.
- **Added complexity:** a second language if combined with TS/Python for other parts (see §3) —
  the user explicitly asked to avoid unnecessary complexity, and this is a reason not to choose
  Go as the sole stack unless Go's MCP SDK is verified directly first.

### Rust

- **MCP:** SDK described as "Beta" by a secondary source (`docs/research/MCP-ANALYSIS.md` §8,
  `NOT VERIFIED`) — the least mature of the five candidates in this specific respect.
- **SSH:** mature crates exist (`ssh2`, wrapping libssh2; `russh`, pure Rust).
- **Memory safety:** the strongest of the five candidates in language-level security guarantees —
  theoretically relevant for the Secrets Broker, the most sensitive component.
- **Deployment:** single static binary, just as well positioned as Go for DEC-004.
- **Learning curve:** the steepest of the five candidates — a real iteration-speed cost for a
  single-developer project in active design phase.
- **Assessment:** a good **future** candidate for an isolated, critical component (e.g.
  rewriting just the Secrets Broker in Rust later, thanks to the already-approved architecture
  treating it as an independent process) — premature as the starting stack for the whole
  project in Phase 1, precisely because of the principle of avoiding unnecessary complexity.

### C# / .NET

- **MCP:** SDK cited as Tier 1, maintained "in collaboration with Microsoft" according to
  secondary sources — like Go, **not directly verified** in Phase 0 (`NOT VERIFIED`).
- **SSH:** `SSH.NET` is a mature, widely used library in the .NET ecosystem.
- **Native Windows integration:** the strongest of the five candidates — direct access to
  Windows Credential Manager via native APIs, first-class support for Windows Services and
  service accounts (fits very well with DEC-004), mature VS Code tooling for C#/.NET.
- **Deployment:** can compile to a single executable (`dotnet publish` with
  `PublishSingleFile`/AOT), similar to Go/Rust in that respect.
- **Added complexity:** same as Go, would be a second language if combined with TS/Python for
  the rest — same argument against it as the sole stack while its MCP SDK is unverified.
- **Context:** technically very solid for this specific project (Windows-first), but the risk of
  an unverified MCP SDK outweighs the advantage of native integration at this phase.

---

## 3. Explicit consideration: single stack or polyglot?

The user asked to avoid unnecessary complexity. A polyglot stack (e.g. Go for the Secrets Broker
+ TypeScript for the MCP servers) has a real advantage — leveraging each language's strong point
for each component — but also a real cost for a single-developer project: two toolchains, two
dependency ecosystems, and a cross-language IPC contract to maintain
(`architecture/ARCHITECTURE.en.md` §3, §8, §18 already flag the IPC mechanism as an open
question).

**PROPOSAL of this analysis:** start with **a single language** for everything (AgentForge Core,
MCP servers, and the Secrets Broker itself as a separate process but in the same language), and
reconsider a polyglot component **only if** it becomes concretely justified in the future (e.g.
if the Secrets Broker needs security guarantees the chosen language cannot provide with
reasonable effort). The already-approved architecture (separate processes, IPC/message
communication, no code coupling between components) makes this future change possible without
redesigning anything if it were ever needed — it is not an irreversible decision.

---

## 4. Reasoned recommendation

Given the constraints in section 1 and the explicit principle of avoiding unnecessary
complexity:

**Recommendation: TypeScript/Node.js as the sole stack for Phase 1**, with **Python as an
equally valid alternative** if the user has a preference or relevant prior experience.

Reasons for the recommendation (not a decision, just the justification):
1. It is one of only two MCP SDKs verified as mature in the Phase 0 research — same as Python,
   but with the added advantage that Node's native asynchronous I/O model fits more directly
   with an MCP/HTTP server that must handle multiple concurrent calls.
2. The SSH library (`ssh2`) does not have the timeout/exit-code limitations documented for
   Paramiko in this project's own research — it avoids an already-identified problem, not a
   hypothetical one.
3. TypeScript's static typing reduces a class of errors relevant to a component whose central
   function is validating and enforcing policy over tool calls.
4. Go, Rust, and C# have real advantages for DEC-004 (single binary, a better "process under
   another user with no runtime to install" story), but **their MCP SDK is unverified** — given
   that MCP is the main transport per DEC-003, this is a risk that does not offset the
   deployment advantage in Phase 1. That risk would disappear if one of those SDKs is directly
   verified before committing (see §5).

**If the user prefers Python** (for example, due to prior familiarity or personal preference),
the recommendation would shift to: Python + the `keyring` library for credentials +
`exec-helpers` (or a thin custom layer) to mitigate Paramiko's known limitations. It is an
equally solid alternative, not a second-tier option — the choice between TypeScript and Python
in this specific project depends more on the single developer's familiarity/preference than on
a decisive technical difference.

---

## 5. What this document does NOT decide

- It does not pick a specific HTTP framework within the winning language (e.g. Express/Fastify
  in Node, FastAPI/Flask in Python) — postponing that detail choice until real implementation
  begins (Phase 2) is proposed, to avoid over-deciding in this phase.
- It does not directly verify the Go/Rust/C# MCP SDKs — if the user has particular interest in
  any of them despite the flagged risk, a direct verification (not a full re-investigation) is
  proposed as a next step before ruling them out definitively.
- It does not decide the exact IPC mechanism between AgentForge Core and the Secrets Broker
  (`architecture/ARCHITECTURE.en.md` §3/§8/§18 leaves it as an open question) — though the chosen
  stack does influence which options are more natural (Windows named pipes are reasonably
  accessible from both Node and Python).
