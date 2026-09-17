# Desarrollo — AgentForge

Este documento describe el estado del entorno y proceso de desarrollo. AgentForge todavía no tiene
código funcional, así que buena parte de este documento describe lo que **está definido** frente
a lo que **todavía no**, en lugar de instrucciones de ejecución de una aplicación que no existe.

## Entorno de desarrollo actual

- **Sistema operativo de desarrollo:** Windows 11 Pro.
- **Editor:** VS Code + extensión de Claude Code.
- **Agente:** Claude Code (CLI/extensión).
- **Shells disponibles:** PowerShell y Git Bash.

Este es el entorno de desarrollo inicial. El proyecto se plantea local-first; en fases futuras
podrá comunicarse con un servidor Debian doméstico y un VPS Contabo, pero **ningún sistema remoto
ha sido tocado, configurado ni conectado hasta la fecha**.

## Stack tecnológico

**DECIDIDO (DEC-007, Fase 1, 2026-09-16): TypeScript/Node.js**, como stack único para todo
AgentForge (Core, servidores MCP propios, y el Secrets Broker como proceso separado en el mismo
lenguaje — ver `decisions/DECISIONS.md` y el análisis completo en
`architecture/TECH-STACK-ANALYSIS.md`).

Detalles todavía pendientes (no bloqueantes): framework HTTP concreto (Express/Fastify/otro),
paquete de acceso a Windows Credential Manager, y empaquetado exacto del Secrets Broker como
proceso independiente.

**DECIDIDO (DEC-008 a DEC-012, Fase 2, 2026-09-16):** estructura de repositorio, gestor de
paquetes, mecanismo de IPC, y convenciones de código — ver `decisions/DECISIONS.md` y el análisis
completo en `architecture/CORE-STRUCTURE-ANALYSIS.md`.

- **Estructura:** monorepo con workspaces — `packages/shared`, `packages/core`,
  `packages/secrets-broker` (DEC-008).
- **Gestor de paquetes:** pnpm, vía Corepack (DEC-009).
- **IPC Core↔Secrets Broker:** named pipe con ACL en Windows, Unix domain socket con permisos del
  SO en Linux/macOS, detrás de una interfaz de transporte agnóstica en `packages/shared`,
  seleccionada según `process.platform`. La rama Linux/macOS no está implementada todavía
  (DEC-010).
- **Convenciones de código:** TypeScript en modo estricto, ESLint + Prettier, Vitest (DEC-011).
- **Esqueleto de carpetas:** todavía NO creado — pendiente de un paso posterior explícitamente
  autorizado (DEC-012).

**DECIDIDO (DEC-013 a DEC-017, Fase 3, 2026-09-16):** modelo de datos, almacenamiento, alcance,
identidad/versionado y ubicación del Tool Registry — ver `decisions/DECISIONS.md`.

- **Modelo de datos:** propio de AgentForge, **MCP-compatible** (no MCP-native ni independiente),
  con adaptador MCP explícito en el borde de integración (DEC-013).
- **Almacenamiento:** configuración declarativa versionable (fuente de verdad de orígenes y
  metadatos propios) + caché ligera en fichero JSON, no autoritativa, sin SQLite (DEC-014).
- **Alcance:** estático (orígenes configurados) + dinámico (descubrimiento contra cada origen),
  con frontera explícita Registry (cataloga) / Discovery (filtra, Fase 4) / Policy Engine
  (autoriza, Fase 5) (DEC-015).
- **Identidad:** `identity` (interna, estable, generada solo por AgentForge) + `qualified name`
  (`origen:nombre`, legible) + `schema fingerprint` (hash del contrato observado), con reglas de
  no-herencia automática de identidad/autorización (DEC-016).
- **Ubicación:** `packages/core/src/registry/`, modelo de datos en `packages/shared`, sin paquete
  `packages/registry` propio (DEC-017).

**DECIDIDO (DEC-018 a DEC-022, Fase 4, 2026-09-16):** estrategia, configuración, salida,
tratamiento de `stale`, y ubicación del Tool Discovery — ver `decisions/DECISIONS.md`.

