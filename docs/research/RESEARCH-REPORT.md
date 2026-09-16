# RESEARCH-REPORT.md — AgentForge Fase 0

**Data:** 2026-09-16. **Fase:** Technical Research & Bootstrap. Aquest és el document principal de
conclusions. Detall complet a `COMPOSIO-ANALYSIS.md`, `MCP-ANALYSIS.md`,
`CLAUDE-CODE-ANALYSIS.md` i `research/SSH-SECURITY-NOTES.md`.

---

## 0. Resum executiu

AgentForge es planteja com una infraestructura pròpia perquè Claude Code (i potencialment altres
agents) puguin usar eines locals i remotes de manera controlada. La investigació d'aquesta fase
conclou:

1. **Composio no és un model a copiar directament** — és "SDK obert, plataforma tancada": codi
   client MIT sobre un backend SaaS propietari. El valor real per AgentForge és **conceptual**
   (patrons de Session, Provider, meta-tools), no codi reutilitzable.
2. **Claude Code ja resol molt més del que el brief original assumia** — MCP client, permisos,
   hooks, subagents, skills, sandboxing local, gestió de credencials pròpies són tots madurs i
   activament mantinguts. **El forat real d'AgentForge és estret i específic**: execució
   remota/SSH controlada i auditada, un registre d'eines cross-project, gestió de secrets
   unificada entre eines/servidors, i un log d'auditoria centralitzat entre sessions.
3. **MCP ha canviat significativament** (espec `2026-07-28`, fa ~7 setmanes en el moment
   d'aquesta investigació): protocol stateless, sampling i roots deprecats, nou marc d'extensions.
   Qualsevol integració MCP d'AgentForge s'ha de dissenyar contra aquesta versió, decidint
   explícitament si cal suport "dual-era" per interoperar amb l'ecosistema existent (probablement
   encara majoritàriament "legacy").
4. **L'arquitectura de gateway/broker** (una capa que s'interposa entre l'agent i la infraestructura,
   mai deixant que l'LLM tingui credencials directes ni construeixi comandes lliurement) és el
   patró de disseny amb més suport a la literatura de seguretat per a exactament el problema que
   AgentForge vol resoldre.

---

## 1. Composio — conclusions clau

Detall: `COMPOSIO-ANALYSIS.md`.

- **FACT** — MIT-llicenciat (repo), però el backend (execució d'eines, credencials, cerca del Tool
  Router) és propietari i no està al repo públic. No es pot fer fork per obtenir un sistema
  autoallotjat equivalent.
- **`LEGAL REVIEW REQUIRED`** — Inconsistència MIT (LICENSE) vs. ISC (CONTRIBUTING.md) — risc baix
  però a no replicar.
- **FACT** — El "Tool Router" (mecanisme de reducció de proliferació d'eines) és el concepte més
  rellevant per a l'objectiu d'AgentForge de "descoberta d'eines" — però el seu algorisme de cerca
  no és públic.
- **PROPOSAL** — AgentForge hauria de tractar Composio com a font d'inspiració arquitectònica
  (Session bundling identitat+eines+auth+estat; Provider abstraction agentic/non-agentic;
  meta-tools com a control-plane petit en lloc d'exposar centenars d'eines), no com a base de codi.
- **NOT VERIFIED** — Si Composio realment no suporta autoallotjament (pàgina de preus silenciosa,
  cap confirmació oficial trobada) — rellevant només si en algun moment es considera Composio com a
  alternativa a construir des de zero.

---

## 2. MCP — conclusions clau

Detall: `MCP-ANALYSIS.md`.

- **FACT** — Versió actual `2026-07-28`: reescriptura trencadora, stateless, sense handshake
  `initialize` ni sessions de protocol. Terminologia "Modern"/"Legacy"/"Dual-era".
- **FACT** — Sampling i Roots estan **deprecats** (finestra mínima de 12 mesos) — no construir cap
  dependència central en aquests dos mecanismes.
- **FACT** — L'espec té una secció de seguretat robusta (confused deputy, token passthrough, SSRF,
  state handle hijacking, compromís de servidor local, mix-up attacks) directament aplicable si
  AgentForge exposa un gateway MCP propi.
- **FACT** — Governança neutral des de desembre 2025 (Agentic AI Foundation / Linux Foundation) —
  MCP ja no és un projecte exclusiu d'Anthropic, cosa que dona més confiança de continuïtat a llarg
  termini per construir-hi a sobre.
- **PROPOSAL** — Decidir explícitament abast "Modern-only" vs. "Dual-era" abans d'implementar cap
  client/servidor MCP propi.

---

## 3. Claude Code — conclusions clau

Detall: `CLAUDE-CODE-ANALYSIS.md`.

