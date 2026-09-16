# ARCHITECTURE-DRAFT.md — AgentForge

> **Nota (Fase 1, 2026-09-16):** este documento es el registro histórico de las propuestas de la
> Fase 0. Cuatro de las preguntas abiertas de la sección 9 (relación con Claude Code, modelo de
> amenaza del Secrets Broker, alcance MCP, arquitectura SSH) ya han sido decididas — ver DEC-003 a
> DEC-006 en `decisions/DECISIONS.md` — y desarrolladas en detalle en
> `architecture/ARCHITECTURE.md` (Fase 1, español/inglés). Este documento se conserva sin
> modificar como referencia histórica; no reescribas su contenido.

**Estat: PROPOSAL. Cap decisió d'aquest document ha estat aprovada per l'usuari.** Vegeu
`decisions/DECISIONS.md` per a l'únic registre de decisions reals (actualment buit).

**Data:** 2026-09-16. Basat en les conclusions de `docs/research/RESEARCH-REPORT.md` i els
documents d'anàlisi detallats.

---

## 0. Pregunta prèvia que cal decidir abans de res

Abans de dissenyar capes, cal triar **quina relació té AgentForge amb Claude Code**. La
investigació (secció 9 de `CLAUDE-CODE-ANALYSIS.md`) identifica tres camins arquitectònicament
diferents:

- **(a) Embolcallar la CLI** com a subprocés (`-p`/`--output-format json`).
- **(b) Construir sobre l'Agent SDK** com a producte separat (no pot dir-se "Claude Code", sense
  login claude.ai).
- **(c) Estendre Claude Code in-place** via els seus propis punts d'extensió (hooks, servidors MCP
  propis, settings) sense runtime d'agent separat.

**PROPOSAL:** l'opció **(c)** sembla la de menys duplicació i la més coherent amb l'objectiu
declarat ("perquè Claude Code pugui utilitzar eines... de manera controlada"), atès que Claude
Code ja resol client MCP, permisos, hooks, subagents i skills a un nivell que seria car i
arriscat reconstruir. Aquesta és una proposta, no una decisió — cal validar-la explícitament amb
l'usuari abans d'implementar res.

---

## 1. Principi de disseny central: AgentForge com a gateway/broker

La literatura de seguretat consultada (secció 7 de `research/SSH-SECURITY-NOTES.md`) convergeix
en un patró clar per al problema exacte que AgentForge vol resoldre: un **gateway/broker** que
s'interposa entre l'agent (el component de raonament, tractat com a no fiable perquè és
manipulable via prompt injection) i la infraestructura real.

