# MCP (Model Context Protocol) — Analysis

**Estat:** Investigació completada (1 de 4 blocs). **Data de la investigació:** 2026-09-16.
**Confiança general:** Alta per a l'espec oficial (fonts primàries a modelcontextprotocol.io i
GitHub oficial). Mitjana/baixa per a alguns punts marcats explícitament.

> ⚠️ **TROBALLA IMPORTANT:** La versió actual de l'espec MCP (`2026-07-28`) és una **reescriptura
> arquitectònica important i incompatible** respecte a la versió que la majoria de tutorials/blocs
> descriuen (`2025-11-25` i anteriors). Elimina el handshake `initialize`, les sessions a nivell de
> protocol (`Mcp-Session-Id`), i fa el protocol completament **stateless** (cada request porta la
> seva pròpia versió/capabilities). Qualsevol decisió d'arquitectura d'AgentForge s'ha de validar
> contra aquesta versió específica, no contra material desactualitzat.

---

## 1. Especificació i versionat

- **FACT** — Versió actual: `2026-07-28` (anterior: `2025-11-25`). Font de veritat: `schema.ts` al
  repo `modelcontextprotocol/specification`. Versionat per data (`YYYY-MM-DD`), no semver, pel
  wire protocol; els SDKs sí segueixen semver per separat.
- **FACT** — Procés formal de propostes (SEP) via PRs a `seps/`, amb un registre de
  característiques "deprecated" i una **política de cicle de vida**: Active → Deprecated →
  Removed, amb finestra mínima de **12 mesos** de deprecació.
- **FACT** — Governança: l'desembre de 2025 Anthropic va donar MCP a la nova **Agentic AI
  Foundation (AAIF)**, un fons dirigit sota la **Linux Foundation**, amb membres platinum com AWS,
  Anthropic, Block, Bloomberg, Cloudflare, Google, Microsoft i OpenAI. MCP ja **no és un projecte
  exclusiu d'Anthropic**, sinó infraestructura governada de forma neutral.
- **FACT** — Adopció: OpenAI (març 2025, Agents SDK/Responses API/ChatGPT desktop), Google
  DeepMind (Gemini, abril 2025), Microsoft (preview a Windows 11, Build 2025).

### Negociació de versió (trencadora al 2026-07-28)
- El vell handshake `initialize`/`notifications/initialized` i les sessions de protocol
  **s'eliminen**. Cada request porta versió/capabilities en camps `_meta`.
- Servidors han d'implementar `server/discover`; clients poden consultar-ho abans o reaccionar a
  `UnsupportedProtocolVersionError` (codi `-32022`).
- Terminologia: **"Modern"** (2026-07-28+), **"Legacy"** (2025-11-25 i anteriors),
  **"Dual-era"** (suporta ambdós). Hi ha una matriu de compatibilitat client/servidor publicada.

---

## 2. Arquitectura

- **FACT** — Model **client-host-server**, sense canvis conceptuals respecte a versions anteriors:
  - **Host**: contenidor/coordinador (p.ex. Claude Code) — crea/gestiona múltiples clients,
    aplica política de seguretat, gestiona autorització d'usuari, coordina l'LLM.
  - **Client**: creat pel host, relació **1:1 amb un sol servidor**.
  - **Server**: exposa resources/tools/prompts, opera independentment; pot ser local o remot.
- Principis de disseny (inalterats): servidors fàcils de construir, altament composables, sense
  visibilitat de tota la conversa ni d'altres servidors, addició progressiva de funcionalitats amb
  compatibilitat enrere.
- Base: JSON-RPC 2.0, ara explícitament "stateless, self-contained requests".

---

## 3. Primitives principals

### Tools (controlades pel model)
- `inputSchema`/`outputSchema` en JSON Schema (per defecte 2020-12, draft-07 també suportat).
  `outputSchema` + `structuredContent` afegits per a resultats estructurats.
- Invocació no-streaming (`tools/call`), però amb un nou patró **MRTR (Multi Round-Trip
  Requests)**: el servidor pot retornar `resultType: "input_required"` per pausar una crida
  (p.ex. per elicitation o sampling) i el client la reprèn amb un nou id + `requestState` opac.
  Això **substitueix** el model anterior de requests bidireccionals no sol·licitades pel client.
