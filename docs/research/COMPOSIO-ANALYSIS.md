# Composio — Anàlisi tècnica

**Estat:** Investigació completada. **Data:** 2026-09-16. **Font principal:**
`github.com/ComposioHQ/composio` (rama `next`), `docs.composio.dev`, `composio.dev/pricing`.

> **Troballa estratègica central:** Composio és **"SDK obert, plataforma tancada"**. El repositori
> públic (MIT) és un client ben enginyerat (SDKs multi-llenguatge, CLI, adaptadors de framework)
> sobre un backend SaaS **completament propietari i mesurat per ús** que fa
> l'emmagatzematge de credencials, l'execució d'eines i (per al Tool Router) la cerca/ranking
> d'eines. **Res al repo públic permetria a AgentForge muntar un sistema equivalent autoallotjat
> fent fork** — les implementacions de les 1000+ toolkits, la flota d'apps OAuth i el backend de
> cerca simplement no hi són.

---

## 1. Repositori i llicència

- **FACT** — Repo oficial: `github.com/ComposioHQ/composio`. 30.198 estrelles, 4.796 forks, 84
  issues obertes, branca per defecte `next`, creat 2024-02-23, activament mantingut (push el mateix
  dia d'aquesta investigació). Llenguatge principal TypeScript (Python com a segon).
- **FACT** — `LICENSE` arrel: **MIT**, titular del copyright **"Sampark Inc." (2025)** — l'entitat
  legal darrere de Composio es diu Sampark Inc., no "Composio".
- **`LEGAL REVIEW REQUIRED`** — Inconsistència de llicència: `CONTRIBUTING.md` diu que les
  contribucions es llicencien sota **ISC**, mentre que el `LICENSE` real del repo és **MIT**. ISC i
  MIT són gairebé idèntiques en termes pràctics, així que el risc real és baix, però els documents
  es contradiuen. No copiar aquesta inconsistència si s'adapta llenguatge de contribució de
  Composio.
- **FACT** — Sense capçaleres de copyright per fitxer (comprovat a `composio.ts`); la llicència
  només s'afirma a l'arrel del repo. Sense bot de CLA/DCO formal trobat.
- **FACT — troballa arquitectònica/legal important** — El repo de GitHub conté **només els SDKs
  client** (TypeScript, Python), la CLI, adaptadors de "provider" i documentació. **No conté** les
  implementacions reals dels 1000+ connectors de tercers, l'emmagatzematge de credencials/secrets,
  el runtime d'execució d'eines, ni el backend de cerca del Tool Router. Totes les crides de l'SDK
  apunten per defecte a `baseURL: https://backend.composio.dev` — l'SDK és un client prim sobre un
  backend SaaS multi-tenant tancat.
- **NOT VERIFIED** — Autoallotjament (self-hosting): la pàgina de preus oficial **no esmenta
  autoallotjament ni desplegament on-prem** — es presenta com a SaaS únicament amb preus per ús.
  Una GitHub Discussion (#1037) té només una resposta comunitària (no de l'equip) descrivint un
  hipotètic muntatge Docker/Kubernetes que requeriria registrar les pròpies apps OAuth — **sense
  confirmació oficial de Composio**. Hi ha reclams contradictoris en fonts secundàries que diuen que
  sí que hi ha "servidor MCP autoallotjat" possible. **Cal aclariment directe de Composio si això
  importa per a la decisió d'AgentForge.**
- **FACT** — Preus/split open-core (`composio.dev/pricing`): Free (100.000 crides d'eina/mes,
  50.000 triggers/mes, 3 membres, "1500+ toolkits" — nota: xifra inconsistent amb el "1000+" del
  README de GitHub, és només màrqueting, no problema de llicència), Scale ($29/mes), Enterprise
  (preu personalitzat, SSO/SCIM, claus gestionades pel client). Add-ons mesurats per crida/connexió
  (white-labeling, zero data retention, IP allowlisting, BAA/HIPAA).
- **UNKNOWN** — Política de marca/trademark: no documentada explícitament en cap font consultada.
  MIT no atorga drets de marca (estàndard) — reutilitzar noms com "Composio" o "Rube" necessitaria
  verificació separada.

---

## 2. Tool system

- **FACT** — Una "tool" és una acció executable identificada per un `slug` en
  `SCREAMING_SNAKE_CASE` amb patró `{TOOLKIT}_{ACTION}` (p.ex. `GMAIL_SEND_EMAIL`). Un
  `ToolSchema` porta `slug`, `name`, `description`, `inputParameters`/`outputParameters` (JSON
  Schema), `version` (codificada per data), flag `isNoAuth`, `scopes` OAuth.
- **NOT VERIFIED** — "Toolkit" com a agrupació d'eines per servei extern (exemple citat: Gmail =
  63 eines + 2 triggers) — provinent de resum de tercers (DeepWiki), no de lectura directa del
  tipus.
- **FACT** — L'API pròpia de Composio es genera via OpenAPI (`backend.composio.dev/api/v3/openapi.json`);
  l'SDK normalitza automàticament snake_case↔camelCase. Els schemas de function-calling s'exporten
  en formats compatibles amb OpenAI/Anthropic/LangChain via "providers".
- **FACT** — Catàleg: no és un registre descentralitzat/connectable al repo OSS — és un catàleg
  centralitzat servit pel backend, reflectit com a JSON estàtic a `docs/public/data/`
  (`toolkits.json`, `toolkits-list.json`, `meta-tools.json`). Aquests JSON són un **actiu de dades
  potencialment reutilitzable** encara que el codi d'execució no sigui obert.
- **FACT (implicació arquitectònica clau)** — L'execució de l'eina **no** és "l'SDK local crida
  l'API de tercers directament" — passa per un proxy pels servidors propis de Composio (així
  centralitzen OAuth/credencials i apliquen mesurament/facturació). És una decisió deliberada
  d'execució allotjada/vendor-lock, no només conveniència d'autenticació.