- **FACT** — Claude Code ja té: client MCP madur, motor de permisos granular, sandboxing real
  (Bash, macOS/Linux/WSL2), ~25 punts de hook amb 5 tipus de handler (incl. HTTP i MCP tool),
  subagents amb àmbit d'eines/model/memòria, skills, gestió de credencials pròpies amb hook de
  rotació.
- **FACT** — Els propis docs d'Anthropic marquen la línia: CLAUDE.md ≠ enforcement; el pattern-matching
  de permisos Bash ≠ frontera de seguretat real — ambdós redirigeixen a hooks/sandboxing.
- **FACT** — L'Agent SDK permet construir un producte d'agent separat sobre les mateixes
  primitives sense passar per la CLI — però amb restriccions de marca (no es pot dir "Claude
  Code").
- **Forats confirmats per a AgentForge:**
  1. Execució remota/SSH no és de primer nivell (només workarounds comunitaris no mantinguts).
  2. Cap registre d'eines/capacitats cross-project o cross-organització.
  3. Cap log d'auditoria centralitzat entre sessions/màquines.
  4. Cap orquestració de rotació de secrets ni vault unificat entre servidors MCP.
  5. Cap gestió de sessions multi-agent més enllà d'un sol procés CLI (sense flota multi-màquina).
  6. El sandboxing no cobreix crides a eines MCP, només Bash local.
- **PROPOSAL** — El camí de menys duplicació és **(c)**: estendre Claude Code in-place via els
  seus propis punts d'extensió (hooks, servidors MCP, settings) en lloc de (a) embolcallar la CLI
  com a subprocés o (b) construir un producte separat sobre l'Agent SDK. Aquesta decisió s'hauria
  de prendre deliberadament, no heretar-se implícitament.

---

## 4. SSH / execució remota / seguretat — conclusions clau

Detall: `research/SSH-SECURITY-NOTES.md`.

- **FACT** — ed25519 com a tipus de clau per defecte; mai agent forwarding (usar ProxyJump si cal
  saltar per un host intermedi); `known_hosts` fixat manualment/fora de banda abans de qualsevol
  connexió automatitzada, `StrictHostKeyChecking yes` en estat estacionari.
- **FACT** — `authorized_keys` amb `command=`/`restrict` és la primitiva Unix estàndard per
  convertir una clau SSH en credencial d'automatització d'un sol propòsit.
- **FACT** — OWASP LLM06 (Excessive Agency) fa que un `execute_command(string)` genèric sigui
  gairebé un exemple de llibre de text de risc. La literatura convergeix cap a eines
  estructurades/parametritzades amb l'orquestrador (no l'LLM) construint la comanda real.
- **PROPOSAL** — Classificació d'accions en 3 nivells (només lectura → auto-execució; escriptura
  reversible → allowlist explícita; destructiu → confirmació humana síncrona sempre), aplicada en
  codi que l'LLM no pot alterar.
- **PROPOSAL** — Windows Credential Manager per a la clau SSH; SOPS+age (o similar) per a altres
  credencials — Vault/eines empresarials són sobredimensionades per a un sol desenvolupador.
- **NOT VERIFIED** — Si la protecció de Windows Credential Manager és adequada específicament
  contra un actor d'amenaça que és el propi procés de l'agent LLM (no un atacant remot) — **pregunta
  de disseny oberta**.
- **FACT** — El patró "AI Agent Gateway" (broker centralitzat, frontera de confiança separada de
  l'agent, l'agent mai té les claus) és exactament la forma que sembla que AgentForge es proposa
  tenir.

---

## 5. Comparació d'opcions

| Dimensió | Opció | Avaluació |
|---|---|---|
| Base de codi per a tool-infra | Fork/adaptar Composio | **Descartat** — el codi útil (execució, credencials, cerca) no és al repo OSS |
| Base de codi per a tool-infra | Construir des de zero sobre MCP + Claude Code hooks | **Recomanat a explorar** — reutilitza tota la infraestructura MCP/permisos/hooks que Claude Code ja té |
| Integració amb Claude Code | Wrap CLI com a subprocés | Viable però lligat al cicle de vida del procés |
| Integració amb Claude Code | Agent SDK (producte separat) | Viable si es vol un producte diferent, no "al costat de" |
| Integració amb Claude Code | Extensió in-place (hooks + MCP servers propis) | **Recomanat a explorar** — menys duplicació, aprofita tot el que Claude Code ja resol |
| Accés remot | Shell genèric via SSH | **Descartat com a patró per defecte** — risc Excessive Agency alt |
| Accés remot | Eines específiques amb allowlist + SSH restringit (`command=`) | **Recomanat a explorar** — híbrid amb un "execute" molt restringit i sempre confirmat com a fallback |
| Gestió de secrets | Vault/eina empresarial | **Descartat per a fase 1** — sobredimensionat per a un sol desenvolupador |
| Gestió de secrets | Windows Credential Manager + SOPS/age | **Recomanat a explorar** |

---