- Dos nivells d'error: errors de protocol (JSON-RPC) vs. errors d'execució de l'eina
  (`isError: true` dins d'un resultat normal, pensat perquè l'LLM s'autocorregeixi).
- `x-mcp-header`: permet mapar paràmetres a headers HTTP per a intermediaris de xarxa (mai per a
  secrets).

### Resources (dirigides per l'aplicació)
- Identificades per URI (RFC 3986): `file://`, `git://`, `https://`, esquemes personalitzats.
- El model de subscripció antic (`resources/subscribe` + SSE) **es reemplaça** per
  `subscriptions/listen`, un únic stream llarg on el client s'apunta a tipus de notificació
  concrets.

### Prompts (controlats per l'usuari)
- Seleccionats explícitament per l'usuari (p.ex. com a slash commands); `prompts/list`/`get`,
  amb autocompletar d'arguments.

### Sampling — **DEPRECATED** (SEP-2577, des de 2026-07-28)
- Es manté a l'espec ≥12 mesos però "les noves implementacions NO haurien d'adoptar-lo". Recomanació
  de migració: integrar directament amb l'API del proveïdor LLM.
- **Implicació per AgentForge:** construir infraestructura nova que depengui de sampling com a
  mecanisme de primer ordre és construir sobre una peça amb data de caducitat definida.

### Roots — **DEPRECATED** (SEP-2577, mateixa finestra)
- Explícitament "no és un mecanisme de control d'accés"; el protocol no obliga els servidors a
  quedar-se dins dels roots. Migració recomanada: passar directoris/fitxers via paràmetres d'eina,
  URIs de resource, o configuració del servidor.

### Elicitation (funcionalitat del client)
- Permet a un servidor demanar informació addicional a mig d'una crida (via MRTR). Dos modes:
  **form** (dades estructurades, en banda) i **URL** (navegador, fora de banda — **obligatori**
  per a contrasenyes/API keys/pagament). El mode URL té requisits de mitigació de phishing
  (vincular l'elicitation a la identitat de l'usuari que la va iniciar).

---

## 4. Transports

- Dos bindings estàndard: **stdio** i **Streamable HTTP** (POST a un únic endpoint; resposta en
  JSON pla o stream SSE d'abast de request).
- El vell **HTTP+SSE transport** (endpoint SSE separat) està ara formalment **Deprecated**.
- Canvis a Streamable HTTP al 2026-07-28: s'elimina `Mcp-Session-Id` i el concepte de sessió;
  s'elimina la reprenibilitat de stream SSE (`Last-Event-ID`); nous headers `Mcp-Method`/`Mcp-Name`
  per enrutament sense parsejar el body.
- **Claude Code específic (NOT independently verified against the core spec):** els docs de Claude
  Code documenten un transport `ws` (WebSocket) a més de `stdio`/`http`/`sse` — sembla una extensió
  pròpia de Claude Code, no un binding estàndard de l'espec MCP.

---

## 5. Cicle de vida i negociació de capacitats

- Sense handshake: cada request declara versió/capabilities independentment; el servidor accepta o
  respon amb `UnsupportedProtocolVersionError`.
- **Framework d'extensions formal**: funcionalitat opcional negociada via un mapa `extensions`
  amb identificadors namespaced (p.ex. `io.modelcontextprotocol/tasks`). Extensions notables:
  **Tasks** (operacions asíncrones de llarga durada amb polling, reemplaça l'antic
  `tasks/result` experimental), **MCP Apps** (UI interactiva inline), **Skills over MCP**
  (encara en fase de working group).

---

## 6. Autenticació i autorització

- L'autorització és **opcional** a nivell de protocol. Per a transports HTTP, "HAURIA" de seguir
  l'espec d'autorització; per a stdio, "NO HAURIA", i en canvi obtenir credencials de l'entorn.
- Servidors MCP actuen com a **resource servers OAuth 2.1**; clients com a **clients OAuth 2.1**.
  Basat en OAuth 2.1 (esborrany IETF), RFC 6750, 8414, 7591 (ara deprecated com a mecanisme
  primari), 8707, 9728, 9207, OIDC Discovery/DCR.
- **Enduriment al 2026-07-28:**
  - Servidors HAN d'implementar RFC 9728 (Protected Resource Metadata); clients HAN d'usar-ho per
    descobrir l'authorization server.
  - Clients HAN d'implementar RFC 8707 (Resource Indicators) per vincular tokens al servidor MCP
    destí.
  - Validació obligatòria de l'`iss` (RFC 9207) contra un issuer pre-registrat abans de bescanviar
    un authorization code (mitiga atacs "AS mix-up").
  - **DCR (RFC 7591) es deprecia** com a mecanisme primari de registre, substituït per **Client ID
    Metadata Documents (CIMD)** — el `client_id` és una URL HTTPS.
  - Servidors HAN de validar l'audiència del token i mai acceptar/reenviar tokens no emesos per a
    ells (codifica formalment la regla "no token passthrough").
- **NOT VERIFIED / en evolució:** el mateix OAuth 2.1 és encara un **esborrany IETF**, no un RFC
  finalitzat; CIMD també és un esborrany. La base d'autenticació d'MCP reposa parcialment sobre
  especificacions que encara poden canviar.

---

## 7. Seguretat

Font: document oficial "Security Best Practices" de l'espec. Classes d'atac documentades:

1. **Confused Deputy Problem** — proxies MCP amb client ID estàtic cap a un AS de tercers poden
   permetre robar un authorization code si no implementen consentiment per client abans de
   reenviar la petició.
2. **Token Passthrough** — prohibit explícitament: un servidor MCP mai ha d'acceptar ni reenviar
   tokens no emesos per a ell mateix.
3. **SSRF** — servidors maliciosos poden plantar URLs controlades per l'atacant als metadades de
   descoberta OAuth per forçar el client a accedir a IPs internes/endpoints de metadades de núvol.
4. **State Handle Hijacking** (nou, conseqüència de l'stateless) — un atacant que obtingui/endevini
   un handle opac (p.ex. un ID de cistella) pot suplantar un altre usuari si el servidor no vincula
   el handle a la identitat autenticada.
5. **Local MCP Server Compromise** — servidors locals (stdio) corren amb els privilegis complets
   del client; comandes d'arrencada malicioses són un risc real. Mitigació: diàlegs de consentiment
   mostrant la comanda completa, sandboxing, mínim privilegi.
6. **OAuth Authorization URL Validation (XSS/RCE)** — URLs `javascript:` o payloads d'injecció de
   shell com a "URL d'autorització". Mitigació: allowlist estricta de schemes `http/https`, mai
   `shell-exec` per obrir URLs.
7. **stdio Transport Security en escenaris de proxy** — rellevant només quan un proxy separat
   genera processos MCP en nom d'un client web (XSS al client web → robatori de token del proxy →
   RCE).
8. **Mix-Up Attacks** — mitigat per la validació d'`iss` (RFC 9207); **PKCE per si sol no ho
   evita**.
9. **Localhost Redirect URI Impersonation** — un procés local atacant pot vincular-se a un port
   `localhost` i fer-se passar per un client natiu legítim.
10. **CIMD Trust Policies / Scope Minimization** — recomanat aplicar polítiques de confiança per
    domini i models d'scope progressiu/mínim en lloc d'scopes amplis (`admin:*`).

**Principis reafirmats a nivell d'espec:** consentiment explícit de l'usuari abans de qualsevol
invocació d'eina o exposició de dades; les **anotacions/descripcions d'eines s'han de tractar com a
no fiables** llevat que vinguin d'un servidor de confiança (rellevant directament per al risc
d'"injecció via metadades d'eina" / prompt injection); les dades de resources no es transmeten
sense consentiment.

### CVEs / incidents coneguts — **CONFIANÇA BAIXA, cal verificació addicional**
Fonts secundàries (blogs de seguretat, no NVD/MITRE directament) esmenten:
- `CVE-2025-6514` (paquet npm `mcp-remote`, CVSS 9.6, injecció de comandes OS) — **NOT
  INDEPENDENTLY VERIFIED**.
- `CVE-2025-54136` ("MCPoison", editor Cursor) — **NOT INDEPENDENTLY VERIFIED**.
- `CVE-2026-33032` (nginx-ui, CVSS 9.8, bypass d'autenticació) — **NOT VERIFIED**, tractar amb
  especial cautela per la seva especificitat/recència.
- Benchmark acadèmic "MCPTox": 36.5% de taxa d'èxit mitjana d'atacs de "tool poisoning" en 45
  servidors reals — **NOT VERIFIED**.
- Taxonomia d'atacs que circula a la comunitat de seguretat (alineada amb el doc oficial): tool
  poisoning, rug pulls (redefinició silenciosa d'una eina després d'aprovada), tool shadowing,
  cross-server attacks, confused-deputy/OAuth, prompt injection via metadades d'eina.

**Acció recomanada:** verificar independentment els CVE anteriors contra nvd.nist.gov abans de
citar-los com a confirmats en qualsevol document públic.

---

## 8. SDKs oficials

Tots sota `github.com/modelcontextprotocol`.

| SDK | Estat | Llicència | Notes |
|---|---|---|---|
| TypeScript | Tier 1, v2 estable (alineat amb 2026-07-28) | Apache 2.0 (nou), MIT (codi existent) | v1.x manté fixes ≥6 mesos post-v2 |
| Python | Tier 1, v2.x estable | MIT | Python 3.10+; migració des de v1 documentada |
| Go | Tier 1 (segons el blog de release) | NOT VERIFIED | Col·laboració amb Google (no confirmat directament) |
| C# | Tier 1 | NOT VERIFIED | Col·laboració amb Microsoft (no confirmat directament) |
| Rust | Beta/estable segons font secundària | NOT VERIFIED | Repo existeix, detalls no confirmats |
| Kotlin | Existeix (col·laboració JetBrains, segons cerca) | NOT VERIFIED | Repo confirmat per cerca, contingut no revisat |
| Java, Swift, Ruby, PHP | Existència reclamada per una font secundària | **NOT VERIFIED** | Cal comprovar directament `github.com/orgs/modelcontextprotocol/repositories` |

**Acció pendent:** revisar directament el llistat de repos de l'organització oficial abans de
prendre cap decisió d'SDK.

---

## 9. Ecosistema / servidors / registre

- `modelcontextprotocol/servers`: servidors de **referència** oficials (Everything, Fetch,
  Filesystem, Git, Memory, Sequential Thinking, Time), dual-llicenciats Apache 2.0 (nou) / MIT
  (existent). Explícitament **exemples educatius, no solucions de producció**.
- **Registre oficial d'MCP**: `registry.modelcontextprotocol.io`, en preview des del 8/9/2025,
  amb autenticació per namespace (`io.github.usuari/servidor`) vinculada a comptes/dominis
  verificats. **UNKNOWN**: si ha sortit de "preview" a data d'avui (el fetch directe de la
  documentació del registre no va retornar contingut en aquesta investigació).
- Ecosistema ampli de tercers (SaaS: Notion, Slack, Asana, HubSpot, Stripe...; connectors de
  dades/BD; endpoints allotjats per proveïdors de núvol AWS/GCP/Azure) — escala exacta **NOT
  VERIFIED** (una xifra de "~2.000 servidors actius" prové d'un agregador de tercers, no del
  registre oficial).

---

## 10. Compatibilitat amb Claude Code (resum — veure CLAUDE-CODE-ANALYSIS.md per detall)

Font: docs oficials de Claude Code (`code.claude.com/docs/en/mcp`).

- Config a `.mcp.json` (àmbit projecte, versionat a git) i `~/.claude.json` (àmbit usuari/local).
- Tres àmbits: **Local** (per defecte), **Project**, **User**. Precedència en cas de col·lisió:
  Local > Project > User > Plugin > connectors claude.ai > servidors gestionats per l'organització.
- Transports suportats al config: `stdio`, `http`, `sse` (deprecated, preferir `http`), `ws`
  (extensió pròpia de Claude Code, no estàndard MCP).
- Claude Code manté **dues generacions de client runtime**: "v1" (SDK TS 1.x) i "v2" (SDK TS 2.0,
  des de Claude Code v2.1.232+, suporta la revisió 2026-07-28). Seleccionable via
  `MCP_SDK_GENERATION`; mode de negociació via `MCP_PROTOCOL_NEGOTIATION=auto|legacy`.
- OAuth suportat directament al config, més un mecanisme `headersHelper` per a auth dinàmica.
- Interpolació de variables d'entorn amb redacció automàtica de secrets sensibles cap a servidors
  remots de tercers.
- Timeouts configurables: `MCP_TIMEOUT`, `timeout` per servidor, `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`,
  `MAX_MCP_OUTPUT_TOKENS` (per defecte 25.000).

---

## Implicacions preliminars per a AgentForge (PROPOSAL, no decisió)

- **PROPOSAL**: AgentForge hauria de decidir explícitament si construeix per a semàntica "Modern"
  (2026-07-28) únicament, o si necessita suport "Dual-era" per interoperar amb l'ecosistema actual
  de servidors, que probablement encara parla majoritàriament "Legacy" (la nova versió té només
  ~7 setmanes de vida a la data d'aquesta investigació).
- **PROPOSAL**: No construir cap dependència central en **sampling** ni **roots**, atès que ambdós
  estan formalment deprecats amb un rellotge de caducitat.
- **PROPOSAL**: Si AgentForge exposa un MCP gateway/broker cap a sistemes remots (SSH, APIs), cal
  aplicar explícitament les mitigacions documentades a la secció de seguretat (especialment
  token passthrough, SSRF i confused deputy) des del disseny inicial, no com a afegit posterior.
- `LEGAL REVIEW REQUIRED`: cap trobat en aquest bloc (SDKs oficials sota MIT/Apache 2.0, servidors
  de referència dual-llicenciats) — sense problemes de llicència aparents per a l'ús previst
  (consumir/implementar el protocol, no redistribuir codi de tercers sense revisar).

---

## Fonts

Vegeu `docs/research/SOURCES.md` per la llista consolidada de totes les fonts del projecte
(aquest bloc n'aporta ~20; els detalls complets per URL, extracció i confiança hi són registrats).
