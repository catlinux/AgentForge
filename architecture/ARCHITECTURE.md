# ARCHITECTURE.md — AgentForge (Fase 1)

**Estado: base arquitectónica de la Fase 1.** Este documento sustituye funcionalmente a
`architecture/ARCHITECTURE-DRAFT.md` (Fase 0, catalán) como referencia de trabajo, sin eliminarlo
— el borrador se conserva como registro histórico de las propuestas iniciales. Este documento
recoge las decisiones ya aprobadas (DEC-003 a DEC-006, ver `decisions/DECISIONS.md`) y desarrolla
sobre ellas una arquitectura más concreta, marcando explícitamente qué sigue siendo propuesta y
qué queda como pregunta abierta.

**Fecha:** 2026-09-16. **Idioma:** español (principal) — ver `ARCHITECTURE.en.md` para la versión
en inglés equivalente.

Clasificación usada en todo el documento: **FACT/VERIFIED** (hecho verificado en la investigación
previa), **DECISION** (aprobada explícitamente por el usuario, con referencia `DEC-XXX`),
**PROPOSAL** (propuesta razonada de esta fase, no aprobada todavía), **OPEN QUESTION** (pregunta
genuinamente abierta que requiere decisión del usuario, probablemente en una fase posterior).

> **AgentForge es un proyecto independiente.** No se describe en ningún punto de este documento
> como alternativa, sustituto, fork o evolución de Composio ni de ningún otro proyecto estudiado
> en `docs/research/` o `docs/es/research/RELATED-PROJECTS.md`. Las ideas de esos proyectos se
> citan como inspiración puntual, nunca como plantilla a copiar.

---

## 1. Arquitectura general

**DECISION (DEC-003):** AgentForge se conecta a Claude Code como **extensión in-place**, vía
hooks (`PreToolUse`/`PostToolUse`) y/o servidores MCP propios — nunca como un runtime de agente
separado ni embolcallando la CLI como subproceso.

Esto fija la forma general del sistema:

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code (agente, razonamiento — componente NO confiable)    │
│  Ya resuelve: cliente MCP, permisos locales, hooks, subagents,   │
│  skills, sandboxing de Bash local, credenciales propias.         │
│  (ver docs/research/CLAUDE-CODE-ANALYSIS.md §10)                 │
└───────────────┬───────────────────────────┬─────────────────────┘
                │ hooks HTTP                │ MCP (stdio/HTTP)
                │ (PreToolUse/PostToolUse)  │
                ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  AGENTFORGE                                                      │
│                                                                   │
│  ┌───────────────┐   ┌───────────────┐   ┌────────────────────┐ │
│  │ Policy Hook    │   │ MCP Server(s) │   │ Tool Registry      │ │
│  │ Service        │   │ (ssh, otros)  │◄──┤ (catálogo + schema)│ │
│  │ (transversal)  │   │               │   └────────────────────┘ │
│  └───────┬────────┘   └───────┬───────┘                          │
│          │                    │                                  │
│          └─────────┬──────────┘                                  │
│                     ▼                                             │
│          ┌─────────────────────┐                                 │
│          │ Permission / Policy │                                 │
│          │ Engine (propio)     │                                 │
│          └──────────┬──────────┘                                 │
│                     ▼                                             │
│          ┌─────────────────────┐        ┌─────────────────────┐ │
│          │ Execution Backends  │◄──IPC──┤ Secrets Broker       │ │
│          │ (SSH executor, etc.)│  local  │ (proceso SEPARADO,   │ │
│          └──────────┬──────────┘        │  usuario propio SO — │ │
│                     │                    │  DEC-004)            │ │
│                     │                    └─────────────────────┘ │
│                     ▼                                             │
│          ┌─────────────────────┐                                 │
│          │ Audit Log           │ (append-only, fuera del alcance  │
│          │                     │  de escritura del agente)        │
│          └─────────────────────┘                                 │
└───────────────┬────────────────────────────────────────────────┘
                │ SSH (claves dedicadas por host — DEC-006)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Sistemas remotos: Debian de casa, VPS Contabo                   │
