# Roadmap — AgentForge

Este documento es una **propuesta de planificación**, no una autorización para ejecutar las fases
siguientes. Cada fase requiere que el usuario la autorice explícitamente antes de empezar. El
desglose de fases posteriores a la 1 es especialmente provisional: puede cambiar en función de las
decisiones de arquitectura que todavía están abiertas.

## Estado de las fases

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Investigación técnica | **Completada** |
| 0.5 | Fundamentos del proyecto y gobernanza | **En curso** |
| 1 | Arquitectura y decisiones tecnológicas | **Completada** — 5 decisiones aprobadas (DEC-003 a DEC-007), base arquitectónica en `architecture/ARCHITECTURE.md` |
| 2 | Arquitectura núcleo | **En curso** — 5 decisiones aprobadas (DEC-008 a DEC-012), esqueleto todavía no creado |
| 3 | Tool Registry | **En curso** — 5 decisiones aprobadas (DEC-013 a DEC-017) |
| 4 | Tool Discovery | **En curso** — 5 decisiones aprobadas (DEC-018 a DEC-022) |
| 5 | Permission / Policy Engine | **En curso** — 7 decisiones aprobadas (DEC-023 a DEC-029, incluye DEC-023b) |
| 6 | Secrets Broker | **En curso** — 7 decisiones aprobadas (DEC-030 a DEC-036) |
| 7 | Ejecución remota / SSH | **En curso** — 6 decisiones aprobadas (DEC-037 a DEC-042) |
| 8 | Integración MCP | **En curso** — 5 decisiones aprobadas (DEC-043 a DEC-047) |
| 9 | Sessions | **En curso** — 4 decisiones aprobadas (DEC-048 a DEC-051) |
| 10 | Audit Log | **Completada** — 6 decisiones aprobadas (DEC-052 a DEC-057) |
| 11 | Connectors | **Completada** — 6 decisiones aprobadas (DEC-058 a DEC-063) |
| 12 | Dashboard Web | **Completada** — 6 decisiones aprobadas (DEC-064 a DEC-069) |
| 13 | Hardening de seguridad | Propuesta, no iniciada |
| 14 | Testing e integración | Propuesta, no iniciada |
| 15 | Documentación y release | Propuesta, no iniciada |
| 16 | Stable Release | Propuesta, no iniciada |

## Fase 0 — Investigación técnica (completada)

Investigación de Composio, MCP, Claude Code/VS Code, y patrones de SSH/seguridad para agentes.
Ver `docs/research/RESEARCH-REPORT.md` para la síntesis completa.

## Fase 0.5 — Fundamentos del proyecto y gobernanza (en curso)

Organización profesional del proyecto: documentación de gobernanza (README, CONTRIBUTING,
DEVELOPMENT, SECURITY), estructura de idiomas, preparación para Git/GitHub. Sin implementación de
software.

## Fase 1 — Arquitectura y decisiones tecnológicas (completada)

Las 5 preguntas arquitectónicas principales quedaron resueltas: DEC-003 (extensión in-place con
Claude Code), DEC-004 (Secrets Broker como proceso separado), DEC-005 (MCP Modern-only), DEC-006
(claves SSH dedicadas por host), y DEC-007 (stack tecnológico: TypeScript/Node.js). La base
arquitectónica completa está en `architecture/ARCHITECTURE.md` (y su equivalente en inglés), con
el análisis de stack en `architecture/TECH-STACK-ANALYSIS.md`. Quedan preguntas de detalle de
implementación (framework HTTP concreto, formato del Tool Registry, mecanismo de IPC, etc.,
listadas en `architecture/ARCHITECTURE.md` §20) deliberadamente pospuestas a la Fase 2, para no
decidir de más en esta fase. Todavía sin implementación de software funcional.

## Fases 2–16 (propuesta provisional, sujeta a revisión tras la Fase 1)

Estas fases son una descomposición inicial razonable dado lo investigado en la Fase 0, pero **no
están comprometidas**. Tras la Fase 1 podría tener sentido fusionar, dividir o reordenar algunas
de ellas.

- **Fase 2 — Arquitectura núcleo**: estructura base del proyecto de software. 5 decisiones
  aprobadas (DEC-008 a DEC-012, ver `architecture/CORE-STRUCTURE-ANALYSIS.md` y
  `decisions/DECISIONS.md`): monorepo con workspaces (`packages/shared`, `packages/core`,
  `packages/secrets-broker`), pnpm como gestor de paquetes, IPC Core↔Secrets Broker mediante named
  pipe (Windows) / Unix domain socket (Linux-macOS) tras una interfaz agnóstica, TypeScript
  estricto + ESLint + Prettier + Vitest, y esqueleto de carpetas todavía sin crear. Sin
  funcionalidad todavía.