---

## 3. Tool Router

- **FACT** — Un únic endpoint MCP que cerca/carrega dinàmicament només les eines rellevants per a
  la tasca actual, en lloc d'exposar una llista estàtica fixa — soluciona la "proliferació d'eines"
  / inflor de la finestra de context quan un agent té accés a centenars/milers d'eines.
- **NOT VERIFIED** — Estat GA (General Availability): fonts secundàries indiquen que ha sortit de
  Beta, però no s'ha confirmat amb un changelog datat.
- **FACT** — Mecanisme en 3 etapes: descoberta (cerca d'eines que coincideixin amb la tasca),
  autenticació (comprovar connexions existents), execució. La descoberta s'exposa com una
  **meta-tool anomenada `COMPOSIO_SEARCH_TOOLS`**: accepta consultes en llenguatge natural
  estructurades (es poden dividir en múltiples consultes paral·leles), cada consulta retorna
  **4–6 eines candidates**. Un paràmetre "search path" (per defecte `"auto"`) tria entre un camí
  cachejat/planificat i un mode directe de fallback.
- **UNKNOWN** — L'algorisme exacte de recuperació subjacent (embeddings vs. keyword vs.
  re-ranking basat en LLM) **no es revela** en cap document consultat.
- **FACT** — Codi client (sessió/handshake) existeix a l'SDK OSS
  (`ts/packages/core/src/models/ToolRouter.ts`, `ToolRouterSession.ts`,
  `ToolRouterSessionFileMount.ts`), però el backend real de cerca/ranking/execució corre a la
  infraestructura allotjada de Composio. **Resum: wrapper client = codi obert (MIT); el servei de
  cerca/ranking d'eines mateix = SaaS propietari.**
- **NOT VERIFIED** — Producte relacionat "Rube" (servidor MCP marcat separadament sobre l'ecosistema
  de connectors de Composio): llicència pròpia **UNKNOWN**, els intents directes de fetch al repo
  van retornar 404.
