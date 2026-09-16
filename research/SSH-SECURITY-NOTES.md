# Notes de recerca — SSH remot i seguretat per a agents

**Estat:** Notes crues de la investigació en background. **Data:** 2026-09-16. Aquest document és
material de suport per a `docs/research/RESEARCH-REPORT.md` i
`architecture/ARCHITECTURE-DRAFT.md` — no és, en si mateix, un dels documents finals requerits per
la Fase 0, però es conserva per traçabilitat de les fonts i el raonament complet.

Cap sistema remot ha estat tocat, configurat ni accedit durant aquesta investigació.

---

## 1. Autenticació SSH i gestió de claus

- **FACT** — Ed25519 és avui l'algorisme recomanat per defecte per a claus SSH noves (una clau de
  256 bits equival aproximadament a una RSA de 3072–4096 bits), amb claus més petites i
  signatura/verificació més ràpida. Suportat des d'OpenSSH 6.5 (2014).
- **FACT** — RSA-2048 encara és criptogràficament acceptable, però ja no és la millor opció per a
  claus noves quan ed25519 està disponible.
- **ASSUMPTION** — Per als sistemes destí d'AgentForge (Debian de casa, VPS Contabo), ed25519
  hauria de ser el tipus de clau per defecte, sense bloquejadors de compatibilitat esperats —
  **a verificar contra les versions reals d'OpenSSH d'aquests hosts abans d'implementar** (fora
  d'abast d'aquesta fase).

### Passphrase, ssh-agent i agent forwarding
- **FACT** — L'agent forwarding (`ForwardAgent yes` / `ssh -A`) està àmpliament desaconsellat
  perquè estén la confiança a l'amfitrió remot: qualsevol amb prou privilegi allà pot demanar
  signatures a l'agent local durant la connexió (impersonació cap a tercers sistemes on la clau és
  de confiança). Incident real documentat: la bretxa de Matrix.org (2019) hi va tenir relació.