- **Estrategia:** filtro estático por configuración, con interfaz abierta a estrategias
  adicionales (uso/historial, relevancia semántica) no implementadas todavía (DEC-018).
- **Configuración:** fichero JSON propio, separado del fichero de orígenes del Registry
  (DEC-019).
- **Salida:** proyección reducida propia (`DiscoveredToolView`), sin `identity` interna ni
  acoplamiento directo a MCP (DEC-020).
- **Entradas `stale`:** excluidas automáticamente del resultado (DEC-021).
- **Ubicación:** `packages/core/src/discovery/`, sin paquete propio (DEC-022).

**DECIDIDO (DEC-023 a DEC-029, Fase 5, 2026-09-16):** origen/granularidad del riesgo, motor de
reglas, resultado, invalidación por schema, persistencia, configuración, y ubicación del Policy
Engine — ver `decisions/DECISIONS.md`.

- **Riesgo:** 3 niveles (`read-only`, `reversible-write`, `destructive`), declarados
  explícitamente por el usuario en configuración propia del Policy Engine, indexados por
  `identity` — nunca en `ToolEntry`, nunca inferidos ni autodeclarados por el servidor MCP.
  `identity` sin clasificación → `requires-confirmation` por defecto (DEC-023).
- **Granularidad:** constante por `identity`, según el peor caso razonable — la modulación de
  riesgo por argumentos de la invocación queda fuera de esta fase (DEC-023b).
- **Motor de reglas:** derivado del riesgo (`read-only`→`allow`, `reversible-write`→`allow` salvo
  override, `destructive`→`requires-confirmation` por defecto), con overrides simples
  `allow`/`deny` por `identity` — sin lenguaje de reglas expresivo (DEC-024).
- **Resultado:** ternario (`allow`/`deny`/`requires-confirmation`) con razón estructurada: regla
  aplicada, riesgo base, `identity`, `schemaFingerprint` (DEC-025).
- **Invalidación:** cualquier cambio de `schemaFingerprint` invalida la aprobación previa de esa
  `identity`, sin heurística de compatibilidad (DEC-026).
- **Persistencia:** ninguna — el Policy Engine no persiste ni emite eventos de auditoría
  (DEC-027).
- **Configuración:** fichero JSON propio, separado de Registry y Discovery (DEC-028).
- **Ubicación:** `packages/core/src/policy/`, sin paquete propio (DEC-029).

**DECIDIDO (DEC-030 a DEC-036, Fase 6, 2026-09-16):** almacenamiento, modelo de secreto, clave
maestra, API, identidad/control de acceso, ubicación, y evidencia de autorización del Secrets
Broker — ver `decisions/DECISIONS.md`.

- **Almacenamiento:** fichero cifrado propio (AES-256-GCM vía `node:crypto`, sin dependencia de
  OS credential store) — Linux Secret Service no es viable en el despliegue headless previsto
  (DEC-030).
- **Modelo:** `SecretRecord { id, kind, payload, metadata }`, `kind` ∈ `api-key`/`token`/
  `credential`/`ssh-key`/`generic` (DEC-031).
- **Clave maestra:** fichero separado, permisos de SO restringidos al usuario del Broker,
  arranque desatendido sin passphrase humana; pérdida de la clave es irrecuperable por diseño
  (DEC-032).
- **API:** `get`, `create`, `update`, `delete`, `exists`, `listMetadata` — sin rotación automática
  ni versionado histórico (DEC-033).
- **Identidad y control de acceso:** `SecretId` opaco propio (no reutiliza `ToolIdentity`); sin
  binding `allowedOrigins` autodeclarado por Core — sería falsa sensación de least privilege
  frente a un Core comprometido (DEC-034).
- **Ubicación:** `packages/secrets-broker/src/` (ya decidido por DEC-008/DEC-004), sin cambios
  (DEC-035).