- **Fase 3 — Tool Registry**: catálogo de herramientas disponibles (locales + remotas) con schema.
  5 decisiones aprobadas (DEC-013 a DEC-017, ver `decisions/DECISIONS.md`): modelo de datos propio
  MCP-compatible (no MCP-native), almacenamiento en configuración declarativa + caché no
  autoritativa (sin SQLite), catálogo estático+dinámico con frontera explícita Registry/Discovery/
  Policy Engine, identidad estable (`identity`/`qualified name`/`schema fingerprint`) con reglas de
  no-herencia automática, y ubicación dentro de `packages/core` (sin paquete propio).
- **Fase 4 — Tool Discovery**: mecanismo de descubrimiento/reducción de herramientas expuestas al
  contexto del agente (inspirado conceptualmente en el Tool Router de Composio, sin su código).
  5 decisiones aprobadas (DEC-018 a DEC-022, ver `decisions/DECISIONS.md`): filtro estático por
  configuración (sin uso/historial ni relevancia semántica todavía), configuración declarativa
  propia y separada de la del Registry, salida mediante proyección propia reducida
  (`DiscoveredToolView`, sin exponer `identity` interna), exclusión automática de entradas
  `stale`, y ubicación dentro de `packages/core` sin paquete propio.
- **Fase 5 — Permission / Policy Engine**: clasificación de acciones por riesgo/reversibilidad y
  aplicación de política fuera del control del modelo. 7 decisiones aprobadas (DEC-023 a DEC-029,
  ver `decisions/DECISIONS.md`): clasificación de riesgo de 3 niveles declarada explícitamente por
  el usuario en configuración propia (nunca en `ToolEntry`, nunca inferida ni autodeclarada por el
  servidor MCP), constante por `identity` según el peor caso razonable (DEC-023b — la modulación
  por argumentos queda fuera de esta fase); motor de reglas derivado del riesgo con overrides
  simples `allow`/`deny` por `identity`; resultado ternario con razón estructurada; invalidación
  automática de aprobación ante cambio de `schemaFingerprint`; sin persistencia/auditoría propia;
  configuración en fichero JSON propio; ubicación dentro de `packages/core`.
- **Fase 6 — Secrets Broker**: gestión de credenciales (claves SSH, tokens) nunca expuestas
  directamente al agente. 7 decisiones aprobadas (DEC-030 a DEC-036, ver
  `decisions/DECISIONS.md`): almacenamiento en fichero cifrado propio (AES-256-GCM), modelo de
  secreto `SecretRecord` con 5 kinds, clave maestra en fichero separado con permisos de SO
  (arranque desatendido, pérdida irrecuperable por diseño), API mínima
  `get`/`create`/`update`/`delete`/`exists`/`listMetadata`, `SecretId` propio sin binding
  autodeclarado por Core, y **sin** evidencia criptográfica de autorización entre Policy Engine y
  Secrets Broker en esta fase — con la limitación de seguridad resultante documentada
  explícitamente (Policy Engine comparte proceso con Core, DEC-029, así que no puede actuar como
  autoridad independiente frente a un Core comprometido).
- **Fase 7 — Ejecución remota / SSH**: ejecutor SSH controlado y auditado hacia Debian de casa y
  VPS Contabo (sin tocar esos sistemas hasta que esta fase esté explícitamente autorizada). 6
  decisiones aprobadas (DEC-037 a DEC-042, ver `decisions/DECISIONS.md`): comandos parametrizados
  con plantilla fija por tool (nunca shell arbitraria); confirmación humana síncrona propia de
  Execution, vinculada por hash determinista (identity+parámetros+host+schemaFingerprint), de un
  solo uso, con timeout y rechazo por defecto — los hooks de Claude Code fueron descartados tras
  verificación técnica explícita (no ofrecen pausa-y-reanudación ni señal verificable de
  confirmación humana); configuración de hosts en JSON propio; límites de stdout/stderr sin
  loguear contenido; timeout de conexión SSH con cierre forzado; paquete propio
  `packages/execution-ssh` (patrón ya reservado por DEC-008).
- **Fase 8 — Integración MCP**: servidor(es) MCP propio(s) y/o hooks de Claude Code. 5 decisiones
  aprobadas (DEC-043 a DEC-047, ver `decisions/DECISIONS.md`): un único servidor MCP (agnóstico de
  backend, vía Discovery), paquete propio `packages/mcp-server`, confirmación humana durante
  `tools/call` mediante progreso periódico + gestión explícita de cancelación (DEC-045, amplía
  DEC-038 sin modificarla), transporte stdio, y servidor MCP/Execution como **procesos separados**
  comunicados por un canal del mismo patrón de DEC-010 (DEC-047) — precisamente porque stdio ocupa
  stdin/stdout del servidor MCP, en conflicto directo con `ReadlineConfirmationChannel`. Hooks de
  Claude Code quedan documentados como extensión futura posible, no implementados en esta fase.