## 6. Classificació global A/B/C/D/E

### A — REUTILITZAR
- Cap component de codi identificat que es recomani reutilitzar/copiar directament (ni de Composio
  ni d'altra font investigada aquesta fase). Els servidors de referència MCP oficials
  (`modelcontextprotocol/servers`, dual-llicenciats Apache/MIT) podrien servir com a punt de
  partida d'aprenentatge si AgentForge construeix un servidor MCP propi, però són explícitament
  "exemples educatius, no solucions de producció".

### B — ADAPTAR
- Generadors de scaffolding de provider de Composio (`pnpm create:provider`) — únic candidat
  plausible de reutilització literal, pendent de revisió del codi font real (secció 9.7 de
  COMPOSIO-ANALYSIS.md).

### C — INSPIRACIÓ
- Model de Session de Composio (identitat + eines + auth + estat d'execució en un objecte
  adreçable).
- Abstracció Provider de Composio (agentic vs. non-agentic framework adapters).
- Patró de meta-tools de Composio (`COMPOSIO_SEARCH_TOOLS` i similars) com a resposta al problema
  de "tool discovery"/reducció de context.
- Patró "sandbox local + pla de control remot" de Composio (execució queda local, credencials/
  enrutament es queden centralitzats).
- Patró "AI Agent Gateway" de la literatura de seguretat general (broker amb frontera de confiança
  separada de l'agent).
- Classificació d'accions en 3 nivells per risc/reversibilitat (HITL literature).
- Ús de hooks de Claude Code (`PreToolUse`/`PostToolUse` amb handler HTTP) com a punt d'intercepció
  cap a un futur servei de política d'AgentForge, en lloc de construir un motor de permisos
  competidor.

### D — DESCARTAR
- Fer fork o construir sobre el repo de Composio directament (el valor no hi és).
- Un servidor MCP fix d'un sol toolkit sense descoberta dinàmica (patró que el propi Composio
  desaconsella).
- Una eina genèrica `execute_command(string)` com a via principal d'accés remot (risc Excessive
  Agency).
- Agent forwarding SSH en qualsevol topologia.
- Dependre de MCP sampling o roots com a mecanisme central (ambdós deprecats).
- Un motor de política/permisos complet a l'estil OPA per a la fase 1 (sobredimensionat per a un
  sol desenvolupador/dues màquines).
- Vault/gestor de secrets empresarial per a la fase 1.

### E — INVESTIGAR MÉS
- Algorisme real de cerca/ranking del Tool Router de Composio (no divulgat).
- Si Composio suporta autoallotjament de facto (reclams contradictoris, sense confirmació
  oficial).
- Versions reals d'OpenSSH al servidor Debian de casa i al VPS Contabo (determina disponibilitat
  d'ed25519/certificats).
- Adequació de Windows Credential Manager (DPAPI) contra el model d'amenaça específic d'"agent LLM
  al mateix procés/màquina".
- Suport de sandboxing natiu de Claude Code a Windows (només confirmat macOS/Linux/WSL2).
- Abast exacte de la funcionalitat "Remote Control" de Claude Code (handoff de sessió vs. execució
  remota d'eines).
- Llista completa i actualitzada d'SDKs oficials MCP (Go, C#, Rust, Kotlin, i l'existència de
  Java/Swift/Ruby/PHP no verificada).
- Estat de maduresa del Registre oficial MCP (preview vs. GA) — fetch directe sense contingut
  durant aquesta investigació.
- Verificació directa contra NVD/MITRE de qualsevol CVE relacionat amb MCP abans de citar-lo.

---

## 7. Riscos i advertències transversals

- **`LEGAL REVIEW REQUIRED`** — Inconsistència de llicència MIT/ISC a Composio (risc baix, nota
  informativa).
- Cap altre problema de llicència detectat en aquesta fase (SDKs MCP sota MIT/Apache 2.0, docs de
  Claude Code i OWASP són material de referència pública sense restricció de reutilització
  d'idees).
- La versió `2026-07-28` de MCP és molt recent (~7 setmanes) — alt risc que la majoria de
  servidors MCP de tercers existents encara no la parlin; cal validar interoperabilitat abans de
  triar-la com a únic objectiu.
- Els CVE de seguretat de MCP citats en fonts secundàries **no** s'han verificat contra NVD/MITRE
  — no citar-los com a confirmats sense aquesta verificació.
- Amenaça no resolta per cap font trobada: protecció de secrets locals (Windows) específicament
  contra el propi procés de l'agent LLM com a actor d'amenaça — s'ha de tractar com a pregunta de
  disseny oberta a `architecture/ARCHITECTURE-DRAFT.md`, no com a resolta.

---

## 8. Següent pas

Redactar `architecture/ARCHITECTURE-DRAFT.md` (proposta, no decisió) recollint aquestes
conclusions, i actualitzar `STATE.md`.