- **Evidencia de autorización:** **no implementada en esta fase** — el Broker confía en el canal
  IPC autenticado por SO (DEC-010). **Limitación de seguridad documentada explícitamente:** Policy
  Engine corre en el mismo proceso que Core (DEC-029), por lo que no puede actuar como autoridad
  independiente frente a un Core comprometido; el Broker protege el almacenamiento y evita el
  acceso directo a los secretos fuera de su propio proceso, pero no puede impedir que un Core
  comprometido obtenga secretos a través del flujo de autorización legítimo ya disponible
  (DEC-036).

**DECIDIDO (DEC-037 a DEC-042, Fase 7, 2026-09-17):** modelo de comandos, confirmación humana,
configuración de hosts, límites de salida, timeout SSH, y ubicación de Execution — ver
`decisions/DECISIONS.md`.

- **Comandos:** plantilla fija por tool con parámetros tipados — nunca shell arbitraria ni
  argumentos libres (DEC-037).
- **Confirmación humana:** propia de Execution (no delegada a hooks de Claude Code, descartados
  tras verificación técnica), vinculada por hash determinista de
  identity+parámetros+host+schemaFingerprint, de un solo uso, con timeout y rechazo por defecto.
  Lógica de seguridad separada del mecanismo de interacción vía `ConfirmationChannel`, con
  `ReadlineConfirmationChannel` como única implementación de esta fase (DEC-038).
- **Configuración de hosts:** fichero JSON propio, separado de Registry/Discovery/Policy
  (DEC-039).
- **stdout/stderr:** límite de tamaño, nunca logueados en claro (DEC-040).
- **Conexión SSH:** timeout configurable, cierre forzado al expirar (DEC-041).
- **Ubicación:** `packages/execution-ssh`, paquete propio (DEC-042).

**DECIDIDO (DEC-043 a DEC-047, Fase 8, 2026-09-17):** número/ubicación del servidor MCP,
confirmación durante `tools/call`, transporte, y separación de procesos MCP↔Execution — ver
`decisions/DECISIONS.md`.

- **Servidor MCP:** único, agnóstico del backend de ejecución vía Discovery; paquete propio
  `packages/mcp-server` (DEC-043, DEC-044).
- **Confirmación durante `tools/call`:** progreso periódico (`notifications/progress`) mientras
  `confirmOperation()` (DEC-038) está pendiente; gestión explícita de `notifications/cancelled`
  con guard de estado atómico sobre `OperationHash` para la carrera cancelación/aprobación;
  cancelación tras confirmación aprobada no aborta la ejecución SSH ya comprometida, solo afecta a
  la entrega del resultado (DEC-045).
- **Transporte:** stdio local con Claude Code; ningún contenido no-MCP se escribe en stdout del
  servidor (DEC-046).
- **Procesos:** servidor MCP y Execution corren **separados** — Execution se arranca
  independientemente por el operador; comunicados por un canal del mismo patrón de transporte de
  DEC-010 (nueva interfaz de dominio, sin modificar `SecretsBrokerTransport`); fail-closed ante
  cualquier fallo/ambigüedad del canal; una única instancia de cada en esta fase, sin discovery
  multi-instancia (DEC-047).

**DECIDIDO (DEC-048 a DEC-051, Fase 9, 2026-09-17):** alcance, modelo, origen y ubicación de
Sessions — ver `decisions/DECISIONS.md`.

- **Alcance:** single-user/single-agent, sin reabrir DEC-047 (DEC-048).
- **Modelo:** `SessionId` como identificador ligero de correlación — sin fusionar los registros
  ya existentes de Policy Engine/Execution bajo una entidad `Session` (DEC-049).
- **Origen:** generado por el propio servidor MCP al arrancar — `StdioServerTransport` no expone
  `sessionId` de transporte, verificado con el SDK real (DEC-050).
- **Ubicación:** tipo en `packages/shared`, sin paquete ni proceso propio (DEC-051).

**DECIDIDO (DEC-052 a DEC-057, Fase 10, 2026-09-17):** arquitectura de escritura, formato de
persistencia, modelo de eventos, minimización de datos, propagación de identificadores, y
garantías del Audit Log — ver `decisions/DECISIONS.md`.

