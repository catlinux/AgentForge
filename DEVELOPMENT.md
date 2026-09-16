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
