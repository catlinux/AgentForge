# User guide — AgentForge

This guide explains, step by step and from scratch, how to install, configure, start, and use
AgentForge on a real Windows machine, connected to Claude Code over MCP. It matches the real
state of the code after Phase 16 (release `0.1.0` + real entrypoints). If anything here disagrees
with the code, the code is authoritative — see `STATE.md`/`decisions/DECISIONS.md` for the
approved state.

**Scope of this guide:** real use on a single machine, a single operator, against an SSH host and
a GitHub account you control. It does not cover multi-user or multi-server deployment, or any
scenario not supported by the current architecture (see "Current limitations" at the end).

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Installing the project](#2-installing-the-project)
3. [Initial configuration: `AGENTFORGE_DATA_DIR`](#3-initial-configuration-agentforge_data_dir)
4. [Secrets Broker: registering your credentials](#4-secrets-broker-registering-your-credentials)
5. [Configuring SSH hosts](#5-configuring-ssh-hosts)
6. [Configuring the GitHub connector](#6-configuring-the-github-connector)
7. [Tool Registry](#7-tool-registry)
8. [Discovery: which tools are exposed to the agent](#8-discovery-which-tools-are-exposed-to-the-agent)
9. [Policy Engine: classifying risk](#9-policy-engine-classifying-risk)
10. [Starting the processes, in order](#10-starting-the-processes-in-order)
11. [Connecting AgentForge to Claude Code (MCP)](#11-connecting-agentforge-to-claude-code-mcp)
12. [Checking that everything works](#12-checking-that-everything-works)
13. [Using the tools from Claude Code](#13-using-the-tools-from-claude-code)
14. [The Dashboard](#14-the-dashboard)
15. [Human confirmation](#15-human-confirmation)
16. [Audit Log](#16-audit-log)
17. [Stopping and restarting](#17-stopping-and-restarting)
18. [Troubleshooting](#18-troubleshooting)
19. [Current limitations and Windows-only parts](#19-current-limitations-and-windows-only-parts)

---

## 1. Prerequisites

- **Windows** (the only platform actually verified today — see section 19).
- **Node.js** and **pnpm** (the monorepo's package manager, DEC-009, via Corepack).
- **Claude Code** installed, if you want to connect AgentForge as an MCP server.
- To use `execution-ssh` for real: a remote host reachable over SSH with an `ed25519` key
  **dedicated to AgentForge** (DEC-006) — never reuse a personal key. Generate it now, before
  going further, if you do not have one yet:

  ```powershell
  ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\agentforge_ed25519" -C "agentforge"
  ```

  This creates `agentforge_ed25519` (private key) and `agentforge_ed25519.pub` (public key) in
  your `.ssh` folder. Add the contents of `agentforge_ed25519.pub` to `~/.ssh/authorized_keys` for
  the remote user on your SSH host (out of scope for this guide — that is remote-host
  configuration, not AgentForge configuration). Keep the **private** key's path — you use it in
  section 4, where you register its contents with the Secrets Broker.
- To use `connector-github` for real: a **Personal Access Token** from GitHub with the minimum
  permissions needed for the operations you want to use (`create_issue`, `list_issues`,
  `comment_on_issue`). Create it now, before going further, from GitHub → Settings → Developer
  settings → Personal access tokens, if you do not have one yet — you also need it in section 4.

## 2. Installing the project

From the repository root:

```
pnpm install
pnpm run build
```

`pnpm run build` compiles all 8 packages (`packages/*`) — required because every real entrypoint
runs from `dist/`, not from `src/`.

## 3. Initial configuration: `AGENTFORGE_DATA_DIR`

Every process reads and writes under a single data directory, configurable via the
`AGENTFORGE_DATA_DIR` environment variable. If unset, it defaults to `%USERPROFILE%\.agentforge`
(`~/.agentforge`).

Set this variable **in every terminal where you start an AgentForge process**, with the same
value everywhere — if you start different processes with different `AGENTFORGE_DATA_DIR` values,
they will not find each other (the Secrets Broker, host configuration, Registry, etc. are all
specific to that directory).

In PowerShell:

```powershell
$env:AGENTFORGE_DATA_DIR = "C:\Users\<your-user>\.agentforge"
```

Real structure that gets created inside that directory as you start processes and add
configuration (no file is created until it is actually needed):

```
<AGENTFORGE_DATA_DIR>/
├── secrets-broker/
│   ├── master.key            (created automatically on the Broker's first start)
│   └── secrets.enc.json      (created when you register the first secret)
├── execution-ssh/
│   └── host-config.json      (you create this — section 5)
├── connector-github/
│   └── account-config.json   (you create this — section 6)
├── registry-cache.json       (you create this — section 7)
├── discovery-config.json     (you create this — section 8)
├── policy-config.json        (you create this — section 9)
└── audit/
    ├── mcp-server.jsonl      (created automatically on the first written event)
    ├── execution-ssh.jsonl
    └── connector-github.jsonl
```

No process fails if a configuration file does not exist yet — it starts with an empty
configuration (zero hosts, zero accounts, zero tools) instead of erroring out. This lets you start
everything first and configure it afterwards.

## 4. Secrets Broker: registering your credentials

The Secrets Broker (`packages/secrets-broker`) is the only component that holds real credentials
(SSH private key, GitHub Personal Access Token), encrypted at rest (DEC-030, AES-256-GCM). No
other process ever sees the plaintext value except at the moment it is used.

**There is no secrets-administration CLI yet** — the Broker exposes its API
(`get`/`create`/`update`/`delete`/`exists`/`listMetadata`, DEC-033) as TypeScript code
(`@agentforge/secrets-broker`), meant to be used by the Broker process itself or by a short script
you run once. This is intentional (DEC-033: no over-engineering for a single-operator use case) —
not a hidden limitation.

You need the following already created: the dedicated `ed25519` SSH private key and the GitHub
Personal Access Token (both from section 1) — this step only registers them with the Broker, it
does not generate them.

To register a secret, write a script like this (adjust the values) and run it **once**, pointing
at the same `AGENTFORGE_DATA_DIR` the real processes will use:

Save the script as `seed-secret.mjs` **at the repository root** (the relative import below
depends on that location — it will not work if you move it elsewhere or run it outside the repo):

```javascript
// seed-secret.mjs — run with: node seed-secret.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MasterKeyStore, SecretStore } from "./packages/secrets-broker/dist/index.js";

const dataDir = process.env.AGENTFORGE_DATA_DIR ?? join(process.env.USERPROFILE, ".agentforge");
const masterKeyStore = new MasterKeyStore(join(dataDir, "secrets-broker", "master.key"));
const masterKey = await masterKeyStore.loadOrCreate();
const store = new SecretStore(join(dataDir, "secrets-broker", "secrets.enc.json"), masterKey);

// Example: SSH private key (kind "ssh-key") — the one generated in section 1
const sshKeyId = await store.create(
  "ssh-key",
  {
    privateKey: readFileSync(
      join(process.env.USERPROFILE, ".ssh", "agentforge_ed25519"),
      "utf-8",
    ),
  },
  undefined,
  "SSH key for my-host",
);
console.log("SSH key SecretId:", sshKeyId);

// Example: GitHub Personal Access Token (kind "token")
const tokenId = await store.create(
  "token",
  { value: "ghp_xxx..." },
  "github",
  "GitHub PAT for my account",
);
console.log("GitHub token SecretId:", tokenId);
```

Run this script from the repo root after `pnpm run build` (required because the import points
directly at the package's compiled `dist/`, not at a workspace-resolved package name), with
`AGENTFORGE_DATA_DIR` already set:

```
node seed-secret.mjs
```

Save the `SecretId` values it prints — you need them in sections 5 and 6 (`sshKeySecretId` and
`tokenSecretId`). Delete the script afterwards (or at least any plaintext token/key it contains) —
never leave it in the repository.

Available `SecretKind` values: `"api-key"`, `"token"`, `"credential"`, `"ssh-key"`, `"generic"`.

## 5. Configuring SSH hosts

Create `<AGENTFORGE_DATA_DIR>/execution-ssh/host-config.json`:

```json
{
  "hosts": [
    {
      "hostId": "my-host",
      "hostname": "192.0.2.10",
      "port": 22,
      "username": "agentforge",
      "sshKeySecretId": "<the SSH key SecretId from section 4>"
    }
  ],
  "commandTemplates": {
    "my-tool-identity": {
      "argv": ["systemctl", "restart", "{{service}}"]
    }
  }
}
```

- `hostId` is the identifier you pass when invoking a tool (the `hostId` parameter).
- `commandTemplates` is keyed by the tool's `identity` (the same `identity` you use in the
  Registry, section 7) — it never accepts free-form text from the agent (DEC-037): it only
  substitutes `{{parameter}}` with an already-typed value, never interpreting shell
  metacharacters.
- Always use an `ed25519` key dedicated to AgentForge, never your personal key (DEC-006).

## 6. Configuring the GitHub connector

Create `<AGENTFORGE_DATA_DIR>/connector-github/account-config.json`:

```json
{
  "accounts": [
    {
      "accountId": "my-github-account",
      "apiBaseUrl": "https://api.github.com",
      "tokenSecretId": "<the token SecretId from section 4>"
    }
  ],
  "operationTemplates": {
    "my-tool-create-issue": {
      "method": "POST",
      "path": "/repos/{{owner}}/{{repo}}/issues",
      "bodyFields": ["title", "body"]
    },
    "my-tool-list-issues": {
      "method": "GET",
      "path": "/repos/{{owner}}/{{repo}}/issues",
      "bodyFields": []
    }
  }
}
```

`operationTemplates` is keyed by `identity`, same as `commandTemplates` for SSH (DEC-062).
Operations supported today: `create_issue`, `list_issues`, `comment_on_issue` (fixed template,
never a free-form method/path/body from the agent).

## 7. Tool Registry

Every tool you want to expose to the agent needs an entry in
`<AGENTFORGE_DATA_DIR>/registry-cache.json` — an array of `ToolEntry` (DEC-016). There is no
automatic discovery against an external MCP server today — since AgentForge only has its own
tools (Execution SSH, Connector GitHub), you write this file yourself.

Example, matching the tools configured in sections 5 and 6:

```json
[
  {
    "identity": "my-tool-identity",
    "origin": { "id": "execution-ssh", "kind": "agentforge" },
    "qualifiedName": "execution-ssh:restart-service",
    "contract": {
      "description": "Restarts a systemd service on the configured remote host.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "hostId": { "type": "string" },
          "service": { "type": "string" }
        },
        "required": ["hostId", "service"]
      }
    },
    "schemaFingerprint": "manual-v1",
    "previousSchemaFingerprint": null,
    "stale": false
  },
  {
    "identity": "my-tool-create-issue",
    "origin": { "id": "connector-github", "kind": "agentforge" },
    "qualifiedName": "connector-github:create-issue",
    "contract": {
      "description": "Creates an issue in a GitHub repository.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "owner": { "type": "string" },
          "repo": { "type": "string" },
          "title": { "type": "string" },
          "body": { "type": "string" }
        },
        "required": ["owner", "repo", "title"]
      }
    },
    "schemaFingerprint": "manual-v1",
    "previousSchemaFingerprint": null,
    "stale": false
  }
]
```

Key points (DEC-016, see `architecture/ARCHITECTURE.md` §5):

- `identity` is the stable identifier used by Execution/Policy — it **must match exactly** the
  key used in `commandTemplates`/`operationTemplates` and in `riskByIdentity` (section 9).
- `origin.id` **must be** `"execution-ssh"` or `"connector-github"` — the MCP server routes
  execution by this field (DEC-058/059); any other value has no real backend behind it.
- `qualifiedName` is the name the agent sees in `tools/list` — the `origin:name` format is a
  convention, although the code does not strictly enforce it.
- `schemaFingerprint` is an observed hash of the contract — since this file is manual (no
  automatic discovery), you can use any stable string; it only matters if it changes between
  edits (it invalidates prior Policy Engine approvals, DEC-026).

## 8. Discovery: which tools are exposed to the agent

Create `<AGENTFORGE_DATA_DIR>/discovery-config.json` — only the tools listed here (by
`qualifiedName`) reach the agent via `tools/list`, even if they exist in the Registry
(DEC-018/DEC-021):

```json
{
  "activeQualifiedNames": [
    "execution-ssh:restart-service",
    "connector-github:create-issue"
  ]
}
```

## 9. Policy Engine: classifying risk

Create `<AGENTFORGE_DATA_DIR>/policy-config.json`. **Any `identity` not classified here requires
human confirmation by default** (DEC-023) — there is no way to skip this without classifying it
explicitly:

```json
{
  "riskByIdentity": {
    "my-tool-identity": "destructive",
    "my-tool-create-issue": "reversible-write"
  },
  "overrides": {}
}
```

- `"read-only"` → allowed automatically.
- `"reversible-write"` → allowed automatically (unless overridden with `"deny"`).
- `"destructive"` → requires synchronous human confirmation (section 15) every time the
  `schemaFingerprint` changes, or the first time after the Execution process starts (DEC-026 — the
  approval lives only in memory, it does not persist across restarts).
- `overrides` accepts `"allow"`/`"deny"` per `identity`, with no argument conditions (DEC-024).

## 10. Starting the processes, in order

Each process starts in its own terminal, with `AGENTFORGE_DATA_DIR` already set in that terminal
(repeat the `$env:AGENTFORGE_DATA_DIR = "..."` from section 3 in each one). From the repo root,
after `pnpm run build`:

**1. Secrets Broker** (always first — the others need it):

```
pnpm --filter @agentforge/secrets-broker run start
```

**2. Execution Backends** (whichever ones you're going to use; they can start in parallel with
each other, but after the Broker):

```
pnpm --filter @agentforge/execution-ssh run start
pnpm --filter @agentforge/connector-github run start
```

These two prompt for confirmation on the console whenever a `destructive` tool requires it
(section 15) — keep their terminal visible and focusable while the agent might invoke tools.

**3. MCP Server** — you normally **do not start this one yourself**: Claude Code launches it as a
subprocess (section 11). If you want to test it manually first, it starts the same way:

```
pnpm --filter @agentforge/mcp-server run start
```

It speaks exclusively over stdin/stdout with the MCP protocol (DEC-046) — it is not an
interactive tool for a human in a terminal.

**Optional — Dashboard** (section 14), at any time, independent of the rest:

```
pnpm --filter @agentforge/dashboard run start
```

Defaults to `http://127.0.0.1:4173` — change the port with `AGENTFORGE_DASHBOARD_PORT`.

## 11. Connecting AgentForge to Claude Code (MCP)

Register the MCP server in Claude Code with `claude mcp add`, pointing at the compiled `main.js`
and propagating `AGENTFORGE_DATA_DIR`:

```
claude mcp add agentforge -- node "C:\path\to\AgentForge\packages\mcp-server\dist\main.js"
```

If your shell does not carry `AGENTFORGE_DATA_DIR` into the process that launches Claude Code, set
it persistently in Windows' user environment variables, so the subprocess Claude Code starts sees
it too.

Before Claude Code can use tools that require confirmation, make sure
`execution-ssh`/`connector-github` (section 10, step 2) are already started independently — the
MCP server never launches them for you (DEC-047): if they are not running, any tool depending on
them fails in `resolveExecutionClient` with an explicit error, never silently.

## 12. Checking that everything works

With the Secrets Broker and the Execution Backends you plan to use already started:

1. Inside Claude Code, check that the `agentforge` server shows as connected (via Claude Code's
   own MCP server management UI).
2. Ask Claude to list the available tools — you should see the `qualifiedName` values you put in
   `discovery-config.json` (section 8).
3. Try a tool classified `"read-only"` or `"reversible-write"` first (section 9) to verify the
   no-confirmation path.
4. Try a `"destructive"` tool and confirm the prompt appears in the corresponding Execution
   Backend's terminal (section 15).

## 13. Using the tools from Claude Code

When you invoke a tool, its parameters are whatever you declared in `inputSchema` (section 7),
plus a special `hostId` parameter (used only by `execution-ssh`, to pick which host from
`host-config.json` to use — it is not part of your `inputSchema`, the MCP server extracts it
separately, see `resolveHostId`). The result the agent sees is JSON describing the execution
result (`ExecutionOutcome`): for SSH it includes `exitCode`/`stdout`/`stderr` (truncated,
DEC-040); for GitHub it includes `statusCode` and the response size (never the full body,
DEC-055/060). If the tool was denied, cancelled, or failed, the agent gets an explicit error
message instead of a result — never a silent, half-completed execution.

## 14. The Dashboard

A **read-only** web interface (DEC-064, no authentication, bound exclusively to `127.0.0.1` —
DEC-068, never expose it outside your own machine). It shows:

- `/` — main page.
- `/api/audit` — Audit Log events (section 16).
- The Registry's tool catalog and the Policy configuration (direct reads of the same files from
  sections 7 and 9 — DEC-064).

It does not let you run tools, manage secrets, or edit configuration — read-only only.

## 15. Human confirmation

When a tool is classified `"destructive"` (or unclassified — conservative default, section 9) and
the Policy Engine requires confirmation, the corresponding Execution process (`execution-ssh` or
`connector-github`) shows a prompt on **its own console** (not in Claude Code, not in the
Dashboard) like this:

```
Confirmation required (operation <hash>):
  host: <real hostname, from your host-config.json>
  command: <real resolved argv, from your commandTemplate>
Approve? [y/N]
```

- Answer `y` to approve; anything else (or nothing) denies it.
- There is a timeout (60 seconds by default in the Phase 16 entrypoints) — if you do not respond
  in time, it is denied automatically (DEC-038, deny by default).
- Every confirmation is single-use, bound exactly to that tool + those parameters + that host +
  that schema version (DEC-038) — it cannot be reused for a different invocation, not even of the
  same tool with a different parameter.
- You need that terminal focused and visible while the agent might invoke destructive tools — a
  known, documented design limitation (DEC-038), not a bug.

## 16. Audit Log

Each process writes its own events as append-only JSON Lines under
`<AGENTFORGE_DATA_DIR>/audit/`:

- `mcp-server.jsonl` — invocations received, policy decisions, cancellations.
- `execution-ssh.jsonl` — resolved confirmations, SSH execution results.
- `connector-github.jsonl` — the same, for GitHub operations.

They never contain secrets, keys, or the content of `stdout`/`stderr`/HTTP response — only
metadata (byte size, whether truncation happened, exit/status code) — DEC-055. You can inspect
them with any command-line tool (`jq`, `grep`) or view them formatted in the Dashboard (section
14). Writing is best-effort — a failure to write an event never blocks or reverts the real
operation (DEC-057). There is no automatic rotation or purging yet (section 19).

## 17. Stopping and restarting

Each process is a normal Node.js process — stop it with `Ctrl+C` in its terminal. There is no OS
service or built-in process manager (section 19).

Restarting `execution-ssh`/`connector-github` clears the in-memory confirmation registry — any
`destructive` tool will ask for confirmation again even if you had already approved it before the
restart (expected behavior, DEC-038 guarantee 2). Restarting the Secrets Broker does not affect
your secrets (persisted encrypted on disk) — only the in-memory state of the other processes is
lost.

## 18. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Claude Code sees no tools | Empty `discovery-config.json`, or `qualifiedName` mismatch with the Registry | Check sections 7 and 8 — names must match character for character |
| A tool fails with "No Execution Backend configured for origin ..." | `execution-ssh`/`connector-github` is not running, or `origin.id` in the Registry isn't exactly `"execution-ssh"`/`"connector-github"` | Start the missing process (section 10); check `origin.id` in `registry-cache.json` |
| A tool fails a policy check / is always denied | Unclassified `identity` in `policy-config.json`, or an explicit `override: "deny"` | Check section 9; remember that without classification the default result is `requires-confirmation`, not `deny` — if you see plain `deny`, there is an explicit override |
| The confirmation prompt never appears | The `execution-ssh`/`connector-github` terminal isn't focused, or the process isn't running | Verify the process is actually running and its console visible; also check you didn't change `AGENTFORGE_DATA_DIR` between terminals |
| The Secrets Broker can't find a secret (`Secret not found`) | The `SecretId` in `host-config.json`/`account-config.json` doesn't match the one created in section 4, or points at a different `AGENTFORGE_DATA_DIR` | Re-print the real `SecretId` with the script from section 4 and compare |
| `ENOENT` connecting to a pipe (`\\.\pipe\agentforge-...`) | The corresponding process isn't running yet | Start the process in the order from section 10 |
| The MCP server doesn't respond, or Claude Code marks it as down | Something wrote to stdout before the MCP frames, or the process wasn't launched with the correct `AGENTFORGE_DATA_DIR` | Make sure you use exactly `node dist/main.js` (never `pnpm run start` from inside Claude Code, which can print extra text); check inherited environment variables |
| I changed an `inputSchema` in the Registry and a tool that used to be allowed now asks for confirmation | A `schemaFingerprint` change automatically invalidates any prior approval (DEC-026) | Expected behavior, not a bug — confirm again |

## 19. Current limitations and Windows-only parts

- **Only verified on Windows.** The Linux/macOS branch of the IPC transport (named pipe on
  Windows / Unix domain socket on Linux-macOS, DEC-010) has never been implemented or tested on
  any real operating system — see `decisions/DECISIONS.md`, DEC-080.
- **No installer or OS service management.** Every process is started by hand in its own terminal
  (section 10) — no integration with Windows Task Scheduler or any service manager.
- **No secrets-administration CLI.** Registering a secret requires a short script (section 4), not
  a dedicated command.
- **No automatic tool discovery.** The Registry (section 7) is edited by hand — there is no
  process today that queries an external MCP server and fills `registry-cache.json`
  automatically.
- **No Audit Log rotation or purging.** The `.jsonl` files (section 16) grow indefinitely — manage
  them manually if size becomes a concern.
- **No authentication on the Dashboard.** Only reachable from the machine itself (`127.0.0.1`) —
  never expose it to the network.
- **No multi-user or multi-agent support.** A single MCP server session at a time (DEC-048); no
  discovery of multiple Execution Backend instances (DEC-047).
- **The Core↔Secrets Broker IPC channel (DEC-010) is still unimplemented** — this does not affect
  the real use described in this guide, because each Execution Backend talks to the Secrets
  Broker directly over a different, real channel (DEC-070).
- **The GitHub connector supports only 3 operations** (`create_issue`, `list_issues`,
  `comment_on_issue`) — any other GitHub API operation is not implemented.
- **No real remote system was touched while developing AgentForge** — the first time you run an
  SSH/GitHub tool against your real host/account is your responsibility, including verifying that
  the key/token you registered has the minimum necessary scope.