- **FACT** — El blog oficial l'emmarca com un "v0 d'Skills", pas inicial cap a un roadmap més ampli
  de "milions de capacitats".

---

## 4. Sessions

- **FACT** — "L'entorn amb àmbit en què un agent d'IA treballa mentre actua en nom d'un dels teus
  usuaris." Uneix: identitat d'usuari (`user_id`), accés a eines, estat d'autenticació (OAuth,
  múltiples comptes connectats per toolkit per usuari), estat d'execució (logs, memòria d'eines,
  estat MCP, fitxers de sandbox/workbench).
- **FACT** — Creació: `composio.create(user_id=...)`; represa: `composio.use(session_id)`.
- **FACT** — Un usuari pot tenir múltiples comptes connectats per toolkit (p.ex. Gmail personal +
  de feina) sota un `user_id`; la capa de crida d'eina selecciona quin compte usar en temps
  d'execució.
- **FACT** — Una sessió de Tool Router (`composio.experimental.toolRouter.createSession(userId)`)
  genera una URL MCP pre-signada amb àmbit a aquella sessió d'usuari/xat — "sessió" és el concepte
  paraigua i les sessions Tool Router / servidors MCP / sandbox ("workbench") són totes facetes
  adreçades pel mateix objecte de context de sessió.

---

## 5. Autenticació

- **FACT** — L'autenticació sempre és per usuari final. Cada usuari de la teva app connecta els
  seus propis comptes de tercers; Composio emmagatzema i refresca automàticament aquestes
  credencials sota el teu `user_id` intern.
- **FACT** — Model de dos nivells: **Auth Config** (blueprint a nivell d'app/desenvolupador —
  mètode d'auth, scopes OAuth, credencials d'app OAuth pròpies opcionals) vs. **Connected Account**
  (l'enllaç autenticat real d'un usuari a un auth config concret, amb estat
  `ACTIVE`/`EXPIRED`/`FAILED`).
- **FACT** — Esquemes suportats: OAuth2, API Key, Bearer Token, Basic Auth, esquemes personalitzats
  per toolkit.
- **FACT** — Refresc de tokens automàtic; una connexió només passa a `EXPIRED` després que els
  intents de refresc fallin.
- **UNKNOWN** — Mecanisme d'emmagatzematge de secrets: **no divulgat** en cap documentació
  consultada (sense esment de KMS, vault, algorisme de xifratge). Marca de Rube diu "encriptat i
  emmagatzemat de forma segura" — llenguatge de màrqueting genèric, no divulgació tècnica. Marcat
  com a forat si AgentForge necessita avaluar la postura de seguretat real de Composio.
- **FACT** — Composio ofereix apps OAuth compartides per defecte per arrencar ràpid, i suporta
  portar les credencials d'app OAuth pròpies per a producció (necessari perquè webhooks/marca
  mostrin el nom de la teva app, no "Composio").

---

## 6. Suport MCP

- **FACT** — Composio funciona principalment com a **servidor MCP** (apuntes clients compatibles
  amb MCP — Claude Desktop, Cursor, VS Code, agents propis — a un endpoint MCP allotjat per
  Composio). No s'ha trobat evidència que l'SDK de Composio actuï com a client MCP genèric per a
  servidors MCP de tercers arbitraris.
- **FACT** — Dos patrons d'accés MCP:
  1. **Servidor MCP fix d'un o múltiples toolkits**: `composio.mcp.create()` o dashboard, amb
     allowlist explícita de slugs d'eina. Endpoint:
     `https://backend.composio.dev/v3/mcp/{SERVER_ID}?user_id={USER_ID}`, autenticat via header
     `x-api-key`. Els propis docs desaconsellen aquest patró: *"For most use cases, use a regular
     session instead."*
  2. **Sessió Tool Router**: un únic endpoint MCP dinàmic per usuari/sessió.