**PROPOSAL — principis de frontera de confiança:**
1. L'agent (Claude Code / l'LLM) **mai** té accés directe a credencials remotes (claus SSH, tokens
   d'API). Aquestes viuen a la capa de gateway.
2. L'agent **mai** construeix directament un string de comanda de shell final; selecciona una eina
   amb paràmetres tipats/validats per schema, i el gateway construeix i executa la comanda real
   (execució parametritzada, no interpolació de strings).
3. Tota decisió de política (què es pot executar, què necessita confirmació) s'aplica en codi que
   l'LLM no pot alterar — mai només com a instrucció de prompt/CLAUDE.md (els propis docs
   d'Anthropic marquen aquesta mateixa línia).
4. Tot el que passa pel gateway queda registrat en un log d'auditoria append-only, separat de
   l'accés d'escriptura del propi agent.

Aquest principi no és una decisió sobre tecnologia concreta — és un criteri per avaluar qualsevol
disseny concret que es proposi després.

---

## 2. Capes proposades (PROPOSAL, a justificar una per una — no totes són necessàries)

```
Claude Code (agent, raonament — no fiable)
        │  (hooks: PreToolUse / PostToolUse, o servidor(s) MCP propis)
        ▼
AgentForge — capa de gateway/broker
   ├── Tool Registry      — catàleg d'eines disponibles (locals + remotes), amb schema
   ├── Permission Layer   — classificació read-only / write-reversible / destructive; gating HITL
   ├── Secrets Broker     — accés a credencials (SSH keys, API tokens), mai exposat a l'agent
   ├── Audit Log          — registre append-only de cada crida, decisió de política i resultat
   └── Execution Backends — SSH executor (Debian casa, Contabo), connectors API, MCP servers propis
        ▼
Sistemes locals / remots (Debian casa, VPS Contabo, GitHub, Dropbox, APIs externes)
```

### Justificació de cada peça (o per què podria no calder)

- **Tool Registry** — **PROPOSAL, justificat**: és el forat #2 identificat a
  `CLAUDE-CODE-ANALYSIS.md` (§10) — Claude Code no té un registre d'eines cross-project/cross-màquina.
  Sense això, cada projecte hauria de reconfigurar `.mcp.json` per separat.
- **Permission Layer** — **PROPOSAL, justificat però amb matís**: Claude Code ja té un motor de
  permisos local granular (§3 de CLAUDE-CODE-ANALYSIS.md). AgentForge **no hauria de duplicar-lo**
  per a accions locals — només necessita una capa de política pròpia per a les accions que passin
  pel gateway (execució remota), que Claude Code no cobreix.
- **Secrets Broker** — **PROPOSAL, justificat**: forat confirmat (§7 de CLAUDE-CODE-ANALYSIS.md) —
  Claude Code delega gestió de secrets externa via hooks de shell-out, sense vault unificat.
- **Audit Log** — **PROPOSAL, justificat**: forat confirmat — Claude Code no agrega historial de
  crides entre sessions/màquines.
- **Execution Backends (SSH executor)** — **PROPOSAL, justificat**: forat confirmat — l'eina Bash
  de Claude Code és local, sense suport remot de primer nivell.
- **Un motor de política complet a l'estil OPA** — **PROPOSAL, descartat per a la fase 1**:
  sobredimensionat per a un sol desenvolupador/dues màquines; la *forma* del patró (aplicació dura
  fora del control del model) és aplicable a petita escala sense l'eina empresarial concreta.

---

## 3. Com s'hi enganxa Claude Code (mecanisme concret, PROPOSAL)

Dues opcions no excloents, a explorar:

1. **Hooks HTTP (`PreToolUse`/`PostToolUse`)** apuntant a un servei local d'AgentForge — Claude
   Code ja envia JSON amb context de la crida; AgentForge podria validar/bloquejar/registrar sense
   que l'agent en sigui conscient. Avantatge: no cal que AgentForge sigui un servidor MCP; pot
   interceptar qualsevol eina, no només les pròpies.
2. **Servidor(s) MCP propis d'AgentForge** (p.ex. un servidor `agentforge-ssh` que exposa eines
   específiques com `apache_status()`, `docker_restart(service)`, més un `execute_restricted()`
   de fallback molt controlat) — Claude Code ja sap parlar MCP nativament (§1 de
   CLAUDE-CODE-ANALYSIS.md), així que això reutilitza tota la infraestructura de transport/auth/
   aprovació existent.

**PROPOSAL:** els servidors MCP propis (opció 2) semblen la via principal per exposar *nonves
capacitats* (eines SSH concretes), mentre que els hooks (opció 1) semblen més adequats per a
*política transversal* (auditoria, bloqueig, classificació de risc) aplicada a qualsevol eina,
incloses les MCP de tercers que l'usuari afegeixi. Probablement calen totes dues, amb
responsabilitats diferenciades — a validar.

---

## 4. Execució remota (SSH) — disseny proposat

Basat en `research/SSH-SECURITY-NOTES.md`:

- **PROPOSAL** — Catàleg híbrid d'eines: un conjunt creixent d'eines específiques amb allowlist
  (`apache_status()`, `docker_restart(service)`, `disk_usage()`...) per a operacions anticipades, més
  un `execute_restricted()` de fallback molt restringit (`command=` a `authorized_keys`,
  `no-pty`, `no-port-forwarding`, `no-agent-forwarding`, wrapper validador server-side amb
  allowlist de subcomandes) que **sempre** requereix confirmació humana síncrona i mai
  s'auto-aprova.
- **PROPOSAL** — Classificació d'accions en 3 nivells (només lectura → auto; escriptura
  reversible/baix impacte → allowlist explícita; destructiu/alt impacte → confirmació humana
  sempre, sense excepcions).
