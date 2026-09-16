# Claude Code — Anàlisi (què resol Claude Code vs. què és forat per a AgentForge)

**Estat:** Investigació completada. **Data:** 2026-09-16. **Font principal:**
`code.claude.com/docs/en/*` (docs oficials).

**Objectiu d'aquest document:** determinar amb precisió què gestiona ja bé Claude Code (per no
duplicar-ho a AgentForge) i què és clarament un forat que AgentForge hauria d'omplir.

---

## 1. Suport MCP a Claude Code

**FACT** — Suport MCP madur i de primer nivell.

- **Afegir servidors:** CLI (`claude mcp add`, `add-json`, `add-from-claude-desktop`), fitxers
  (`.mcp.json` a nivell de projecte, `~/.claude.json` a nivell d'usuari/local), o
  `.claude/settings.json` (`allowedMcpServers`/`deniedMcpServers`/`disableClaudeAiConnectors`).
- **Transports:** stdio, HTTP (recomanat per remot, suporta OAuth), SSE (deprecated però
  funcional), WebSocket (`"type":"ws"`, extensió pròpia de Claude Code — no és un binding
  estàndard de l'espec MCP, veure MCP-ANALYSIS.md §4).
- **Àmbits (ordre de resolució en cas de col·lisió de noms):** local (per defecte) → project
  (`.mcp.json`) → user (`~/.claude.json`) → plugin → connectors claude.ai.
- **Auth:** OAuth 2.0 interactiu o `claude mcp login` no interactiu; headers estàtics; script
  `headersHelper` (re-executat a cada connexió i en 401/403, cobreix esquemes no-OAuth com tokens
  curts o SSO intern). Interpolació de variables d'entorn amb **redacció deliberada** de credencials
  sensibles (`ANTHROPIC_API_KEY`) quan es referencien dins config MCP — evita fuites cap a
  servidors de tercers.
- **Aprovació d'eines:** diàleg de confiança per servidors de projecte en sessions interactives;
  llistes allow/deny per eina (`allowedMcpTools`/`deniedMcpTools`, patrons glob); política
  d'organització (`ask`/`blocked`) per connectors claude.ai.
- Existeix un servidor MCP local ocult (`ide`) quan l'extensió VS Code està activa: 2 eines
  exposades al model (`getDiagnostics`, `executeCode`), bind a `127.0.0.1`, autenticat per token en
  fitxer `0600`.

**Conclusió:** la infraestructura de client MCP (multi-transport, OAuth, àmbits, allow/deny per
eina) és profunda i activament mantinguda. **Construir un client MCP competidor seria pura
duplicació.** El valor afegit d'AgentForge, si n'hi ha, ha d'anar *per sobre* d'aquesta capa (p.ex.
registres cross-project) o en transports/backends que MCP no estandarditza (p.ex. un servidor MCP
propi per a SSH és legítim; un protocol de client nou no ho és).

---

## 2. CLAUDE.md / context de projecte

**FACT** — Dos sistemes: **CLAUDE.md** (instruccions escrites per l'usuari) i **auto memory**
(notes escrites per Claude mateix, tipades `user`/`feedback`/`project`/`reference`).

- **Ordre de càrrega** (de més ampli a més específic, es **concatenen, no se sobreescriuen**):
  policy gestionada (org) → `~/.claude/CLAUDE.md` (usuari) → `./CLAUDE.md` o `./.claude/CLAUDE.md`
  (projecte) → `./CLAUDE.local.md` (personal, gitignored).
- `.claude/rules/*.md`: mecanisme modular, opcionalment activat només per patrons de ruta
  (`paths:` al frontmatter) — més escalable que un sol CLAUDE.md gegant en repos grans.
- Import `@path/to/file` (profunditat màx. 4); imports externs requereixen aprovació.
- `AGENTS.md` **no es llegeix nativament** — cal importar-lo o fer symlink.
- **Explícitament NO és una capa d'aplicació forçosa**: "Settings rules are enforced by the
  client regardless of what Claude decides to do. CLAUDE.md instructions shape Claude's behavior
  but are not a hard enforcement layer." Els propis docs redirigeixen a hooks/`permissions.deny`
  per a aplicació real.

**Conclusió:** sistema de context ben dissenyat i en evolució activa. Res a duplicar. El límit que
Anthropic mateix marca (CLAUDE.md ≠ enforcement) és útil: assenyala on una capa com AgentForge
podria aportar valor real (hooks/permisos, no un altre CLAUDE.md).

---

## 3. Settings i permisos

**FACT**

- **Fitxers i precedència** (més alt a més baix): managed settings (org/MDM) → `claude
  --settings` (CLI) → `.claude/settings.local.json` (gitignored) → `.claude/settings.json`
  (compartit) → `~/.claude/settings.json` (usuari). La precedència és per clau, no per fitxer
  sencer.
- **Modes de permisos:** `default`/`manual`, `acceptEdits`, `plan` (només lectura), `auto`
  (classificador LLM en background revisa en lloc de l'usuari), `dontAsk`, `bypassPermissions`
  (documentat explícitament com "només per a sandboxes/VMs aïllades").
- **Ordre d'avaluació de regles:** deny → ask → allow, guanya la primera coincidència — l'especificitat
  mai canvia aquest ordre (un deny ampli sempre guanya sobre un allow estret).
- Regles Bash amb consciència real d'operadors de shell (`&&`, `||`, `;`, `|`, etc.) i
  "wrapper-stripping" (`timeout`, `nice`, `nohup`...) perquè les regles no es saltin trivialment —
  però **els propis docs d'Anthropic admeten que el pattern-matching de Bash és fràgil i no és una
  frontera de seguretat real**, i redirigeixen a sandboxing o hooks.
- **Sandboxing natiu (Bash tool):** aïllament real a nivell de SO — macOS Seatbelt, Linux/WSL2
  bubblewrap. Aïllament de sistema de fitxers i xarxa (proxy amb allowlist de dominis). És
  aplicació real, no pattern-matching — però és **opt-in, només per l'eina Bash local, i
  Windows no apareix documentat com a plataforma suportada** (a verificar directament).

**Conclusió:** motor de permisos sofisticat i sandboxing real ja existeixen. Duplicar-los seria
esforç malbaratat. Forats reals: (a) el sandboxing no cobreix crides a eines MCP ni execució
remota/SSH, només Bash local; (b) l'estat de permisos és configuració per màquina/repo, no un
servei de política central i consultable a través de múltiples agents/màquines.

---

## 4. Hooks

**FACT** — El mecanisme real d'aplicació/extensibilitat de Claude Code (els propis docs de
permisos hi redirigeixen).

- ~25 punts del cicle de vida agrupats per cadència: sessió (`SessionStart`/`SessionEnd`), torn
  (`UserPromptSubmit`, `Stop`...), bucle d'eines per crida (`PreToolUse` — pot bloquejar —,
  `PostToolUse`...), agent/tasca (`SubagentStart`/`Stop`...), entorn (`FileChanged`,
  `ConfigChange`...), model (`PreModelSwitch`, `PreCompact`...), MCP (`Elicitation`).
- 5 tipus de handler: `command` (shell), `http` (POST amb headers/env allowlisted), `mcp_tool`
  (crida a una eina d'un servidor MCP connectat), `prompt` (avaluació LLM d'un sol torn), `agent`
  (genera un subagent de verificació — experimental).
- Contracte I/O: JSON per stdin, decisió per exit code o JSON per stdout. Exit 2 = bloqueig dur.
- **Controls de seguretat:** `allowManagedHooksOnly` (l'admin pot restringir l'execució de hooks
  només a policy gestionada), allowlists per URL/env de hooks HTTP, kill switch
  `disableAllHooks`. Els hooks gestionats no es poden desactivar des de nivells de precedència
  més baixos.

**Conclusió:** els hooks són el punt d'intercepció genèric més potent que ja existeix — un hook
`PreToolUse`/`PostToolUse` apuntant a un servei de política d'AgentForge ja cobriria bona part de
la història de "accés controlat a eines" sense que AgentForge hagi d'estar in-process. El que els
hooks **no** donen: un log d'auditoria persistent, consultable i centralitzat entre moltes
sessions/màquines (són fire-and-forget llevat que es construeixi un sink propi), ni coordinació
entre múltiples sessions concurrents de Claude Code.

---

## 5. Subagents

**FACT** — Definits com a Markdown+YAML a `.claude/agents/` (projecte) o `~/.claude/agents/`
(usuari), amb `tools`/`disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`,
`mcpServers`, `hooks` propis (amb àmbit limitat a la vida del subagent), `memory`
(`user`/`project`/`local`), `background`, `isolation: worktree`.

**Conclusió:** primitiva multi-agent madura i de primer nivell **dins d'una sola sessió**. No és
el mateix que orquestració multi-agent entre sessions o màquines diferents — els subagents viuen i
moren dins del procés pare (`background: true` segueix sent la mateixa màquina). Aquest és un límit
clar i rellevant per AgentForge si es vol orquestració entre Windows/Debian/Contabo.

---

## 6. Skills / slash commands

**FACT** — Unitat moderna: **Skill** (directori amb `SKILL.md` + fitxers de suport opcionals), a
`~/.claude/skills/` o `.claude/skills/`. Invocació automàtica (matching de `description`) o
explícita (`/nom-skill`). Els antics `.claude/commands/*.md` encara funcionen però estan
formalment substituïts ("Custom commands are now skills").

**Conclusió:** és el mecanisme d'empaquetament/reutilització de **procediments** de Claude Code —
se solapa amb allò que una capa de "tool discovery" d'AgentForge podria intentar fer per a
procediments, però és a nivell de prompt/markdown, no un registre d'eines/capacitats amb schemas
tipats com MCP. Si el "tool discovery" d'AgentForge és sobre eines *executables*, no hi ha
competència directa; si és sobre fluxos de treball reutilitzables, sí hi ha solapament a tenir en
compte.

---

## 7. Gestió de secrets

**FACT**

- **Emmagatzematge de credencials pròpies:** macOS → Keychain xifrat (fallback a
  `~/.claude/.credentials.json` mode `0600`). Linux → `~/.claude/.credentials.json` (`0600`).
  **Windows → `%USERPROFILE%\.claude\.credentials.json`, basat en ACLs de perfil d'usuari, sense
  integració documentada amb cap magatzem de credencials natiu de Windows.**
- Precedència d'autenticació de 7 nivells (variables de proveïdor de núvol → `ANTHROPIC_AUTH_TOKEN`
  → `ANTHROPIC_API_KEY` → `apiKeyHelper` script → `CLAUDE_CODE_OAUTH_TOKEN` → credencials de
  proveïdor/WIF → OAuth de subscripció).
- **Sense rotació, vaulting o gestió multi-secret integrada** més enllà d'`apiKeyHelper` — aquest
  hook és explícitament el punt d'extensió perquè l'usuari porti el seu propi vault/rotació.
- Les credencials dels servidors MCP es gestionen per separat (`headersHelper`, OAuth, headers
  estàtics) — un mecanisme paral·lel, no unificat amb l'stack d'auth de la CLI.

**Conclusió:** Claude Code assegura bé les **seves pròpies** credencials, però delega
explícitament la gestió general de secrets/vault a eines externes via hooks de tipus "shell-out".
No hi ha cap magatzem de secrets unificat entre eines/servidors MCP/màquines, ni orquestració de
rotació. **Aquest és un forat legítim i ben delimitat per a AgentForge** (un "broker de secrets"
darrere d'aquests punts d'extensió).

---

## 8. Integració amb VS Code

**FACT**

- L'extensió oficial (`anthropic.claude-code`) és una capa GUI prima que **empaqueta la seva
  pròpia còpia privada de la CLI** — instal·lar l'extensió no posa `claude` al PATH.
- Afegeix: diff inline costat a costat, documents Markdown de plan-mode amb comentaris inline,
  @-mention de fitxers/seleccions, checkpoints (rebobinar conversa i/o codi), cerca d'historial
  incl. sessions cloud, mapa d'agents en viu, pont amb extensió de Chrome (`@browser`), GUI de
  marketplace de plugins.
- El servidor MCP `ide` intern és com l'extensió obté el diff nadiu, context de selecció actual, i
  execució de cel·les Jupyter — sempre amb confirmació addicional a nivell d'UI que els hooks no
  poden saltar-se.

**Conclusió:** l'extensió VS Code és ergonomia sobre el mateix motor CLI — no és una superfície de
capacitats diferent per a accés a eines. No canvia la història de MCP/permisos/hooks; la
**consumeix**. No sembla necessari treball d'integració específic per a l'IDE més enllà del que ja
flueix per `settings.json`.

---

## 9. Claude Agent SDK

**FACT** — Llibreria Python/TypeScript que exposa **el mateix bucle d'agent, conjunt d'eines,
gestió de context, hooks, subagents, client MCP, permisos, sessions, skills/commands/memory i
sistema de plugins que fan funcionar Claude Code mateix** — "Claude Code com a llibreria".

- Comparativa pròpia d'Anthropic: Agent SDK per construir un agent sense implementar el bucle
  d'eines; CLI de Claude Code per ús interactiu de terminal; Client SDK cru si vols implementar tu
  mateix el bucle; Managed Agents (producte allotjat separat) si no vols gestionar
  sandbox/infraestructura de sessió.
- **Restricció de marca notable:** els productes construïts amb l'SDK **no poden** dir-se "Claude
  Code" ni fer servir la seva marca, i no poden oferir login claude.ai — han d'usar autenticació
  per API key.
- Carrega `.claude/` i `~/.claude/` de la mateixa manera que Claude Code.

**Rellevància per AgentForge (troballa arquitectònicament més significativa d'aquest bloc):**
Anthropic ofereix un **camí de primer nivell suportat per construir un producte d'agent
personalitzat sobre les mateixes primitives** (eines, MCP, hooks, permisos, subagents) que Claude
Code usa, en lloc d'embolcallar/cridar la CLI `claude` com a subprocés. Hi ha tres opcions
arquitectònicament diferents amb perfils de risc molt diferents:

- **(a) Embolcallar la CLI** com a subprocés (`-p`/`--output-format json`) — documentat i
  suportat, però lligat al cicle de vida del procés CLI i amb frontera text/JSON.
- **(b) Construir directament sobre l'Agent SDK** — APIs natives de hooks/permisos/MCP/subagents
  sense overhead de procés CLI, a costa de ser un **producte separat** (no pot dir-se Claude Code,
  sense login claude.ai).
- **(c) Estendre Claude Code in-place** purament via els seus punts d'extensió existents (hooks,
  servidors MCP, settings, plugins) sense construir un runtime d'agent separat.

**PROPOSAL:** l'opció (c) és el camí de menys duplicació si l'objectiu és genuïnament "al costat
de Claude Code" i no "una alternativa a Claude Code". Aquesta decisió s'hauria de prendre
deliberadament al document d'arquitectura, no heretar-se implícitament.

**NOT VERIFIED:** implicacions de preu/rate-limit de l'SDK; si les sessions Agent SDK poden
interoperar en viu amb una sessió CLI de Claude Code ja en marxa (els docs només confirmen que
llegeixen el mateix directori `.claude/` en disc, no interoperabilitat en viu).

---

## 10. Anàlisi de forats (gap analysis)

### Ja resolt bé per Claude Code — AgentForge NO ho hauria de reconstruir

| Àrea | Per què està resolt |
|---|---|
| Client MCP (transports, àmbits, OAuth, allow/deny per eina) | Profund, mantingut activament, cobreix casos límit difícils |
| Càrrega de context de projecte (CLAUDE.md, rules, imports, auto memory) | Complet, escala a monorepos, es recarrega després de compactar |
| Motor de permisos local (regles allow/ask/deny, precedència, matching de comandes compostes) | Molt granular, casos límit documentats |
| Sandboxing local de Bash (Seatbelt/bubblewrap) | Aplicació real a nivell de SO, no només pattern-matching |
| Hooks (25 punts del cicle de vida, 5 tipus de handler) | Ja és l'API d'intercepció/política de facto |
| Subagents (multi-agent dins d'una sessió) | Madur, cobreix "agent especialitzat amb eines restringides" dins d'una sessió |
| Skills/slash commands (procediments reutilitzables) | Cobreix la necessitat de "flux de treball empaquetat" |
| Gestió de credencials pròpies (keychain, precedència, hook de rotació) | Resol bé la clau API pròpia de Claude Code |
| Integració IDE | Capa GUI prima sobre el mateix motor |
| "Construir un agent personalitzat sobre les mateixes primitives" | L'Agent SDK és el camí sancionat de primer nivell |

### Clarament fora de l'abast de Claude Code — forats genuïns per a AgentForge

1. **L'execució d'eines remota/SSH no és de primer nivell.** L'eina Bash de Claude Code corre
   localment; existeixen trucs (`CLAUDE_CODE_SHELL`) i scripts de comunitat (no oficials) per
   redirigir Bash cap a SSH, però sense manteniment d'Anthropic i amb riscos reals (les regles de
   sandbox/permisos es van escriure assumint execució local; l'execució remota salta per complet
   el model d'aïllament fs/xarxa del sandbox). **Aquest és territori clar d'AgentForge**: un
   servidor MCP propi (o un interceptor basat en hooks) per a execució SSH controlada, auditada i
   amb permisos, diferent de la funcionalitat "Remote Control" de Claude Code (que sembla ser
   *handoff/control de sessió* entre terminal local i client navegador/mòbil, no *execució remota
   d'eines* — **NOT VERIFIED** l'abast exacte, cal confirmar-ho).
2. **Cap registre d'eines/capacitats cross-project o cross-organització.** Els servidors MCP es
   configuren per projecte o per usuari; els marketplaces de plugins distribueixen *paquets*, no
   un registre viu i consultable d'eines disponibles a través de molts repos/equips.
3. **Cap log d'auditoria fi, centralitzat i entre sessions.** Els hooks poden escriure a qualsevol
   sink, però Claude Code mateix no agrega l'historial de crides a eines entre moltes
   sessions/màquines/usuaris en un rastre d'auditoria consultable.
4. **Cap orquestració de rotació de secrets ni vault unificat entre servidors MCP.**
   `apiKeyHelper` i `headersHelper` són hooks de "shell-out" d'un sol propòsit cadascun; res
   coordina rotació entre N servidors MCP + la credencial pròpia de la CLI + política
   d'organització.
5. **Cap gestió de sessions multi-agent més enllà d'un sol procés CLI.** Els subagents estan
   limitats a la sessió/procés pare; no hi ha concepte natiu d'orquestrar múltiples sessions
   independents de Claude Code (potencialment en màquines diferents) com una flota coordinada.
6. **El sandboxing no cobreix les crides a eines MCP**, només l'eina Bash, i sembla limitat a
   macOS/Linux/WSL2 (**NOT VERIFIED** per a Windows natiu) — una eina MCP que fa crides de xarxa o
   escriu fitxers no està restringida pel sandbox de Claude Code en absolut.
7. **L'emmagatzematge de secrets a Windows no té integració real amb un vault de SO** (ACLs NTFS
   sobre un JSON, no DPAPI/Credential Manager) — forat menor, més d'Anthropic que d'AgentForge,
   però rellevant si AgentForge vol oferir millors garanties de secrets-at-rest a Windows.

### Límits que el propi Anthropic marca (útils com a marc de referència)

- "Settings rules are enforced by the client regardless of what Claude decides to do. CLAUDE.md
  instructions shape Claude's behavior but are not a hard enforcement layer." — Anthropic mateix
  separa guia a nivell de prompt (CLAUDE.md, skills) d'aplicació forçosa real
  (settings/hooks/sandbox). AgentForge hauria d'adoptar el mateix marc en lloc d'intentar que
  CLAUDE.md faci feina d'aplicació.
- Els docs de permisos Bash admeten explícitament que el seu pattern-matching "és fràgil" i
  redirigeixen a sandboxing o hooks per a garanties reals — Anthropic mateix indica on és la
  frontera de confiança real, cosa útil per decidir on ha d'enganxar-se AgentForge.

---

## Punts pendents de verificació abans de prendre decisions

- Si Claude Code ha afegit des d'aleshores execució remota/SSH de primer nivell (revisar
  `code.claude.com/docs/en/mcp` i cthe changelog periòdicament).
- Abast exacte de la funcionalitat "Remote Control" (handoff de sessió vs. execució remota
  d'eines).
- Suport de sandboxing natiu a Windows.
- Interoperabilitat en viu entre una sessió Agent SDK i una sessió CLI de Claude Code en marxa.

## Fonts

Vegeu `docs/research/SOURCES.md` per la llista consolidada amb URL, extracció i confiança.