- **FACT** — Transports: documentació directa descriu només un endpoint HTTP basat en URL (MCP
  remot). Els topics de GitHub del repo inclouen `remote-mcp-server` i `sse`, indicant suport SSE
  en algun punt del producte. Sense stdio de primer nivell (té sentit, ja que els servidors MCP de
  Composio són remots/allotjats per disseny) — però l'SDK sí suporta un **mode sandbox local**
  (secció 9.6) que corre a la infraestructura del desenvolupador.
- **FACT** — Creació d'MCP personalitzat: sí, via SDK i via dashboard, amb allowlist explícita
  d'eines.
- **FACT** — Limitacions conegudes (segons els propis docs, no de tercers): els servidors MCP fixos
  estan explícitament desaconsellats respecte a sessions/Tool Router per a "la majoria de casos
  d'ús" — Composio mateix posiciona el patró de servidor MCP pla com l'opció menys capaç.

---

## 7. Triggers / automatització

- **FACT** — Els triggers entreguen esdeveniments de tercers (missatge nou de Slack, commit de
  GitHub, correu entrant...) com a webhooks; Composio signa els payloads per verificació.
- **FACT** — Dos modes d'entrega: **realtime/push** (Slack, Asana, Notion, Outlook) i **polling**
  (fins a ~15 min de latència sota auth gestionada per Composio; Gmail, Google Calendar).
- **FACT** — Model d'objectes: **trigger type** (categoria d'esdeveniment per toolkit) vs.
  **trigger instance** (trigger activat lligat a un compte connectat d'un usuari, amb ID propi
  `ti_*`).
- **FACT** — Flux: autenticar usuari → crear instància de trigger → rebre esdeveniments via
  `subscribe()` (dev) o webhook de producció registrat.
- **NOT VERIFIED / probablement absent** — Cap funcionalitat de tipus "cron"/tasca programada
  genèrica distinta del mecanisme de polling trobada — els triggers de polling són l'anàleg més
  proper d'una tasca programada, però són "dirigits per esdeveniment amb temporitzador", no un
  scheduler de propòsit general.

---

## 8. Arquitectura d'integracions (escalant a 1000+ toolkits)

- **FACT** — No és un framework de plug-in del costat del client: totes les implementacions de
  toolkit estan centralitzades al servidor darrere de `backend.composio.dev`. El repo OSS només
  envia: (a) codi client SDK, (b) metadades estàtiques de catàleg, (c) adaptadors "provider" per
  reformatar schemas per framework.
- **NOT VERIFIED / UNKNOWN** — El mecanisme intern de generació (és cada spec OpenAPI de tercers
  ingerida automàticament, o hi ha curadoria humana per toolkit, o ambdues?) no es divulga. Sí és
  fet confirmat que la pròpia API de Composio es genera via OpenAPI, cosa que suggereix un
  framework de connector genèric i dirigit per schema internament.
- **Classificació d'integracions (síntesi analítica pròpia, NO taxonomia oficial):**
  1. APIs SaaS basades en OAuth2 (majoria de toolkits).
  2. APIs basades en API-key/Bearer token.
  3. Eines sense autenticació (`isNoAuth` — càlcul pur, cerca web, execució de codi).
  4. Meta-tools (`COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_MANAGE_CONNECTIONS`,
     `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_REMOTE_BASH_TOOL`) —
     eines de "pla de control" pròpies de Composio, no wrappers de tercers.
- **FACT** — Via de contribució pública (`pnpm create:provider`): fa scaffold de nous **adaptadors
  de provider de framework**, no de noves toolkits/connectors de tercers — la comunitat pot
  contribuir noves maneres de *consumir* les eines de Composio en un framework d'agent donat, però
  no pot (via el repo OSS públic) afegir una nova integració SaaS. **"Open source" aquí vol dir
  "ecosistema obert d'SDK/provider", no "marketplace obert de connectors".**

---

## 9. Components de codi reutilitzables