- **Fase 9 — Sessions**: gestión de sesiones de agente (identidad + herramientas + estado). 4
  decisiones aprobadas (DEC-048 a DEC-051, ver `decisions/DECISIONS.md`): alcance
  single-user/single-agent (sin reabrir DEC-047); `SessionId` como identificador ligero de
  correlación, sin fusionar los registros ya existentes de Policy Engine/Execution bajo una
  entidad; generado por el propio servidor MCP (no derivado del SDK — `StdioServerTransport` no
  expone `sessionId` de transporte, verificado técnicamente); tipo en `packages/shared`, sin
  paquete ni proceso propio.
- **Fase 10 — Audit Log**: registro centralizado y consultable de todas las acciones. 6 decisiones
  aprobadas (DEC-052 a DEC-057, ver `decisions/DECISIONS.md`): cada proceso (servidor MCP,
  Execution) escribe sus propios eventos, sin componente dedicado nuevo; JSON Lines append-only,
  un fichero por proceso escritor; `operationId` nuevo por invocación (distinto de `SessionId` y
  de `OperationHash`), propagado a Execution y a cancelación; minimización estricta de datos
  (nunca secretos/claves/stdout-stderr completos/parámetros en bruto); persistencia best effort,
  nunca bloqueante ni condicionante de la operación real.
- **Fase 11 — Connectors**: integraciones concretas con servicios externos. 6 decisiones aprobadas
  (DEC-058 a DEC-063, ver `decisions/DECISIONS.md`): patrón "Connector Execution Backend" —
  paquete propio por conector (`packages/connector-github`), mismo patrón de proceso separado que
  `execution-ssh` (DEC-047/042); reutilización del contrato `ExecutionRequest`/`ExecutionOutcome`
  existente, con una nueva variante `"executed-http"` aditiva; autenticación por Personal Access
  Token vía `SecretKind "token"` ya existente, sin OAuth en esta fase; 3 operaciones GitHub con
  plantilla fija (`create_issue`, `list_issues`, `comment_on_issue`), nunca HTTP arbitrario;
  `fetch` nativo de Node, sin dependencia HTTP nueva. El servidor MCP enruta entre procesos
  Execution Backend por `ToolEntry.origin.id`, sin dejar de ser un único servidor MCP (DEC-043).
  Limitación conocida y heredada de `execution-ssh`: ningún backend tiene hoy un canal real hacia
  el Secrets Broker en producción (DEC-010 sin implementación real) — fuera de alcance de esta
  fase, candidata a Fase 13 o una fase dedicada.
- **Fase 12 — Dashboard Web**: interfaz de solo lectura sobre Tool Registry/Discovery, Policy
  Engine y Audit Log. 6 decisiones aprobadas (DEC-064 a DEC-069, ver `decisions/DECISIONS.md`):
  acceso a datos por lectura directa de los mismos ficheros que ya consume Core (sin API externa
  nueva, sin reabrir §14); bootstrap mínimo para que `startStdioServer`/`startExecutionServer`/
  `startConnectorServer` construyan un `AuditWriter` real por defecto cuando no se les inyecta uno
  (cierra un hueco heredado de la Fase 10: nunca se instanciaba con una ruta real); Fastify como
  framework HTTP (sin dependencias con compilación nativa); frontend HTML servido + JavaScript
  mínimo sin toolchain de build; sin autenticación, bind exclusivo a `127.0.0.1`; convención
  `AGENTFORGE_DATA_DIR` extendida a las rutas de configuración de Registry/Discovery/Policy (mismo
  hueco heredado, resuelto solo para lectura). Paquete nuevo `packages/dashboard`. Sin ejecución,
  sin gestión de secretos, sin edición — puro solo-lectura en esta fase.
- **Fase 13 — Hardening de seguridad**: revisión y refuerzo de seguridad de todo lo anterior.
- **Fase 14 — Testing e integración**: pruebas automatizadas y de integración end-to-end.
- **Fase 15 — Documentación y release**: preparación de release pública/interna.
- **Fase 16 — Stable Release**: primera versión estable.

## Decisiones pendientes que condicionan este roadmap

Ver `decisions/DECISIONS.md` y `architecture/ARCHITECTURE-DRAFT.md` §9 para el detalle. En
resumen:

1. Modelo de integración con Claude Code (CLI / Agent SDK / MCP+hooks / combinación).
2. Modelo de seguridad del Secrets Broker frente al propio proceso del agente.
3. Estrategia MCP (Modern-only vs. Dual-era).
4. Arquitectura de ejecución remota (claves por host vs. CA SSH).
5. Licencia del proyecto.
6. Uso o no de GitHub, y con qué cuenta/repositorio.