- **FACT** — L'alternativa recomanada per OpenSSH per travessar un host intermedi és
  **ProxyJump** (`-J` / directiva `ProxyJump`, des d'OpenSSH 7.3), que fa túnel sense exposar mai
  el socket de l'agent local a l'host intermedi.
- **ASSUMPTION** — Per AgentForge, no s'hauria d'usar agent forwarding en cap cas. Si en el futur
  cal una topologia de salt (p.ex. VPS com a salt per arribar al servidor de casa darrere de NAT),
  ProxyJump amb una clau restringida dedicada al host de salt és el patró adequat.

### Certificats SSH / CA de curta durada
- **FACT** — SSH suporta autenticació per certificat (CA signa certificats d'usuari/host de curta
  durada via `ssh-keygen -s`), eliminant la necessitat de distribuir claus públiques individuals a
  cada `authorized_keys`. La revocació és implícita per caducitat.
- **ASSUMPTION** — Per a una eina d'un sol desenvolupador com AgentForge, muntar una CA SSH
  completa (step-ca, Teleport, Vault SSH) és probablement sobreenginyeria en la fase 1. Una clau
  restringida per host, de llarga durada però rotada periòdicament, sembla proporcionada —
  revisar-ho si AgentForge creix a gestionar molts hosts o operadors.

### Verificació de host key (known_hosts / TOFU)
- **FACT** — El model de confiança per defecte d'OpenSSH és Trust-On-First-Use (TOFU): a la
  primera connexió es mostra el fingerprint i es demana acceptació manual; després es fixa a
  `known_hosts`.
- **FACT** — La debilitat central del TOFU és la primera connexió: un MITM en aquell moment queda
  fixat com a confiable de manera silenciosa.
- **FACT** — Mitigacions recomanades: mai `StrictHostKeyChecking no` (desactiva la verificació per
  complet — antipatró real trobat en múltiples projectes d'automatització durant la investigació);
  pre-poblar `known_hosts` fora de banda (p.ex. fingerprint obtingut via el panell de control del
  proveïdor VPS en crear la màquina, o accés físic/consola per al servidor de casa); certificats de
  host SSH (el servidor presenta un cert signat per CA) eliminen el TOFU del tot però impliquen la
  mateixa sobrecàrrega de CA esmentada més amunt.
- **ASSUMPTION** — Per AgentForge: fixar les entrades de `known_hosts` manualment / fora de banda
  durant una configuració inicial supervisada per un humà per a cada host remot, **abans** que
  qualsevol connexió automatitzada per l'agent tingui lloc, i configurar `StrictHostKeyChecking
  yes` en estat estacionari (mai `accept-new` fora de la configuració inicial).

---

## 2. Restringir què pot fer SSH

**FACT (font primària: man page `sshd(8)` d'OpenBSD)** — Opcions a `authorized_keys`:
- `command="..."` — força l'execució d'una comanda concreta, ignorant la que demani el client.
  Primitiva central per convertir una clau SSH en una credencial d'automatització d'un sol
  propòsit.
- `no-port-forwarding`, `no-agent-forwarding`, `no-pty`, `no-X11-forwarding`.
- `restrict` (OpenSSH 7.2+) — flag únic que desactiva tot l'anterior d'un cop; forma recomanada
  actualment en lloc de llistar cada `no-*`.
- Un `command=` pot embolcallar un script "dispatcher" que parsegi `$SSH_ORIGINAL_COMMAND` i només
  permeti un conjunt d'operacions amb allowlist — un mini allowlist de comandes dins la mateixa
  comanda forçada.

### Shell genèric vs. eines específiques amb allowlist — anàlisi de compromisos

- **FACT** — OWASP GenAI/LLM Top 10 (2025) llista **Excessive Agency (LLM06)** com a risc top-10:
  "Systems grant models too much autonomous capability to take actions without proper oversight."
  Una eina genèrica `execute_command(string)` és gairebé un exemple de llibre de text d'aquest
  risc.
- **FACT** — La literatura de disseny d'eines agentives convergeix cap a crides estructurades i
  parametritzades: una capa intermèdia ha d'actuar de gatekeeper, sense deixar mai que l'LLM
  construeixi i executi directament strings de shell; l'LLM selecciona d'una interfície d'eines
  amb allowlist i schema validat, i l'orquestrador (no el model) construeix la comanda real.

| Dimensió | Shell genèric (`execute_command`) | Eines específiques amb allowlist |
|---|---|---|
| Seguretat | Risc més alt — exposició completa a Excessive Agency | Superfície d'atac acotada a les operacions implementades |
| Auditabilitat | Logs de strings opacs, difícil construir regles estructurades | Cada crida és un esdeveniment nomenat i parametritzat, auditable |
| Flexibilitat | Gestiona tasques no anticipades sense nou desenvolupament | Cada capacitat nova requereix canvi de codi |
| Cost d'enginyeria | Baix inicialment | Més alt, creixent amb el catàleg |
| Granularitat de confirmació | Difícil aplicar confirmació per nivells de risc | Nivells de risc per eina (patró HITL estàndard) |

- **PROPOSAL** (judici d'enginyeria, coherent amb OWASP LLM06): un híbrid és probablement el més
  pragmàtic per AgentForge — un catàleg creixent d'eines específiques per a operacions habituals
  (estat de servei, tail de logs, reinici de contenidor...), més un "execute genèric" molt
  restringit (via `command=` amb wrapper validador, `no-pty`, `no-port-forwarding`) que sempre
  requereixi confirmació humana i mai s'executi automàticament.

---

## 3. Timeouts, gestió d'errors, reintents

- **FACT** — A Paramiko (llibreria SSH de Python, representativa del patró general), `exec_command()`
  accepta un paràmetre `timeout`, i l'estat de sortida es recupera via `recv_exit_status()` al
  canal; patrons ingenus de lectura poden penjar-se o retornar dades incompletes en comandes
  llargues o amb molta sortida.
- **FACT** — Limitació coneguda: combinar de manera fiable timeout **i** captura de codi de
  sortida simultàniament requereix lògica addicional de buffering/polling més enllà del que dona
  Paramiko bàsic.
- **ASSUMPTION** — Una capa d'execució remota robusta hauria de: (a) distingir timeout de
  connexió de timeout d'execució per comanda; (b) capturar sempre stdout, stderr i exit code com a
  tres camps sempre presents (mai assumir èxit per stderr buit); (c) en cas de timeout, tancar/matar
  explícitament el canal remot en lloc de deixar un procés zombi; (d) distingir "no hi ha resposta"
  de "va respondre amb error" com a tipus d'error diferents.
- **ASSUMPTION** — Els reintents automàtics són raonables per a operacions de lectura idempotents
  (comprovacions d'estat); les operacions que canvien estat/destructives **no** haurien de
  reintentar-se automàticament sense reconfirmar la intenció (un "reinicia servei" reintentat
  després d'un timeout ambigu podria executar-se dues vegades).

---

## 4. Model de permisos per a execució agentiva

- **FACT** — OWASP LLM06 (Excessive Agency) és la categoria de risc que cobreix tota aquesta àrea.
- **FACT** — Patró estàndard de mitigació de la literatura HITL: classificar accions per
  reversibilitat/risc, no per funcionalitat — operacions de només lectura/reversibles s'executen
  automàticament sense porta; operacions irreversibles o destructives sempre requereixen aprovació
  humana explícita **abans** de l'execució, i l'execució queda **físicament aturada** (no només
  registrada) fins a l'aprovació.
- **FACT** — Literatura recent de "least privilege for AI agents" (Microsoft Security Blog, Okta):
  tractar l'agent com una identitat de primer ordre pròpia (no un proxy del permís complet de
  l'humà), donar-li només les credencials/autorització que la tasca concreta necessita, preferir
  credencials efímeres i emeses just-in-time per tasca en lloc d'accés ampli permanent.
- **FACT** — Raonament citat sobre per què el mínim privilegi importa *més* per a agents LLM que
  per a automatització ordinària: el titular de la credencial no és un programa determinista fix
  sinó un component manipulable via les seves entrades (prompt injection) — l'aplicació ha de ser
  una frontera d'autorització dura fora del control del model, no una promesa a nivell de prompt.
- **PROPOSAL** (traducció de disseny per AgentForge): classificació en tres nivells —
  1. **Només lectura** (estat, logs, `df -h`, `docker ps`): auto-execució, registrada, sense
     confirmació.
  2. **Escriptura reversible / baix impacte** (reiniciar un servei concret conegut): auto-execució
     només si està pre-aprovada en una política explícita; si no, requereix confirmació.
  3. **Destructiu / alt impacte** (esborrar dades, modificar firewall/config de seguretat,
     qualsevol cosa que toqui la configuració SSH/auth mateixa, `rm`, drops de BD, xarxa pública
     del VPS): sempre confirmació humana síncrona explícita, sense excepcions, sense
     "auto-aprovar després de N execucions correctes".
  - L'aplicació d'aquesta classificació ha de viure en codi que l'LLM no pugui alterar (la capa de
    dispatch/política), mai només com a instrucció de system prompt.

---

## 5. Gestió de secrets (màquina de desenvolupament Windows)

- **FACT** — Windows Credential Manager és una eina nativa del SO (basada en DPAPI);
  OpenSSH-per-Windows pot emmagatzemar clau/passphrase desblocada via el servei `ssh-agent`
  integrat amb Credential Manager.
- **FACT** — SOPS (Mozilla) + age es caracteritza a la literatura actual com a adequat per a
  equips petits (1–20 desenvolupadors) que volen secrets xifrats en repòs en fitxers/git sense
  infraestructura de servidor addicional. Limitacions: sense rotació integrada (cicle manual
  desxifrar/editar/re-xifrar/commit), sense rastre d'auditoria centralitzat, sense secrets
  dinàmics/de curta durada.
- **FACT** — HashiCorp Vault ofereix generació dinàmica de secrets, rotació automàtica, emissió de
  credencials de curta durada i política/auditoria centralitzades — capacitats que SOPS/age no
  tenen — però requereix executar i mantenir infraestructura de servidor.
- **PROPOSAL** — Per AgentForge (un sol desenvolupador, local-first, màquina Windows): Vault (o
  qualsevol gestor de secrets de tipus empresa) és probablement sobrecàrrega desproporcionada. Els
  dos candidats realistes: (a) **Windows Credential Manager** per a la clau/passphrase SSH mateixa;
  (b) **SOPS+age** (o un enfocament més senzill de fitxer xifrat) per a altres credencials
  (tokens d'API per a "altres serveis") que necessitin viure en configuració versionable.
- **NOT VERIFIED** — Si la protecció DPAPI de Windows Credential Manager és adequada
  específicament contra un escenari on l'atacant potencial és **el mateix procés de l'agent LLM**
  que corre a la mateixa màquina (no un atacant remot o un portàtil robat). Cap font revisada
  aborda aquest model d'amenaça específic — **queda com a pregunta de disseny oberta** per al
  document d'arquitectura, no com a resolta.

---

## 6. Amenaces específiques d'agents

### Prompt injection → execució d'eines no intencionada
- **FACT** — OWASP classifica Prompt Injection com a LLM01 (risc top). La injecció indirecta —
  instruccions malicioses que arriben no de l'usuari sinó incrustades en dades que l'agent llegeix
  (p.ex. la sortida d'una comanda remota) — és la variant més rellevant per a un agent d'execució
  remota, ja que la sortida de comandes és per definició text no fiable un cop l'agent interactua
  amb sistemes reals.
- **FACT** — L'OWASP Prompt Injection Prevention Cheat Sheet recomana tractar tot contingut extern
  i generat per eines com a dades no fiables, mai com a instruccions executables, com a principi
  arquitectònic central, i descriu el patró **dual-LLM / quarantena** com la defensa més forta: un
  LLM privilegiat té autoritat d'invocació d'eines però mai llegeix contingut no fiable
  directament; un LLM separat i sense privilegis llegeix el contingut no fiable i només pot
  retornar resums/etiquetes estructurats — mai text lliure que pugui portar instruccions
  incrustades.
- **PROPOSAL** — Per AgentForge: la sortida de comandes SSH mai s'hauria d'alimentar de nou a un
  context de prompt que també tingui autoritat de crida d'eines en viu sense alguna frontera
  estructural; com a mínim, la sortida s'hauria de tractar com a dada inerta per mostrar/resumir, i
  qualsevol acció posterior que l'agent vulgui prendre "a causa de" alguna cosa llegida a la
  sortida hauria de tornar a passar per la mateixa porta de confirmació/allowlist que qualsevol
  altra petició d'acció, no encadenar-se automàticament.

### Injecció de comandes per construcció dinàmica de strings de shell
- **FACT** — Antipatró explícit a la literatura: no usar mai `subprocess.Popen(shell=True)` (o
  equivalent) amb contingut generat pel model; no interpolar mai un string suggerit pel model
  directament dins una comanda de shell.
- **FACT** — L'arreglament estructural recomanat és el mateix patró "orquestrador com a
  gatekeeper": l'LLM mai construeix directament el string de comanda final; selecciona una
  eina/operació i proporciona paràmetres tipats i validats per schema, i el codi orquestrador
  construeix la comanda real amb execució parametritzada (arrays d'arguments, no concatenació de
  strings), amb valors de paràmetre en allowlist.
- **FACT** — La validació de schema (arguments tipats, enums, rangs estrictes) és necessària però
  **no suficient per si sola** — cal aparellar-la amb mecanismes d'aplicació reals (allowlists
  d'hosts, normalització de rutes, allowlists de comandes).

### Escalada de privilegis i logging d'auditoria
- **FACT** — Risc anomenat "identity dilution": quan un agent actua mitjançant un compte de
  servei genèric/compartit, els logs no poden distingir si una acció va ser decisió autònoma de
  l'agent o una intervenció humana directa. L'arreglament recomanat és autenticació forta i
  diferenciada per instància d'agent.
- **FACT** — Camps mínims recomanats per a logs d'auditoria de crides a eines: nom de l'eina,
  paràmetres d'entrada complets, timestamps d'inici/finalització, durada, valor de retorn/error —
  més, a nivell de sessió, quin agent va actuar, quin usuari/procés va iniciar la sessió, versió
  del model, identificador únic de sessió. La bona pràctica s'estén a registrar el *raonament* de
  l'agent per a una acció, no només la crida i el resultat.
- **PROPOSAL** — Per AgentForge, el log d'auditoria s'hauria de tractar com a component de primer
  ordre: cada comanda SSH executada (o proposada i rebutjada/pendent) hauria de registrar-se amb
  comanda resolta completa, host destí, nom d'eina/operació, paràmetres subministrats per l'LLM,
  timestamp, durada, codi de sortida, referència a la sortida truncada/hash, si va caldre
  confirmació i com es va resoldre (auto-aprovada per política vs. aprovada per humà vs. denegada).
  Aquest log hauria de ser append-only i emmagatzemat fora de l'accés d'escriptura del propi agent
  si és factible, per sobreviure a un escenari d'agent compromès.

---

## 7. Patrons d'arquitectura — Gateway/broker entre agent i infraestructura

- **FACT** — El patró "AI Agent Gateway" és l'emergent com a resposta arquitectònica estàndard:
  un component de pla de control centralitzat s'interposa entre l'agent d'IA i la infraestructura
  destí; cada crida a eina de l'agent es tracta com una crida API que ha de passar per aquest
  gateway abans d'arribar al destí real — validant intenció, aplicant política d'autorització, i
  delegant l'execució a entorns d'execució aïllats i normalment de curta durada.
- **FACT** — Raonament per centralitzar en lloc que cada agent tingui credencials directes per
  destí: sense un broker, hi ha una explosió "M×N" de connexions punt-a-punt agent-a-sistema, amb
  credencials disperses i governança perduda; un gateway col·lapsa això a un únic punt de control.
- **FACT** — Principi de disseny de frontera de confiança clau: el gateway/broker corre en un
  domini de confiança separat de l'agent host — l'emmagatzematge de política, les claus per
  usuari/agent, i els secrets brokered viuen al costat del gateway de la frontera, i el propi
  procés de l'agent no té credencials capaces de llegir o reescriure política o secrets
  directament. Això significa que **fins i tot un agent completament compromès no pot escalar els
  seus propis privilegis ni saltar-se la política**, perquè mai va tenir les claus.
- **PROPOSAL** (aplicant el patró a la topologia concreta d'AgentForge): AgentForge mateix es
  proposa essencialment **ser aquest gateway** — la "capa d'eines amb permisos controlats"
  esmentada al briefing és el gateway/broker, entre l'agent Claude Code (el component de
  raonament "no fiable", segons el marc d'excessive-agency i prompt-injection de dalt) i els dos
  hosts remots. Concretament: (a) les claus privades SSH i qualsevol altra credencial remota
  haurien de viure al procés gateway/capa d'eines, mai directament exposades o llegibles pel
  context/entorn del propi LLM; (b) la capa d'eines, no l'LLM, construeix i executa les comandes
  SSH finals, aplicant l'allowlist/validació de schema/porta de confirmació de les seccions 2, 4 i
  6; (c) tota decisió d'execució i política es registra per la capa gateway, independentment del
  que el propi LLM informi; (d) com que AgentForge és d'un sol host/desenvolupador i no
  multi-tenant, un motor de política extern complet a l'estil OPA probablement és més del que cal
  inicialment — però la *forma* del patró (aplicació de política dura fora del control del model,
  crides d'eina estructurades, auditoria centralitzada) és directament aplicable a petita escala
  sense adoptar les eines empresarials específiques citades a les fonts.
- **NOT VERIFIED** — Si alguna de les fonts de patró de gateway aborda específicament el cas SSH
  com a transport (la majoria descriuen accés mediat per API/servidor MCP a infraestructura de
  núvol) en lloc de SSH cru a hosts bare-metal/VPS — el patró es descriu a un nivell prou general
  per aplicar-se de manera plausible, però no s'ha trobat cap font que discuteixi brokering
  específic de gateway per a SSH en detall. És una extrapolació raonable, no una troballa citada
  directament.

---

## Preguntes obertes marcades NOT VERIFIED / UNKNOWN per al document d'arquitectura

1. **NOT VERIFIED** — Versió real d'OpenSSH al servidor Debian de casa i al VPS Contabo —
   determina disponibilitat d'ed25519 i de funcionalitats d'autenticació per certificat (a
   comprovar quan comenci la implementació, correctament fora d'abast d'aquesta fase de recerca).
2. **NOT VERIFIED / UNKNOWN** — Si el model de protecció de Windows Credential Manager és adequat
   específicament contra un actor d'amenaça que és el propi procés de l'agent LLM.
3. **UNKNOWN** — No s'ha trobat cap font que descrigui en detall una implementació específica per
   SSH (a diferència de mediada per API/MCP a infraestructura de núvol) del patró gateway/broker.

## Fonts

Vegeu `docs/research/SOURCES.md` — aquest bloc aporta ~50 fonts consolidades allà amb URL,
extracció i confiança.