| # | Component | Ubicació | Llicència | Dificultat extracció | Utilitat per AgentForge | Recomanació |
|---|---|---|---|---|---|---|
| 9.1 | Patró d'abstracció Provider (`BaseProvider`/agentic vs non-agentic) | `ts/packages/core/src/provider/` | MIT | Baixa (patró) / Mitjana-Alta (codi literal) | Alta com a referència de disseny | **Referència únicament** |
| 9.2 | Model de Session (`Sessions.ts`, `SessionContext.ts`) | `ts/packages/core/src/models/` | MIT | Mitjana | Alta com a referència conceptual | **Referència únicament** |
| 9.3 | Patró de meta-tools (`COMPOSIO_SEARCH_TOOLS` etc.) | Backend (no al repo OSS) | N/A — no és codi obert | N/A (res a extreure) | **Molt alta** — la idea individual més valuosa d'aquest bloc per al problema de "tool discovery" d'AgentForge | **Referència únicament** |
| 9.4 | Fitxers de dades de catàleg (`toolkits.json` etc.) | `docs/public/data/` | MIT | Trivial | Mitjana (taxonomia il·lustrativa) | **Referència únicament** |
| 9.5 | Eina CLI | `ts/packages/cli/` | MIT | Mitjana-Alta (acoblat a Effect/Bun) | Baixa-Mitjana (referència UX) | **Referència únicament** |
| 9.6 | Sandbox local / "workbench" | `@composio/experimental` | MIT (experimental) | Mitjana | Alta com a patró (execució local + pla de control remot) | **Referència únicament** |
| 9.7 | Generadors de scaffolding de provider | Referenciat a `CONTRIBUTING.md` | MIT | Baixa-Mitjana | Mitjana | **Podria adaptar-se** (l'únic component on la reutilització literal de codi és plausible) |

---

## Resum de troballes estratègiques per a AgentForge

1. **Composio és "SDK obert, plataforma tancada".** El repo GitHub llicenciat MIT és un client ben
   enginyerat sobre un backend SaaS completament propietari i mesurat. No permet a AgentForge
   muntar un sistema autoallotjat equivalent fent fork.
2. **El més valuós a "prendre prestat" és l'arquitectura conceptual, no codi**: el model de Session
   (identitat + eines + auth + estat d'execució en un sol objecte), l'abstracció Provider (agentic
   vs. non-agentic) i el patró de meta-tools (un grapat d'eines de pla de control en lloc
   d'exposar centenars d'schemas directament) són patrons de disseny nets i reutilitzables que
   mapegen directament als objectius de recerca d'AgentForge (eines, sessions, tool discovery,
   permisos).
3. **Dues preguntes obertes verificades que requereixen seguiment** abans d'escriure conclusions
   finals: (a) la inconsistència de llicència MIT/ISC — risc legal baix però val la pena una nota;
   (b) si l'autoallotjament és realment no suportat — si la decisió de "construir el nostre propi"
   d'AgentForge depèn de si Composio es podria autoallotjar en canvi, cal una resposta directa i
   autoritativa, no la citació d'un fil comunitari.

## Classificació A/B/C/D/E (per a aquest bloc)

- **A — REUTILITZAR:** Cap. No hi ha codi de Composio recomanat per a còpia directa (llevat,
  potencialment, dels generadors de scaffolding 9.7, a revisar amb més detall).
- **B — ADAPTAR:** Generadors de scaffolding de provider (9.7) — únic candidat plausible de
  reutilització literal de codi, pendent de revisió del codi font real.
- **C — INSPIRACIÓ:** Model de Session (9.2), abstracció Provider (9.1), patró de meta-tools (9.3),
  patró sandbox local + pla de control remot (9.6).
- **D — DESCARTAR:** Servidor MCP fix d'un sol toolkit (patró que Composio mateix desaconsella);
  dependència d'Effect/Bun per a la CLI si AgentForge no vol aquest compromís d'stack.
- **E — INVESTIGAR MÉS:** Algorisme real de cerca del Tool Router; mecanisme d'emmagatzematge de
  secrets de Composio; estat real d'autoallotjament; llicència del repo "Rube"; pipeline intern de
  generació de toolkits.

## Fonts

Vegeu `docs/research/SOURCES.md` per la llista consolidada (aquest bloc n'aporta 25).