- **PROPOSAL** — Autenticació: clau ed25519 dedicada per host (Debian casa, Contabo), sense agent
  forwarding; `known_hosts` fixat manualment/fora de banda abans de qualsevol automatització;
  `StrictHostKeyChecking yes` en estat estacionari. Reconsiderar una CA SSH només si el nombre de
  hosts/operadors creix significativament.
- **PROPOSAL** — Timeouts diferenciats (connexió vs. execució), captura sempre de stdout+stderr+exit
  code com a camps separats, sense reintents automàtics d'operacions no idempotents.
- **PROPOSAL** — La sortida de comandes remotes es tracta com a dada no fiable: mai s'alimenta de
  nou a un context amb autoritat de crida d'eines en viu sense tornar a passar per la porta de
  confirmació/allowlist (mitigació de prompt injection indirecta via output).

---

## 5. Gestió de secrets — disseny proposat

- **PROPOSAL** — Clau privada SSH i passphrase: Windows Credential Manager (via integració
  `ssh-agent` nativa d'OpenSSH-for-Windows).
- **PROPOSAL** — Altres credencials (tokens d'API d'altres serveis): SOPS+age o equivalent
  senzill, versionable si cal, sense necessitat d'infraestructura de servidor.
- **NOT VERIFIED / pregunta de disseny oberta** — Cap font trobada aborda si aquest model de
  protecció és adequat contra un escenari on l'atacant potencial és el propi procés de l'agent LLM
  corrent a la mateixa màquina (amenaça diferent de "atacant remot" o "portàtil robat"). Cal
  decidir explícitament si el Secrets Broker ha de córrer com a procés separat amb el seu propi
  usuari/permisos del SO, no només com una llibreria dins el mateix procés que crida l'LLM.
- **PROPOSAL, descartat per a fase 1** — Vault/gestor de secrets empresarial: sobredimensionat per
  a un sol desenvolupador.

---

## 6. Auditoria — disseny proposat

- **PROPOSAL** — Camps mínims per registre: comanda resolta completa, host destí, nom
  d'eina/operació, paràmetres subministrats per l'LLM, timestamp, durada, codi de sortida,
  referència a sortida truncada/hash, si va caldre confirmació i com es va resoldre
  (auto-aprovada / aprovada per humà / denegada).
- **PROPOSAL** — Log append-only, emmagatzemat fora de l'abast d'escriptura del propi agent.
- **E — INVESTIGAR MÉS**: format/emmagatzematge concret (fitxer local, SQLite, altres) — no
  decidit en aquesta fase.

---

## 7. MCP — decisions de disseny pendents

- **PROPOSAL** — Si AgentForge construeix servidors MCP propis, dirigir-los a l'espec `2026-07-28`
  ("Modern") com a objectiu principal, però avaluar si cal suport "Dual-era" en funció de quins
  servidors de tercers concrets es vulguin integrar.
- **PROPOSAL** — No dependre de sampling ni roots (ambdós deprecats a l'espec MCP actual).
- **PROPOSAL** — Aplicar des del disseny inicial les mitigacions de seguretat documentades a
  l'espec (token passthrough, SSRF, confused deputy) si AgentForge exposa qualsevol servidor MCP
  remot — no com a afegit posterior.

---

## 8. El que aquest document NO decideix

- Llenguatge/stack d'implementació d'AgentForge.
- Format concret de configuració (YAML/JSON/TOML) per al Tool Registry.
- Si AgentForge serà un sol procés local o diversos serveis.
- Detall del protocol entre hooks de Claude Code i el gateway d'AgentForge.
- Qualsevol integració amb GitHub, Dropbox o altres APIs externes esmentades al brief (fora
  d'abast d'aquesta fase, prohibit tocar-les).

Aquestes preguntes són per a la següent fase, un cop l'usuari validi (o rebutgi/modifiqui) els
principis d'aquest esborrany.

---

## 9. Riscos oberts a validar amb l'usuari abans d'implementar

1. Relació amb Claude Code: opció (a), (b) o (c) de la secció 0.
2. Model d'amenaça per al Secrets Broker respecte al propi procés de l'agent (secció 5).
3. Abast MCP "Modern-only" vs. "Dual-era" (secció 7).
4. Si cal una CA SSH o n'hi ha prou amb claus per host per a la fase 1 (secció 4).