- **Escritura:** cada proceso (servidor MCP, Execution) escribe sus propios eventos, sin
  componente dedicado nuevo (DEC-052).
- **Persistencia:** JSON Lines append-only, un fichero por proceso escritor, permisos
  restringidos (DEC-053).
- **Modelo de eventos:** `operationId` nuevo por invocación — distinto de `SessionId` (agrupa
  toda una sesión) y de `OperationHash` (determinista sobre la tupla de confirmación, puede
  repetirse entre invocaciones) — propagado a Execution y al contrato de cancelación; `tool-invoked`
  solo con datos realmente disponibles en ese punto (DEC-054).
- **Minimización:** nunca secretos/claves SSH/passphrases/errores crudos; stdout/stderr y comando
  resuelto solo como metadato/hash; parámetros solo como nombres de clave; `hostname`/`username`
  excluidos en favor de `hostId` (DEC-055).
- **Propagación conjunta:** `sessionId` y `operationId` viajan juntos, fuera de la lógica de
  Policy Engine/`OperationHashRegistry`/ejecución (DEC-056).
- **Garantías:** best effort, nunca bloqueante ni condicionante de la operación real (DEC-057).

**DECIDIDO (DEC-058 a DEC-063, Fase 11, 2026-09-17):** modelo general, reutilización de contrato,
forma del resultado, autenticación, alcance funcional, y dependencia HTTP de Connectors — ver
`decisions/DECISIONS.md`.

- **Modelo general:** paquete propio por conector (`packages/connector-github`), mismo patrón de
  proceso Execution separado que `execution-ssh` (DEC-042/047) — nunca un macropaquete compartido
  entre conectores (DEC-058).
- **Contrato:** reutiliza `ExecutionRequest`/`ExecutionOutcome`/`ExecutionChannelRequest` tal cual
  (`hostId` reinterpretado como identificador de cuenta, ya opaco en su tipo) — el servidor MCP
  enruta entre procesos Execution Backend por `ToolEntry.origin.id`, sin dejar de ser un único
  servidor MCP (DEC-043/059).
- **Resultado HTTP:** nueva variante aditiva `ExecutionOutcome.kind === "executed-http"`
  (`statusCode`, `responseBytes`) — nunca fuerza una respuesta HTTP dentro de los campos SSH de
  `"executed"`; el cuerpo de la respuesta nunca se registra (DEC-060).
- **Autenticación:** Personal Access Token vía `SecretKind "token"` ya existente — sin OAuth ni
  `SecretKind` nuevo en esta fase; el usuario registra el PAT manualmente vía Secrets Broker
  (DEC-061).
- **Alcance funcional:** 3 operaciones GitHub con plantilla fija (`create_issue`, `list_issues`,
  `comment_on_issue`) — nunca método/path/body HTTP libre del agente (DEC-062).
- **Dependencia HTTP:** `fetch` nativo de Node, sin librería nueva (DEC-063).
- **Limitación heredada, documentada explícitamente:** ni `execution-ssh` ni `connector-github`
  tienen hoy un canal real hacia el Secrets Broker en producción — ambos reciben el secreto vía una
  función inyectada sin implementación real (DEC-010 sigue sin implementación en ningún sistema
  operativo). Fuera de alcance de Fase 11, candidata a Fase 13 o una fase dedicada.

**DECIDIDO (DEC-064 a DEC-069, Fase 12, 2026-09-17):** acceso a datos, bootstrap de Audit Log real,
framework HTTP, frontend, autenticación, y convención de rutas de configuración del Dashboard —
ver `decisions/DECISIONS.md`.

- **Acceso a datos:** lectura directa de los mismos ficheros que ya consumen Core/MCP server
  (Registry cache, Discovery/Policy config, Audit Log JSON Lines) — sin API HTTP externa nueva, sin
  reabrir §14 (DEC-064).
- **Bootstrap de Audit Log:** `startStdioServer`/`startExecutionServer`/`startConnectorServer`
  construyen internamente un `AuditWriter` real (vía `resolveAuditLogPath`) cuando el llamador no
  inyecta uno explícitamente — sin crear ningún `main`/CLI/proceso nuevo (DEC-065).