│  (Fase 0: PROHIBIDO tocar. Fase 1: solo diseño.)                 │
└─────────────────────────────────────────────────────────────────┘
```

**PROPOSAL:** dos puntos de entrada desde Claude Code, con responsabilidades diferenciadas (ver
§3 de `architecture/ARCHITECTURE-DRAFT.md`, ya propuesto en Fase 0, mantenido aquí):
- **Servidores MCP propios de AgentForge** exponen *nuevas capacidades* (herramientas SSH
  concretas, conectores) — Claude Code ya sabe hablar MCP nativamente, así que esto reutiliza toda
  la infraestructura de transporte/auth/aprobación existente sin duplicarla.
- **Hooks HTTP** (`PreToolUse`/`PostToolUse`) aplican *política transversal* (auditoría, bloqueo,
  clasificación de riesgo) sobre cualquier herramienta, incluidas las MCP de terceros que el
  usuario añada — no solo las propias de AgentForge.

**OPEN QUESTION:** si en la práctica hacen falta ambos mecanismos desde el primer momento, o si se
puede empezar solo con servidores MCP propios y añadir hooks transversales más adelante cuando
haya varias fuentes de herramientas que gobernar. Se propone **empezar solo con MCP propio** en la
Fase 2 (más simple, cubre el caso de uso inicial de ejecución SSH) y añadir hooks transversales
cuando exista más de una fuente de herramientas a gobernar — pero esto es una PROPOSAL de
secuenciación, no una decisión de arquitectura final.

---

## 2. Componentes principales y responsabilidades

| Componente | Responsabilidad | Estado |
|---|---|---|
| **Tool Registry** | Catálogo de herramientas disponibles (locales + remotas) con schema, versión y metadatos. Fuente de verdad de "qué existe". | PROPOSAL |
| **Tool Discovery** | Mecanismo para que un agente encuentre/seleccione herramientas relevantes sin cargar todo el catálogo en contexto. | PROPOSAL — ver §5 |
| **Permission / Policy Engine** | Clasifica acciones por riesgo/reversibilidad y decide auto-ejecutar, requerir allowlist o exigir confirmación humana. Solo para lo que Claude Code no cubre (acciones que pasan por el gateway). | PROPOSAL |
| **Secrets Broker** | Custodia credenciales (claves SSH, tokens). Proceso separado, usuario de SO propio (DEC-004). Nunca expone secretos directamente al agente. | DECISION (modelo de amenaza) + PROPOSAL (implementación) |
| **Execution Backends** | Ejecutan acciones reales: SSH executor (Fase 7, DEC-037 a DEC-042) y conector GitHub (Fase 11, DEC-058 a DEC-063) implementados; patrón abierto a más conectores. Construyen comandos/operaciones de forma parametrizada, nunca interpolando strings del LLM. | DECISION + IMPLEMENTADO (ver §9) |
| **Audit Log** | Registro append-only de cada acción propuesta/ejecutada, decisión de política y resultado. Fuera del alcance de escritura del agente. | PROPOSAL |
| **MCP Server(s) propios** | Exponen las capacidades de AgentForge a Claude Code (y a cualquier otro cliente MCP compatible) siguiendo la especificación `2026-07-28` (DEC-005). | DECISION (alcance) + PROPOSAL (implementación) |
| **Policy Hook Service** | Recibe eventos `PreToolUse`/`PostToolUse` de Claude Code, aplica política transversal. | PROPOSAL, secuenciado después de MCP propio (ver §1) |

**PROPOSAL — qué NO es un componente separado:** no se propone un motor de políticas externo
completo (tipo OPA), un "Session Manager" como servicio independiente en la fase 1, ni un dashboard web
funcional. Ver §16 para el detalle de qué queda fuera de esta fase.

---

## 3. Fronteras de confianza

**FACT/VERIFIED** (ya investigado en Fase 0, `research/SSH-SECURITY-NOTES.md` §7, y confirmado por
DEC-004): el agente/LLM es un componente de razonamiento manipulable (prompt injection directo o
indirecto vía salida de herramientas) y **no debe considerarse de confianza** para decisiones de
seguridad.

**PROPOSAL — fronteras de confianza concretas para AgentForge:**

```
Zona NO confiable          Zona de aplicación de política       Zona de credenciales
┌─────────────────┐        ┌──────────────────────────┐        ┌──────────────────┐
│  Claude Code /   │  MCP/  │  AgentForge Core          │  IPC   │  Secrets Broker   │
│  agente LLM      │─hooks─►│  (Tool Registry, Policy   │─local─►│  (proceso         │
│                  │        │   Engine, Execution        │        │   separado,       │
│  Nunca ve:       │        │   Backends, Audit Log)     │        │   usuario propio  │
│  - claves SSH    │        │                            │        │   del SO)         │
│  - tokens        │        │  Nunca ejecuta código que  │        │                   │
│                  │        │  el LLM construyó como     │        │  Único componente │
│                  │        │  string libre.             │        │  con acceso       │
│                  │        │                            │        │  directo a        │
│                  │        │                            │        │  credenciales.    │
└─────────────────┘        └──────────────────────────┘        └──────────────────┘
```

**PROPOSAL — reglas de frontera concretas:**
1. Ningún dato que cruce de la zona no confiable a la zona de política se ejecuta directamente;
   se valida contra schema (parámetros tipados de una tool concreta), nunca como string de shell
   libre.
2. La zona de política nunca tiene acceso de lectura directo a las credenciales — las solicita al
   Secrets Broker por referencia (p.ej. "usa la credencial `ssh:debian-casa`"), nunca por valor.
3. El Secrets Broker solo entrega una credencial tras validar que la solicitud viene de una
   ejecución ya aprobada por el Policy Engine — no atiende solicitudes directas del agente.
4. La salida de una ejecución remota (stdout/stderr) se trata como dato no confiable al volver a
   cruzar hacia el agente — no se le concede autoridad de acción implícita (mitigación de prompt
   injection indirecta, ya documentada en `research/SSH-SECURITY-NOTES.md` §6).

**OPEN QUESTION:** mecanismo concreto de IPC entre AgentForge Core y el Secrets Broker (socket
Unix/named pipe local, HTTP en loopback con autenticación por token, etc.) — depende del stack
tecnológico, todavía no elegido (ver §17).

---

## 4. Flujo entre agente, AgentForge, herramientas y sistemas remotos

**PROPOSAL — flujo para una acción de ejecución remota (caso principal de la fase 1):**

1. Claude Code (el agente) decide invocar una herramienta expuesta por un servidor MCP de
   AgentForge (p. ej. `docker_restart(service="apache", host="debian-casa")`).
2. El servidor MCP de AgentForge recibe la llamada con parámetros ya validados por schema JSON
   (responsabilidad de MCP, no de AgentForge — ver `docs/research/MCP-ANALYSIS.md` §3).
3. El Permission/Policy Engine clasifica la acción (solo lectura / escritura reversible /
   destructiva, ver `architecture/ARCHITECTURE-DRAFT.md` §4, mantenido como PROPOSAL) y decide:
   auto-ejecutar, requerir allowlist, o bloquear pendiente de confirmación humana síncrona.
4. Si procede ejecutar: el Execution Backend (SSH executor) solicita al Secrets Broker la
   credencial por referencia (`ssh:debian-casa`), nunca por valor directo.
5. El Secrets Broker valida que la solicitud viene de una ejecución aprobada y entrega la
   credencial únicamente al Execution Backend, en su propio espacio de proceso.
6. El Execution Backend construye la comanda SSH de forma parametrizada (nunca interpolando texto
   del LLM) y la ejecuta contra el host remoto correspondiente.
7. El resultado (stdout/stderr/exit code, cada uno como campo separado) se registra en el Audit
   Log y se devuelve al agente como dato — no como nueva autoridad de ejecución.
8. Cualquier acción posterior que el agente quiera tomar "a raíz de" ese resultado vuelve a pasar
   por el paso 3 — no hay encadenamiento automático de acciones sin pasar de nuevo por la política.

**OPEN QUESTION:** cómo se representa exactamente la "confirmación humana síncrona" del paso 3 en
la práctica de Claude Code — ¿un prompt de aprobación propio de AgentForge (fuera de Claude Code),
o se apoya en el mecanismo de aprobación de herramientas que Claude Code ya tiene
(`docs/research/CLAUDE-CODE-ANALYSIS.md` §1, §3)? **PROPOSAL preliminar:** apoyarse en el
mecanismo de aprobación nativo de Claude Code cuando sea posible (menos duplicación), reservando
un mecanismo propio de AgentForge solo para casos donde se necesite una confirmación más rica que
un simple allow/deny (p. ej. mostrar el diff exacto de lo que se va a ejecutar remotamente).

---

## 5. Modelo de Tool Registry

**DECISIÓN (DEC-013 a DEC-017, Fase 3):** modelo de datos, almacenamiento, alcance,
identidad/versionado y ubicación en el monorepo del Tool Registry ya están decididos — ver
`decisions/DECISIONS.md`. Resumen: modelo propio de AgentForge **MCP-compatible** (no MCP-native)
en `packages/shared`, con `identity`/`qualified name`/`schema fingerprint` como conceptos de
identidad separados y reglas explícitas de no-herencia automática; almacenamiento en configuración
declarativa versionada + caché no autoritativa (sin base de datos); catálogo estático (orígenes
configurados) + dinámico (descubrimiento), con la frontera Registry (cataloga) / Discovery (filtra,
§6) / Policy Engine (autoriza, §7) mantenida estrictamente; módulo en
`packages/core/src/registry/`, sin paquete propio. El resto de esta sección se conserva como
contexto/inspiración original de la Fase 1, ya superado en el detalle por las decisiones de Fase 3.

**PROPOSAL (contexto histórico, Fase 1 — ver DEC-013 a DEC-017 arriba para lo ya decidido):**

- El Tool Registry es el catálogo de herramientas que AgentForge expone (vía sus servidores MCP
  propios), con: identificador único, schema de entrada/salida (JSON Schema, coherente con el
  formato que usa MCP — `docs/research/MCP-ANALYSIS.md` §3), clasificación de riesgo (solo
  lectura / escritura reversible / destructiva — insumo directo para el Policy Engine), host(s)
  aplicables (para herramientas de ejecución remota), y versión.
- Inspiración de la investigación de Fase 0.7 (`docs/es/research/RELATED-PROJECTS.md`, sección
  "Tools y Registry"): el patrón **Resource / Resource Type** de Windmill (schema JSON + tipos
  reutilizables) y el registro **con versionado y rollback** de IBM ContextForge son referencias
  conceptuales válidas — no se propone copiar ninguna implementación concreta.
- A diferencia de Composio (`docs/research/COMPOSIO-ANALYSIS.md` §2), el Tool Registry de
  AgentForge no necesita modelar miles de integraciones de terceros — su ámbito inicial es un
  conjunto pequeño y creciente de herramientas de ejecución remota propias, más los servidores MCP
  de terceros que el usuario decida añadir a Claude Code directamente (que ya gestiona su propio
  catálogo vía `.mcp.json`, sin que AgentForge necesite duplicarlo).

~~**OPEN QUESTION:** formato de definición concreto (YAML/JSON/TOML) y si el registro vive en
ficheros de configuración versionados en git o en almacenamiento propio (base de datos local)~~ —
**resuelto en Fase 3, ver DEC-014.**

---

## 6. Descubrimiento de tools (Tool Discovery)

**DECISIÓN (DEC-018 a DEC-022, Fase 4):** estrategia de reducción, configuración declarativa,
forma de salida, tratamiento de `stale`, y ubicación en el monorepo ya están decididos — ver
`decisions/DECISIONS.md`. Resumen: filtro estático por configuración (sin uso/historial ni
relevancia semántica todavía, interfaz abierta a añadirlas después); configuración propia en JSON,
separada de la de orígenes del Registry; salida mediante proyección reducida propia
(`DiscoveredToolView`), sin exponer `identity`/`schemaFingerprint` internos ni acoplarse al formato
MCP; exclusión automática de entradas `stale` (DEC-016); módulo en `packages/core/src/discovery/`,
sin paquete propio. El resto de esta sección se conserva como contexto/inspiración original de la
Fase 1, ya superado en el detalle por las decisiones de Fase 4.

**PROPOSAL (contexto histórico, Fase 1 — ver DEC-018 a DEC-022 arriba para lo ya decidido):**

- Para la fase 1, con un catálogo pequeño (probablemente menos de 20 herramientas iniciales:
  ejecución SSH + algunas acciones específicas), el problema de "reducir el número de herramientas
  expuestas al contexto del LLM" que Composio resuelve con su Tool Router
  (`docs/research/COMPOSIO-ANALYSIS.md` §3) **no es todavía un problema real para AgentForge**. Se
  propone **no implementar descubrimiento dinámico en la fase 1** — exponer directamente el
  catálogo completo vía MCP estándar (`tools/list`), dejando que Claude Code gestione la selección
  como hace con cualquier otro servidor MCP.
- Si el catálogo crece significativamente en fases futuras, el patrón de **meta-tools** (una
  herramienta de búsqueda tipo `COMPOSIO_SEARCH_TOOLS` en lugar de exponer todo el catálogo
  directamente) es la idea más prometedora identificada en toda la investigación — tanto de
  Composio como de la federación namespaced de IBM ContextForge
  (`docs/es/research/RELATED-PROJECTS.md`, sección "Discovery"). Se deja explícitamente como
  **trabajo futuro, no de la fase 1**.

~~**OPEN QUESTION:** ninguna bloqueante para la fase 1~~ — **resuelto en Fase 4, ver DEC-018 a
DEC-022.** El patrón de meta-tools/búsqueda sigue siendo trabajo futuro fuera de esta fase.

---

## 7. Permisos y Policy Engine

**DECISIÓN (DEC-023 a DEC-029, Fase 5):** origen y granularidad de la clasificación de riesgo,
motor de reglas, forma del resultado, invalidación por cambio de schema, persistencia, y
configuración/ubicación del Policy Engine ya están decididos — ver `decisions/DECISIONS.md`.
Resumen: clasificación de riesgo de 3 niveles (`read-only`/`reversible-write`/`destructive`)
declarada explícitamente por el usuario en **configuración propia del Policy Engine**, indexada
por `identity` — **precisión importante sobre la PROPOSAL original de abajo:** la clasificación
NO vive en el Tool Registry ni en `ToolEntry` (eso habría requerido modificar el modelo aprobado
en DEC-013/DEC-016); vive en un fichero propio del Policy Engine, nunca inferida ni autodeclarada
por el servidor MCP de origen (DEC-023). Constante por `identity`, usando el peor caso razonable
cuando una tool tiene impactos distintos según argumentos — la modulación de riesgo por argumento
queda fuera de esta fase (DEC-023b). Motor de reglas derivado del riesgo con overrides simples
`allow`/`deny` por `identity`, sin lenguaje de reglas expresivo (DEC-024, resuelve la OPEN QUESTION
de abajo). Resultado ternario con razón estructurada (DEC-025). Invalidación automática de
aprobación ante cambio de `schemaFingerprint`, sin heurística de compatibilidad (DEC-026). Sin
persistencia/auditoría propia (DEC-027). Configuración en JSON propio, en
`packages/core/src/policy/`, sin paquete propio (DEC-028, DEC-029).

**PROPOSAL (contexto histórico, Fase 1 — ver DEC-023 a DEC-029 arriba para lo ya decidido, incluida
la corrección sobre dónde vive la clasificación de riesgo):**

- **No se duplica** el motor de permisos local de Claude Code (`.claude/settings.json`, reglas
  allow/ask/deny) — sigue siendo la autoridad para acciones locales del agente
  (`docs/research/CLAUDE-CODE-ANALYSIS.md` §3).
- El Policy Engine de AgentForge aplica **solo** a las acciones que pasan por sus propios
  servidores MCP o por el Policy Hook Service — es decir, ejecución remota y cualquier otra
  capacidad que AgentForge exponga.
- Clasificación de 3 niveles (ya propuesta en `architecture/ARCHITECTURE-DRAFT.md` §4, mantenida):
  1. **Solo lectura** → auto-ejecución, registrada, sin confirmación.
  2. **Escritura reversible / bajo impacto** → auto-ejecución solo si está en una allowlist
     explícita; si no, requiere confirmación.
  3. **Destructivo / alto impacto** → confirmación humana síncrona siempre, sin excepciones ni
     "auto-aprobar tras N ejecuciones correctas".
- ~~La clasificación de riesgo de cada herramienta vive en el Tool Registry (§5)~~ — **corregido
  por DEC-023: vive en configuración propia del Policy Engine, no en el Tool Registry ni en
  `ToolEntry`**, precisamente para no modificar el modelo ya aprobado en DEC-013/DEC-016.
- **FACT/VERIFIED** (aplicado como principio): la aplicación de esta política vive en código que
  el LLM no puede alterar, nunca solo como instrucción de prompt — coherente con la distinción que
  Anthropic mismo marca entre CLAUDE.md (guía) y settings/hooks (aplicación forzosa)
  (`docs/research/CLAUDE-CODE-ANALYSIS.md` §2, §10).

~~**OPEN QUESTION:** si el Policy Engine necesita un lenguaje de reglas propio (aunque sea simple)
o si basta con la clasificación de 3 niveles + allowlists planas para la fase 1.~~ — **resuelto en
Fase 5, ver DEC-024**: sin lenguaje de reglas expresivo, motor derivado del riesgo + overrides
simples por `identity`.

---

## 8. Gestión de secrets

**DECISION (DEC-004):** el Secrets Broker corre como **proceso separado, con usuario y permisos
propios del sistema operativo** — nunca comparte espacio de proceso ni identidad de SO con el
agente/Claude Code.

**DECISIÓN (DEC-030 a DEC-036, Fase 6):** almacenamiento, modelo de secreto, clave maestra, API,
identidad/control de acceso, y evidencia de autorización ya están decididos — ver
`decisions/DECISIONS.md`. Resumen: **fichero cifrado propio** (AES-256-GCM, sin depender de
Windows Credential Manager ni de ningún OS credential store — corrige la PROPOSAL de abajo, que
asumía Credential Manager sin haber evaluado su inviabilidad en despliegues Linux headless);
modelo `SecretRecord` de 5 kinds; clave maestra en fichero separado con permisos de SO, arranque
desatendido; API mínima `get`/`create`/`update`/`delete`/`exists`/`listMetadata`; `SecretId`
propio sin binding autodeclarado por Core. **Limitación de seguridad documentada explícitamente
(DEC-036):** con el Policy Engine (§7) dentro del mismo proceso que Core (DEC-029), no puede
actuar como autoridad independiente frente a un Core comprometido — el Secrets Broker protege el
almacenamiento y evita el acceso directo a los secretos fuera de su propio proceso, pero no puede
impedir que un Core comprometido obtenga secretos a través del flujo de autorización legítimo ya
disponible. Cerrar esa brecha exigiría separar Policy Engine de Core en otro proceso — decisión
mayor, no tomada aquí, candidata a una futura fase de hardening (Fase 13).

**PROPOSAL (contexto histórico, Fase 1 — ver DEC-030 a DEC-036 arriba para lo ya decidido, incluida
la corrección sobre el mecanismo de almacenamiento):**

- **Almacenamiento de la clave SSH y passphrase:** Windows Credential Manager, accedido
  únicamente por el proceso del Secrets Broker (no por el proceso que aloja al agente ni por el
  Execution Backend directamente) — ya propuesto en `architecture/ARCHITECTURE-DRAFT.md` §5,
  ahora reforzado por DEC-004: el hecho de que el Broker corra como usuario de SO distinto reduce
  (aunque no elimina del todo) el riesgo de que un proceso comprometido en el espacio del agente
  pueda leer el almacén de credenciales directamente.
- **Otras credenciales** (tokens de API): SOPS+age o equivalente simple, gestionado también desde
  el proceso del Secrets Broker — ver inspiración adicional de la Fase 0.7
  (`docs/es/research/RELATED-PROJECTS.md`, sección "Secrets"): el patrón de Activepieces de
  **cifrado de credenciales a nivel de campo con clave vía variable de entorno**
  (`AP_ENCRYPTION_KEY`) es el patrón con más detalle técnico primario verificado de toda la
  investigación — candidato concreto a adaptar (no copiar código) si se decide un almacenamiento
  propio en lugar de depender solo de Windows Credential Manager.
- **Interfaz de solicitud:** el resto de AgentForge nunca lee secretos directamente — solicita al
  Secrets Broker "usa la credencial X para esta operación ya aprobada", y el Broker es quien
  inyecta la credencial en el momento de la ejecución (patrón "check-then-request" de Arcade y
  "inyección en el Context sin exponer al LLM", `docs/es/research/RELATED-PROJECTS.md`, sección
  "OAuth / autenticación" — aplicable aquí aunque AgentForge no use OAuth para SSH).
- **Vault/gestor de secrets empresarial:** descartado para la fase 1 (ya decidido conceptualmente
  en Fase 0, confirmado por la investigación de Fase 0.7: casi ningún proyecto estudiado ofrece
  self-hosting verdaderamente completo y gratuito de sus capacidades de gestión de secretos —
  razón adicional para no depender de una herramienta de terceros de este tipo).

~~**OPEN QUESTION:** mecanismo exacto de IPC entre AgentForge Core y el Secrets Broker (ver §3)~~
— **resuelto en Fase 2 (DEC-010) y Fase 6 (DEC-030 a DEC-036).**

---

## 9. Ejecución remota / SSH

**DECISION (DEC-006):** claves ed25519 dedicadas por host (Debian de casa, VPS Contabo), sin
agent forwarding, para la fase 1.

**DECISIÓN (DEC-037 a DEC-042, Fase 7):** modelo de comandos, confirmación humana, configuración
de hosts, límites de salida, timeout, y ubicación de Execution ya están decididos — ver
`decisions/DECISIONS.md`. Resumen: comandos con **plantilla fija por tool** (nunca shell
arbitraria, coherente con el catálogo híbrido con allowlist ya esbozado abajo); confirmación
humana síncrona **propia de Execution** vinculada por hash determinista
(identity+parámetros+host+schemaFingerprint), de un solo uso, timeout, rechazo por defecto —
descartados explícitamente los hooks de Claude Code (`PreToolUse`) tras verificación técnica: no
ofrecen pausa-y-reanudación con estado externo ni ninguna señal verificable de aprobación humana
hacia procesos externos; configuración de hosts en JSON propio; stdout/stderr con límite de
tamaño, nunca logueados en claro; timeout de conexión SSH con cierre forzado; Execution vive en
`packages/execution-ssh`, paquete propio (patrón ya reservado por DEC-008). **Limitación
documentada explícitamente:** el mecanismo de confirmación de DEC-038 requiere un operador con
acceso interactivo directo al proceso Execution — no cubre despliegues sin sesión interactiva
disponible, donde toda operación `requires-confirmation` se deniega por defecto.

**PROPOSAL (contexto histórico, Fase 1 — ver DEC-037 a DEC-042 arriba para lo ya decidido):**

- Catálogo híbrido de herramientas: un conjunto creciente de herramientas específicas con
  allowlist (`apache_status()`, `docker_restart(service)`, `disk_usage()`...) para operaciones
  anticipadas, más un `execute_restricted()` de fallback muy restringido (`command=` en
  `authorized_keys`, `no-pty`, `no-port-forwarding`, `no-agent-forwarding`, wrapper validador
  del lado del servidor con allowlist de subcomandos) que **siempre** requiere confirmación humana
  síncrona.
- `known_hosts` fijado manualmente/fuera de banda antes de cualquier conexión automatizada;
  `StrictHostKeyChecking yes` en estado estacionario.
- Timeouts diferenciados (conexión vs. ejecución); captura siempre de stdout+stderr+exit code como
  campos separados; sin reintentos automáticos de operaciones no idempotentes.
- Inspiración adicional de la Fase 0.7: el patrón de **aislamiento de ejecución vía sandboxing de
  procesos** (nsjail en Windmill, sandbox pool en Activepieces —
  `docs/es/research/RELATED-PROJECTS.md`, sección "Remote Execution") es relevante pero se marca
  como **fuera de alcance de la fase 1**: nsjail es específico de Linux y la ejecución SSH ya
  corre en el host remoto (Debian), no en la máquina Windows — el aislamiento real lo debe aportar
  la configuración del propio host remoto (usuario de sistema dedicado, permisos mínimos), no
  AgentForge desde el lado del cliente.

**OPEN QUESTION:** si conviene crear en cada host remoto un usuario de sistema dedicado y
restringido para las operaciones de AgentForge (en lugar de usar una cuenta con más privilegios) —
esta es una decisión que afecta a los propios servidores remotos y por tanto **no se puede
implementar en esta fase** (prohibido tocar sistemas externos), pero debe quedar planificada para
cuando se autorice la Fase 7 (ejecución remota/SSH) del roadmap.

**DECISIÓN (DEC-058 a DEC-063, Fase 11 — Connectors):** el "conector API (futuro)" mencionado como
PROPOSAL en el componente **Execution Backends** (§2) ya está decidido y materializado con un
primer conector real, GitHub — ver `decisions/DECISIONS.md`. Resumen: **mismo patrón que Execution
SSH** — paquete propio (`packages/connector-github`), proceso Execution independiente, nunca hijo
del servidor MCP (DEC-058); reutiliza `ExecutionRequest`/`ExecutionOutcome`/
`ExecutionChannelRequest` sin nuevo protocolo, con `hostId` reinterpretado como identificador de
cuenta configurada (ya opaco en su tipo) — el servidor MCP enruta entre procesos Execution Backend
por `ToolEntry.origin.id`, sigue habiendo un único servidor MCP (DEC-043/059); nueva variante
aditiva `ExecutionOutcome.kind === "executed-http"` con `statusCode`/`responseBytes` — nunca fuerza
una respuesta HTTP en los campos SSH de `"executed"`, el cuerpo de la respuesta nunca se registra
(DEC-060); autenticación por Personal Access Token vía `SecretKind "token"` ya existente, sin OAuth
en esta fase (DEC-061); 3 operaciones GitHub con plantilla fija de endpoint+método+payload — nunca
método/path/body HTTP libre del agente, mismo principio que DEC-037 (DEC-062); `fetch` nativo de
Node, sin dependencia HTTP nueva (DEC-063). **Limitación conocida, compartida con Execution SSH:**
ningún Execution Backend tiene hoy un canal real hacia el Secrets Broker en producción — ambos
reciben el secreto vía una función inyectada sin implementación real (el canal Core↔Secrets Broker
de DEC-010 sigue sin implementación en ningún sistema operativo); fuera de alcance de esta fase,
candidato a Fase 13 (Hardening) o una fase dedicada.

---

## 10. Integración MCP

**DECISION (DEC-005):** alcance **Modern-only** — los servidores/clientes MCP propios de
AgentForge se dirigen exclusivamente a la especificación `2026-07-28`.

**DECISIÓN (DEC-043 a DEC-047, Fase 8):** número y ubicación del servidor MCP, confirmación
humana durante `tools/call`, transporte, y separación de procesos ya están decididos — ver
`decisions/DECISIONS.md`. Resumen: **un único servidor MCP** (`packages/mcp-server`) agnóstico del
backend de ejecución, consumiendo Discovery/Policy Engine/Execution ya construidos sin
reimplementarlos; transporte **stdio** con Claude Code, sin escribir jamás contenido no-MCP en
stdout; confirmación humana durante `tools/call` mediante progreso periódico
(`notifications/progress`) y gestión explícita de `notifications/cancelled`, ampliando DEC-038 sin
modificarla; y, crucialmente, **el servidor MCP y el proceso Execution corren separados**
(DEC-047) — el operador arranca Execution de forma independiente, comunicado con el servidor MCP
por un canal del mismo patrón de transporte de DEC-010 (nueva interfaz de dominio, sin modificar
`SecretsBrokerTransport`) — precisamente porque stdio ocupa el stdin/stdout del servidor MCP, en
conflicto directo con `ReadlineConfirmationChannel` (DEC-038). Resuelve, con esta arquitectura de
procesos separados, la pregunta abierta de secuenciación de §1: MCP como mecanismo primario de
descubrimiento e invocación en esta fase; los hooks de Claude Code quedan documentados como
extensión transversal futura posible, no implementados.

**PROPOSAL (contexto histórico, Fase 1 — ver DEC-043 a DEC-047 arriba para lo ya decidido):**

- No se construye ninguna dependencia central en **sampling** ni **roots** (ambos deprecados en la
  especificación actual — `docs/research/MCP-ANALYSIS.md` §3).
- Las mitigaciones de seguridad documentadas en la especificación (token passthrough, SSRF,
  confused deputy — `docs/research/MCP-ANALYSIS.md` §7) se aplican desde el diseño inicial de
  cualquier servidor MCP propio, no como añadido posterior.
- Los servidores MCP propios de AgentForge son, en la práctica, la superficie principal por la que
  Claude Code accede a las capacidades del gateway (ver §1) — es decir, MCP no es "una integración
  más" sino el mecanismo de transporte principal entre Claude Code y AgentForge.
- **Riesgo aceptado explícitamente por DEC-005:** posible falta de interoperabilidad con
  servidores MCP de terceros que todavía hablen la versión "Legacy" del protocolo. Esto no afecta
  a los servidores propios de AgentForge (que se construyen desde cero en Modern), pero sí sería
  relevante si en el futuro AgentForge quisiera *federar* servidores MCP de terceros existentes
  (patrón "virtual MCP servers" de IBM ContextForge,
  `docs/es/research/RELATED-PROJECTS.md`) — a revisar caso por caso, no ahora.

~~**OPEN QUESTION:** ninguna bloqueante — DEC-005 cierra la pregunta principal de esta sección para
la fase 1.~~ — **Fase 8 (DEC-043 a DEC-047) resuelve el resto de preguntas de implementación.**

---

## 11. Sesiones y estado

**DECISIÓN (DEC-048 a DEC-051, Fase 9):** alcance, modelo, origen y ubicación de Sessions ya están
decididos — ver `decisions/DECISIONS.md`. Resumen: alcance **single-user/single-agent** en esta
fase, sin reabrir DEC-047; `SessionId` como **identificador ligero de correlación**, nunca una
entidad `Session` que posea o fusione los registros ya existentes de Policy Engine
(`InMemoryPolicyApprovalStore`) o Execution (`OperationHashRegistry`) — esos registros permanecen
exactamente como están; generado por el propio servidor MCP al arrancar (no derivado del SDK MCP:
verificación técnica confirmó que `StdioServerTransport`, DEC-046, nunca expone `sessionId` de
transporte — esa capacidad es exclusiva de transportes HTTP/Streamable con reconexión); tipo en
`packages/shared`, sin paquete ni proceso propio.

**PROPOSAL (contexto histórico, Fase 1 — ver DEC-048 a DEC-051 arriba para lo ya decidido):**

- Ningún proyecto estudiado en la Fase 0.7 documentó con claridad primaria un modelo de "sesión de
  agente" tan desarrollado como el de Composio (identidad de usuario + acceso a herramientas +
  estado de autenticación + estado de ejecución en un objeto direccionable —
  `docs/research/COMPOSIO-ANALYSIS.md` §4). Se propone tomar ese modelo como **referencia
  conceptual** (no código) para el diseño futuro de sesiones de AgentForge, complementado
  ligeramente por el concepto de "Connection" de Nango (`docs/es/research/RELATED-PROJECTS.md`).
- Para la fase 1, dado que AgentForge tiene un único usuario (el propio desarrollador) y un número
  reducido de hosts, **no se propone un Session Manager como componente independiente todavía** —
  el "estado de sesión" relevante en esta fase inicial es simplemente: qué credenciales están
  disponibles para qué host (gestionado por el Secrets Broker, §8) y el historial de acciones
  (gestionado por el Audit Log, §12). Un concepto de sesión más rico (multi-usuario, múltiples
  agentes concurrentes) se deja como trabajo futuro explícito.

~~**OPEN QUESTION:** si AgentForge necesitará soportar múltiples agentes/usuarios concurrentes en
algún momento~~ — **resuelto en Fase 9, ver DEC-048**: no en esta fase; multi-agent/multi-user
quedan como evolución futura explícita.

---

## 12. Auditoría y observabilidad

**DECISIÓN (DEC-052 a DEC-057, Fase 10):** arquitectura de escritura, formato de persistencia,
modelo de eventos, minimización de datos, propagación de identificadores, y garantías ya están
decididos — ver `decisions/DECISIONS.md`. Resumen: cada proceso (servidor MCP, Execution) escribe
sus propios eventos de forma autónoma, sin componente dedicado nuevo; fichero JSON Lines
append-only por proceso escritor; `operationId` nuevo, único por invocación de `tools/call`,
explícitamente distinto de `SessionId` (Fase 9) y de `OperationHash` (DEC-038, que puede repetirse
entre invocaciones con los mismos argumentos), propagado a Execution y al contrato de cancelación;
minimización estricta (nunca secretos/claves/passphrases/stdout-stderr completos/parámetros en
bruto/comando resuelto en texto/hostname-username/errores crudos de librerías); persistencia best
effort, nunca bloqueante ni condicionante de la operación real que describe.

**PROPOSAL (contexto histórico, Fase 1 — ver DEC-052 a DEC-057 arriba para lo ya decidido):**

- Campos mínimos por registro: comanda resuelta completa, host destino, nombre de herramienta/
  operación, parámetros suministrados por el LLM, timestamp, duración, código de salida,
  referencia a la salida truncada/hash, si hizo falta confirmación y cómo se resolvió
  (auto-aprobada / aprobada por humano / denegada).
- Log append-only, almacenado fuera del alcance de escritura del propio agente.
- **Hallazgo de la Fase 0.7 relevante:** OpenTelemetry aparece como estándar de facto en 3 de los
  9 proyectos estudiados (IBM ContextForge, Arcade, Nango —
  `docs/es/research/RELATED-PROJECTS.md`, sección "Audit / Observability"). **PROPOSAL:** adoptar
  OpenTelemetry como formato de instrumentación en lugar de inventar un formato propietario, en
  cuanto el volumen de eventos lo justifique — para la fase 1, con un volumen bajo, un log
  estructurado simple (JSON Lines a fichero) es suficiente y más proporcionado.
- El patrón de **atribución "on-behalf-of"** de MCPX/Lunar.dev (cada acción trazable a un usuario o
  agente específico, `docs/es/research/RELATED-PROJECTS.md`) es directamente aplicable incluso con
  un único usuario humano: cada entrada de auditoría debe poder distinguir entre "el agente decidió
  esto autónomamente" y "el humano lo aprobó explícitamente" — relevante para la reconstrucción
  forense en caso de incidente.

~~**OPEN QUESTION:** formato/almacenamiento concreto (fichero local JSON Lines vs. SQLite vs.
otro)~~ — **resuelto en Fase 10, ver DEC-053.**

---

## 13. Storage / persistencia

**PROPOSAL:**

- Para la fase 1, con el alcance descrito arriba (catálogo pequeño de herramientas, un solo
  usuario, dos hosts remotos), **no se propone una base de datos como requisito de entrada**. El
  Tool Registry puede vivir en ficheros de configuración versionados (§5); el Audit Log en
  ficheros append-only (§12); el estado de sesión mínimo puede derivarse de lo anterior sin
  almacenamiento adicional.
- Si en fases posteriores el volumen de herramientas, hosts o historial de auditoría lo justifica,
  se propone migrar a SQLite (embebido, sin infraestructura de servidor adicional, coherente con
  el principio local-first de `README.md`) antes que a un motor de base de datos con servidor
  propio.

~~**OPEN QUESTION:** ninguna bloqueante para la fase 1~~ — **DEC-053 (Fase 10) confirma: sin base
de datos en esta fase, JSON Lines append-only.**

---

## 14. API interna/externa

**PROPOSAL:**

- **API interna** (entre los componentes de AgentForge — Core, Secrets Broker, Execution
  Backends): necesaria por la propia DEC-004 (procesos separados requieren algún mecanismo de
  comunicación). Ver §3, §8 — mecanismo concreto todavía abierto, depende del stack.
- **API externa** (para que otros clientes MCP distintos de Claude Code, o herramientas de
  terceros, puedan interactuar con AgentForge): **no se propone para la fase 1**. El alcance
  inicial es servir a Claude Code exclusivamente vía MCP; una API HTTP/REST propia más amplia
  queda como trabajo futuro explícito si AgentForge necesita soportar otros clientes.

**OPEN QUESTION:** ninguna bloqueante para la fase 1.

---

## 15. Dashboard / Web UI (a nivel arquitectónico)

**PROPOSAL:**

- El roadmap (`ROADMAP.md`) ya contempla una Fase 12 — Dashboard Web separada. Este documento no
  diseña el dashboard en detalle, pero deja constancia de una restricción arquitectónica: **si en
  el futuro se construye un dashboard, debe consumir los mismos componentes que Claude Code
  consume** (Tool Registry, Audit Log, Policy Engine) a través de una interfaz bien definida — no
  debe convertirse en un segundo camino de acceso a las credenciales o a la ejecución que evite el
  Policy Engine o el Secrets Broker.
- La investigación de Fase 0.7 no identificó ningún patrón técnico de dashboard suficientemente
  diferenciado como para destacarlo en esta fase (`docs/es/research/RELATED-PROJECTS.md`, sección
  "Dashboard") — se deja explícitamente como trabajo de una fase futura.

**OPEN QUESTION:** ninguna para la fase 1 — este componente está deliberadamente fuera de alcance.

---

## 16. Qué implementa AgentForge vs. qué se deja a Claude Code / MCP / componentes existentes

Tabla de responsabilidades, consolidando `docs/research/CLAUDE-CODE-ANALYSIS.md` §10 con las
decisiones de esta fase:

| Responsabilidad | Quién la resuelve | Razón |
|---|---|---|
| Cliente MCP (transportes, OAuth, scopes, aprobación de herramientas) | **Claude Code** | Ya maduro y mantenido activamente — duplicarlo sería puro riesgo sin beneficio (DEC-003) |
| Carga de contexto de proyecto (CLAUDE.md, rules, auto memory) | **Claude Code** | Resuelto completamente, sin huecos identificados |
| Motor de permisos local (acciones locales del agente) | **Claude Code** | Granular y ya probado; AgentForge no lo toca |
| Sandboxing local de Bash | **Claude Code** | Aplicación real a nivel de SO, no aplicable a ejecución remota de todas formas |
| Subagents (multi-agente dentro de una sesión) | **Claude Code** | Cubre el caso de uso de "agente especializado con herramientas restringidas" dentro de una sesión |
| Skills / slash commands | **Claude Code** | Mecanismo de procedimientos reutilizables ya resuelto |
| Gestión de credenciales propias de Claude Code | **Claude Code** | Su propia API key, resuelto con hook de rotación (`apiKeyHelper`) |
| Ejecución remota (SSH) controlada y auditada | **AgentForge** | Hueco confirmado — Bash de Claude Code es solo local |
| Registro de herramientas cross-proyecto | **AgentForge** (Tool Registry) | Hueco confirmado — MCP se configura por proyecto/usuario en Claude Code, sin registro central |
| Secrets Broker unificado entre herramientas | **AgentForge** | Hueco confirmado — Claude Code delega a hooks de "shell-out" por credencial, sin vault unificado |
| Audit Log centralizado entre sesiones/máquinas | **AgentForge** | Hueco confirmado — Claude Code no agrega historial entre sesiones |
| Policy Engine para acciones remotas | **AgentForge** | Hueco confirmado — el motor de permisos de Claude Code es solo local |
| Orquestación multi-agente/multi-máquina | **Fuera de alcance por ahora** | Hueco confirmado pero no priorizado en la fase 1; revisar en fases futuras si se vuelve necesario |

---

## 17. Dependencias tecnológicas principales

**DECISION (DEC-007):** **TypeScript/Node.js**, como stack único para todo AgentForge (Core,
servidores MCP propios, y el Secrets Broker como proceso separado en el mismo lenguaje). Análisis
completo de alternativas en `architecture/TECH-STACK-ANALYSIS.md`.

**Consecuencias directas de esta decisión:**
- SDK MCP oficial de TypeScript (Tier 1, confirmado maduro — `docs/research/MCP-ANALYSIS.md` §8)
  como base de los servidores MCP propios (§10).
- Librería `ssh2` para el Execution Backend de SSH (§9) — evita las limitaciones de
  timeout/exit-code documentadas para Paramiko en `research/SSH-SECURITY-NOTES.md` §3.
- Acceso a Windows Credential Manager (§8) vía una librería Node (a confirmar el paquete concreto
  en la Fase 2) desde el proceso del Secrets Broker.
- El Secrets Broker se despliega como proceso Node independiente bajo una cuenta de Windows
  distinta (DEC-004), lo que requiere que Node esté disponible en el `PATH` de esa cuenta —
  pequeño coste de configuración, no bloqueante.

**OPEN QUESTION (pospuesta deliberadamente a la Fase 2, para no decidir de más en esta fase):**
framework HTTP concreto dentro de Node (Express/Fastify/otro) para el Policy Hook Service (§1) si
finalmente se implementa; paquete concreto de acceso a Windows Credential Manager; detalles de
empaquetado/distribución del Secrets Broker como proceso independiente.

---

## 18. Seguridad

Ver `SECURITY.md` para los principios generales ya documentados en la Fase 0.5. Este documento
añade, específico de la Fase 1:

- **FACT/VERIFIED, aplicado como restricción de diseño:** las cuatro decisiones DEC-003 a DEC-006
  son, en conjunto, la respuesta arquitectónica de AgentForge al principio "el agente/LLM es un
  componente no confiable" (`SECURITY.md`): extensión in-place (no se le da a Claude Code un
  runtime nuevo con más superficie), Secrets Broker en proceso separado (aislamiento real, no solo
  lógico), MCP Modern-only (aplica las mitigaciones de seguridad más recientes de la especificación
  desde el principio), claves SSH dedicadas por host (blast radius acotado por host).
- **OPEN QUESTION** ya señalada en §3: mecanismo de IPC entre Core y Secrets Broker — su elección
  tiene implicaciones de seguridad directas (un socket Unix con permisos de fichero restringidos
  es más simple de razonar que un puerto HTTP local, por ejemplo) y debería decidirse junto con el
  stack tecnológico.

---

## 19. Extensibilidad y futuro multiidioma (i18n)

**PROPOSAL:**

- La arquitectura de componentes separados (Tool Registry, Policy Engine, Secrets Broker,
  Execution Backends) permite añadir nuevos Execution Backends (conectores API, otros protocolos)
  sin tocar el Policy Engine ni el Secrets Broker — esto es, en parte, el mismo principio de
  separación de responsabilidades que se observó en varios proyectos de la Fase 0.7 (Auth/Proxy/
  Functions en Nango, Local Zone/Platform Zone en Arcade). **Confirmado en la práctica en Fase 11**
  (DEC-058 a DEC-063, ver §9): el conector GitHub se añadió como `packages/connector-github` sin
  tocar `execution-ssh`, Policy Engine ni Secrets Broker.
- **i18n:** siguiendo `README.md` (español interfaz inicial, arquitectura preparada para i18n
  futuro sin implementarlo todavía), se propone que cualquier texto orientado a humanos que
  AgentForge genere en el futuro (mensajes de confirmación, entradas de log legibles, mensajes de
  error) evite hardcodear cadenas directamente en la lógica de negocio — sin implementar un
  sistema i18n completo en esta fase, basta con no acoplar el idioma a la lógica desde el
  principio (p. ej., separar claves de mensaje de su texto, aunque el catálogo de textos inicial
  solo tenga español).

**OPEN QUESTION:** ninguna bloqueante — esta sección es orientativa para no bloquear i18n futuro,
no una decisión de implementación ahora.

---

## 20. Resumen de decisiones vs. propuestas vs. preguntas abiertas de esta fase

### DECISIONES aprobadas en esta fase
- DEC-003 — Relación con Claude Code: extensión in-place.
- DEC-004 — Secrets Broker: proceso separado, usuario de SO propio.
- DEC-005 — Alcance MCP: Modern-only (`2026-07-28`).
- DEC-006 — Ejecución remota: claves SSH dedicadas por host, sin CA SSH en fase 1.
- DEC-007 — Stack tecnológico: TypeScript/Node.js (ver `architecture/TECH-STACK-ANALYSIS.md`).

### PREGUNTAS ABIERTAS que quedan pendientes (no bloqueantes para cerrar la Fase 1, a resolver en
fases posteriores o al implementar)
1. ~~Secuenciación exacta: ¿empezar con MCP propio y añadir hooks transversales después, o ambos
   desde el principio? (§1)~~ — **resuelto en Fase 8, ver DEC-043 a DEC-047**: MCP propio como
   mecanismo primario; hooks quedan como extensión transversal futura posible, no implementados.
2. ~~Mecanismo de confirmación humana síncrona: ¿nativo de Claude Code o interfaz propia de
   AgentForge? (§4)~~ — **resuelto en Fase 7, ver DEC-038**: interfaz propia de Execution — los
   hooks de Claude Code fueron descartados tras verificación técnica explícita.
3. ~~Formato de definición del Tool Registry y dónde vive (ficheros vs. almacenamiento propio)
   (§5)~~ — **resuelto en Fase 3, ver DEC-013, DEC-014, DEC-017** (modelo propio MCP-compatible en
   `packages/shared`; configuración declarativa + caché no autoritativa; módulo en
   `packages/core/src/registry/`, sin paquete propio).
4. ~~Lenguaje de reglas del Policy Engine: ¿allowlists planas o algo más expresivo? (§7)~~ —
   **resuelto en Fase 5, ver DEC-023 a DEC-029.**
5. ~~Mecanismo concreto de IPC entre AgentForge Core y el Secrets Broker (§3, §8, §18)~~ —
   **resuelto en Fase 2, ver DEC-010** (named pipe en Windows / Unix domain socket en Linux-macOS,
   tras interfaz agnóstica en `packages/shared`).
6. Usuario de sistema dedicado en cada host remoto (Debian, Contabo) — no se puede resolver sin
   tocar esos sistemas, pendiente para cuando se autorice la Fase 7 (§9)
7. Formato/almacenamiento del Audit Log (fichero JSON Lines vs. SQLite) (§12)
8. Soporte multi-usuario/multi-agente futuro (§11)
9. Framework HTTP concreto, paquete de Windows Credential Manager y empaquetado del Secrets
   Broker dentro del stack TypeScript/Node.js ya decidido (§17)
10. Licencia del proyecto (heredada de fases anteriores, ver `decisions/DECISIONS.md`)

Ninguna de estas preguntas bloquea considerar la Fase 1 completada como *base arquitectónica* — se
seguirán resolviendo a medida que se acerque su implementación concreta, según la metodología del
proyecto (`.claude/CLAUDE.md`).
