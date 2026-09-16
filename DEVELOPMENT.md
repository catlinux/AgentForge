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