- **Framework HTTP:** Fastify, sin dependencias con riesgo de compilación nativa (DEC-066).
- **Frontend:** HTML servido por el propio servidor + JavaScript mínimo sin framework ni toolchain
  de build (DEC-067).
- **Autenticación:** ninguna en esta fase; bind exclusivo a `127.0.0.1` (DEC-068).
- **Rutas de configuración:** convención `AGENTFORGE_DATA_DIR` (ya introducida por DEC-065)
  extendida con `resolveRegistryCachePath`/`resolveDiscoveryConfigPath`/`resolvePolicyConfigPath`
  en `packages/shared`, usadas solo por el Dashboard para leer (DEC-069).
- **Ubicación:** `packages/dashboard`, paquete propio.
- **Limitación documentada:** ningún paquete tiene todavía un `main`/CLI real de producción —
  `startStdioServer`/`startExecutionServer`/`startConnectorServer` siguen siendo funciones de
  librería, nunca invocadas como proceso real fuera de test. El Dashboard de esta fase se verifica
  con fixtures generadas a mano, no con datos de una ejecución real.

## Cómo ejecutar el proyecto

No aplica todavía — no existe código funcional que ejecutar. Este apartado se completará cuando
exista una primera implementación real, con instrucciones verificadas (no supuestas).

## Cómo instalar dependencias

No aplica todavía. Este apartado se completará junto con la elección de stack tecnológico en la
Fase 1.

## Estructura del repositorio

Ver `README.md`, sección "Cómo está organizado el proyecto", para la estructura actual completa.

## Control de versiones

- El repositorio **todavía no está inicializado** con Git.
- La identidad Git global de esta máquina (`warcrafted-server <warcrafted.server@gmail.com>`) no
  corresponde aparentemente a este proyecto. **No se ha modificado la configuración global de
  Git.** Si se necesita una identidad específica para AgentForge, se configurará a nivel **local**
  del repositorio (`git config user.name`/`user.email` sin `--global`), previa autorización.
- No se ha decidido si el proyecto usará GitHub, y con qué cuenta/repositorio/visibilidad — ver
  `decisions/DECISIONS.md`.

## Licencia

**PENDIENTE DE DECISIÓN.** No se ha elegido todavía una licencia para el código de AgentForge. No
debe asumirse ninguna licencia por defecto.

Distinción importante (ver `docs/research/COMPOSIO-ANALYSIS.md` y `docs/research/MCP-ANALYSIS.md`
para el detalle completo de licencias de terceros investigadas):

- **Licencia de AgentForge (código propio):** pendiente de decisión del usuario.
- **Licencias de proyectos analizados como referencia:**
  - Composio (SDK cliente): MIT, titular "Sampark Inc." — con una inconsistencia menor entre
    `LICENSE` (MIT) y `CONTRIBUTING.md` (ISC), marcada como `LEGAL REVIEW REQUIRED` de riesgo bajo
    en la investigación. El backend/ejecución/credenciales de Composio son propietarios y no están
    disponibles para reutilizar.
  - SDKs oficiales de MCP (TypeScript, Python): MIT / Apache 2.0 según paquete y versión.
  - Servidores de referencia MCP (`modelcontextprotocol/servers`): dual-licenciados Apache 2.0
    (código nuevo) / MIT (código existente).
- **Licencias de dependencias futuras:** no aplicable todavía — no hay dependencias porque no hay
  código.
- **Puntos que requieren revisión legal:** la inconsistencia MIT/ISC de Composio (riesgo bajo,
  documentada, no bloqueante). Ningún otro punto de riesgo legal detectado en la Fase 0.

## Testing

No aplica todavía. Se documentará junto con la primera implementación funcional.

## Variables de entorno / configuración

No aplica todavía. Cuando exista implementación, cualquier variable de entorno o archivo de
configuración se documentará aquí — nunca con valores reales de secretos (ver `SECURITY.md` y
`.gitignore`).
