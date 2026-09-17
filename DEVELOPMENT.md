# Desarrollo — AgentForge

Este documento describe el estado del entorno y proceso de desarrollo. AgentForge tiene código
funcional real desde la Fase 2 en adelante (8 paquetes TypeScript/Node.js bajo `packages/`, con
tests automatizados) — este documento describe tanto lo ya implementado y verificable como lo que
sigue siendo únicamente una decisión de diseño sin bootstrap de producción todavía (ver
"Limitación heredada" en cada bloque de fase abajo).

## Entorno de desarrollo actual

- **Sistema operativo de desarrollo:** Windows 11 Pro.
- **Editor:** VS Code + extensión de Claude Code.
- **Agente:** Claude Code (CLI/extensión).
- **Shells disponibles:** PowerShell y Git Bash.

El proyecto se plantea local-first; en fases futuras podrá comunicarse con un servidor Debian
doméstico y un VPS Contabo, pero **ningún sistema remoto ha sido tocado, configurado ni conectado
hasta la fecha** — toda la implementación de ejecución remota (Fase 7) se ha verificado
exclusivamente contra servidores SSH simulados localmente, nunca contra esos sistemas reales.

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

**DECIDIDO (DEC-070 a DEC-071, Fase 13, 2026-09-17):** canal real Execution Backend↔Secrets Broker
y revisión/DEC-036 — ver `decisions/DECISIONS.md`.

- **Canal Execution↔Secrets Broker:** mismo patrón de transporte que DEC-010/047 (interfaz
  agnóstica + named pipe/Unix socket con ACL de SO), contrato de dominio propio y minimalista
  (`packages/shared/src/secrets/execution-secrets-channel.ts`) que expone únicamente `get` de solo
  lectura — nunca la API completa del Secrets Broker (DEC-070). `startExecutionServer`/
  `startConnectorServer` construyen un cliente real por defecto cuando no se inyecta
  `getSshKeySecret`/`getTokenSecret` explícitamente, mismo patrón que `AuditWriter` (DEC-065).
- **DEC-036 no se reabre:** el canal real no cambia la topología de confianza Policy Engine↔Core
  (DEC-071) — sigue documentada la misma limitación de seguridad.
- **Revisión de seguridad sistemática:** 2 defectos reales encontrados y corregidos — mensaje IPC
  con forma inesperada podía tumbar el proceso servidor (ahora envuelto en un guard fail-closed);
  condición de carrera en el cliente del nuevo canal podía cruzar secretos de peticiones
  concurrentes (corregida con una cola FIFO por cliente). Ambos con test que reproduce el fallo
  original antes de corregir.
- **`SECURITY.md` actualizado**: refleja el estado real de implementación por primera vez desde su
  creación en Fase 0.5 — ya no describe únicamente principios sin código detrás.

**DECIDIDO (DEC-072 a DEC-074, Fase 14, 2026-09-17):** tests de integración real entre procesos,
cobertura de código, CI/CD pospuesto — ver `decisions/DECISIONS.md`.

- **Tests de integración:** directorio separado `tests/integration/`, workspace pnpm propio,
  script `pnpm run test:integration` distinto del `pnpm run test` rápido de siempre (DEC-072).
  Arrancan procesos reales del sistema operativo (Secrets Broker, execution-ssh,
  connector-github) contra un servidor SSH/HTTP simulado en loopback, nunca sistemas remotos
  reales.
- **Cobertura de código:** `@vitest/coverage-v8` vía `pnpm run test:coverage`, informativa, sin
  umbral bloqueante (DEC-073).
- **CI/CD:** pospuesto explícitamente a la Fase 15 (DEC-074).

**DECIDIDO (DEC-075 a DEC-079, Fase 15, 2026-09-17):** licencia, visibilidad del repositorio,
versionado, CI/CD, y traducción de documentos de arquitectura — ver `decisions/DECISIONS.md`.

- **Licencia:** MIT (DEC-075). Ver `LICENSE`.
- **Visibilidad del repositorio:** Público (DEC-076) — decisión documentada; el cambio real de
  visibilidad en GitHub queda pendiente de que el propio usuario lo aplique cuando lo considere
  oportuno, no se ejecutó en esta fase.
- **Versionado:** SemVer desde `0.1.0` (DEC-077) — primera release interna del estado actual del
  proyecto, no una afirmación de que sea ya un producto de producción completo.
- **CI/CD:** `.github/workflows/ci.yml`, matriz Linux/Windows, corre
  `typecheck`/`lint`/`format`/`test`/`build`/`test:integration` en cada push/PR a `master`
  (DEC-078).
- **Traducción:** `architecture/TECH-STACK-ANALYSIS.en.md` y
  `architecture/CORE-STRUCTURE-ANALYSIS.en.md` añadidos (DEC-079).

## Cómo ejecutar el proyecto

No existe todavía ningún `main`/CLI de producción real que arranque los procesos (`mcp-server`,
`execution-ssh`, `connector-github`, `secrets-broker`, `dashboard`) como un despliegue completo —
hallazgo explícito de la Fase 12, documentado como limitación heredada, candidato a una fase
futura dedicada (ver `decisions/DECISIONS.md`, DEC-065/069). Cada paquete se ejecuta y verifica
hoy mediante:

- `pnpm run test` — tests unitarios/aislados de los 8 paquetes.
- `pnpm run test:integration` — tests de integración real entre procesos (`tests/integration/`,
  Fase 14), que sí arrancan procesos reales del sistema operativo, pero mediante scripts de test
  propios, no un bootstrap de producción.
- `packages/dashboard`: `startDashboard(port)` (`packages/dashboard/src/server.ts`) arranca un
  servidor real en `127.0.0.1:<port>` — es la única pieza con un punto de entrada pensado para
  ejecutarse fuera de test, aunque todavía sin script de arranque en `package.json`.

## Cómo instalar dependencias

`pnpm install` en la raíz del monorepo (gestor de paquetes decidido en DEC-009, vía Corepack).

## Estructura del repositorio

Ver `README.md`, sección "Cómo está organizado el proyecto", para la estructura actual completa.

## Control de versiones

- Repositorio Git **inicializado** (Fase 2, 2026-09-16), rama `master`.
- Identidad **local** del repositorio (no global, DEC-002): `catlinux <marc.catlinux@gmail.com>`
  — la identidad Git global de esta máquina (`warcrafted-server <warcrafted.server@gmail.com>`)
  nunca se ha modificado.
- Remoto: `https://github.com/catlinux/AgentForge` (DEC-001), accedido vía SSH. Visibilidad
  decidida como **Público** (DEC-076, Fase 15) — el cambio real en la configuración de GitHub
  queda pendiente de que el usuario lo aplique cuando lo considere oportuno, no ejecutado por
  este agente en ninguna fase.
- Cada commit y cada push requieren autorización explícita y separada del usuario (ver
  `.claude/CLAUDE.md`) — nunca se ejecutan automáticamente al cerrar una fase.
- CI (`.github/workflows/ci.yml`, DEC-078): se activa automáticamente en cada push/PR a `master`
  una vez el commit correspondiente se haya pusheado — no requiere autorización adicional más
  allá de la ya concedida para ese push, ya que no realiza ninguna acción distinta de ejecutar los
  mismos comandos que ya se ejecutan localmente en cada VERIFY.

## Licencia

**MIT** (DEC-075, Fase 15). Ver `LICENSE` en la raíz del repositorio.

Distinción importante (ver `docs/research/COMPOSIO-ANALYSIS.md` y `docs/research/MCP-ANALYSIS.md`
para el detalle completo de licencias de terceros investigadas):

- **Licencia de AgentForge (código propio):** MIT.
- **Licencias de proyectos analizados como referencia:**
  - Composio (SDK cliente): MIT, titular "Sampark Inc." — con una inconsistencia menor entre
    `LICENSE` (MIT) y `CONTRIBUTING.md` (ISC), marcada como `LEGAL REVIEW REQUIRED` de riesgo bajo
    en la investigación. El backend/ejecución/credenciales de Composio son propietarios y no están
    disponibles para reutilizar. Ningún código de Composio se ha reutilizado en AgentForge.
  - SDKs oficiales de MCP (TypeScript, Python): MIT / Apache 2.0 según paquete y versión.
  - Servidores de referencia MCP (`modelcontextprotocol/servers`): dual-licenciados Apache 2.0
    (código nuevo) / MIT (código existente).
- **Licencias de dependencias reales de producción:** `@modelcontextprotocol/sdk` (MIT/Apache 2.0
  según paquete), `ssh2` (MIT), `fastify` (MIT) — todas compatibles con MIT, ninguna con licencia
  copyleft fuerte.
- **Puntos que requieren revisión legal:** la inconsistencia MIT/ISC de Composio (riesgo bajo,
  documentada, no bloqueante). Ningún otro punto de riesgo legal detectado.

## Testing

- Framework: [Vitest](https://vitest.dev/) en todos los paquetes.
- `pnpm run test` — tests unitarios/aislados, rápidos, sin procesos reales del SO (43+ ficheros de
  test, 250+ tests, ver `STATE.md` para el conteo exacto por fase).
- `pnpm run test:integration` — tests de integración real entre procesos (Fase 14,
  `tests/integration/`), más lentos, requieren `pnpm run build` primero.
- `pnpm run test:coverage` — reporte de cobertura de código (`@vitest/coverage-v8`), informativo,
  sin umbral bloqueante (DEC-073).
- 2 tests de permisos POSIX (`packages/secrets-broker/src/storage/master-key.test.ts`) se omiten
  explícitamente en Windows — `chmod`/`stat().mode` no tienen la misma semántica en NTFS; sin
  verificación automatizada real en la plataforma de desarrollo actual, solo verificable en Linux.

## Variables de entorno / configuración

- `AGENTFORGE_DATA_DIR` — directorio base donde viven los ficheros de estado real de AgentForge
  (Audit Log JSON Lines por proceso, caché de Tool Registry, configuración de Discovery/Policy).
  Por defecto `~/.agentforge` si no se define (ver `packages/shared/src/paths/resolve-path.ts`,
  DEC-065/069). Nunca contiene secretos — esos viven cifrados en el propio Secrets Broker
  (`packages/secrets-broker`), en un fichero separado gestionado por DEC-030/032.
- Ninguna otra variable de entorno definida todavía. Nunca se documentan aquí valores reales de
  secretos (ver `SECURITY.md` y `.gitignore`).
