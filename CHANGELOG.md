# Changelog

Todas las entradas relevantes del proyecto se documentan en este archivo. El proyecto todavía no
tiene versiones publicadas (no hay releases ni tags) — todo el trabajo actual vive bajo
`Unreleased`.

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/), adaptado: como no hay
releases todavía, no se usa versionado semántico hasta la primera release.

## [Unreleased]

### Fase 14 — Testing e integración (2026-09-17, en curso)

#### Añadido
- `tests/integration/` — tests de integración real entre procesos (MCP-server↔Execution↔Secrets
  Broker), con servidores SSH/HTTP simulados localmente (nunca contra sistemas remotos reales).
- Cobertura de código (`@vitest/coverage-v8`), informativa, sin umbral bloqueante.

### Fase 13 — Hardening de seguridad (2026-09-17, completada)

#### Añadido
- Canal real Execution Backend↔Secrets Broker (`packages/shared/src/secrets/`,
  `packages/secrets-broker/src/ipc/execution-secrets-server.ts`) — sustituye la función inyectada
  mockeada que usaban `execution-ssh`/`connector-github` desde su creación.
- `SECURITY.md` reescrito para reflejar el estado real de implementación (Fases 1-13).

#### Corregido
- Fail-closed real en los servidores IPC (`execution-server.ts`, `connector-server.ts`): un
  mensaje válido pero con forma inesperada podía tumbar el proceso completo.
- Condición de carrera en el cliente del canal de secretos que podía cruzar el secreto de una
  petición con el de otra bajo concurrencia — corregida con una cola FIFO.

Ver `decisions/DECISIONS.md` (DEC-070, DEC-071) y `STATE.md` para el detalle completo.

### Fase 12 — Dashboard Web (2026-09-17, completada)

#### Añadido
- `packages/dashboard/` — interfaz web de solo lectura (Fastify + HTML/JS sin build) sobre Tool
  Registry, Tool Discovery, Policy Engine y Audit Log.
- `packages/shared/src/paths/` — convención de rutas reales en disco (`AGENTFORGE_DATA_DIR`).

Ver `decisions/DECISIONS.md` (DEC-064 a DEC-069) y `STATE.md` para el detalle completo.

### Fase 11 — Connectors (2026-09-17, completada)

#### Añadido
- `packages/connector-github/` — Execution Backend para GitHub (3 operaciones con plantilla fija,
  autenticación por Personal Access Token vía Secrets Broker).

Ver `decisions/DECISIONS.md` (DEC-058 a DEC-063) y `STATE.md` para el detalle completo.

### Fase 10 — Audit Log (2026-09-17, completada)

#### Añadido
- `packages/shared/src/audit/` — modelo de eventos, `AuditWriter` (JSON Lines append-only, un
  fichero por proceso escritor, minimización estricta de datos sensibles).
- Escritura de eventos de auditoría en `packages/mcp-server` y `packages/execution-ssh`.

Ver `decisions/DECISIONS.md` (DEC-052 a DEC-057) y `STATE.md` para el detalle completo, incluida
una segunda ronda de correcciones tras revisión del código publicado.

### Fase 9 — Sessions (2026-09-17, completada)

#### Añadido
- `packages/shared/src/session/` — `SessionId` como identificador ligero de correlación, generado
  por el servidor MCP al arrancar.

Ver `decisions/DECISIONS.md` (DEC-048 a DEC-051) y `STATE.md` para el detalle completo.

### Fase 8 — Integración MCP (2026-09-17, completada)

#### Añadido
- `packages/mcp-server/` — servidor MCP propio (transporte stdio), único, agnóstico del backend de
  ejecución vía Discovery. Confirmación humana durante `tools/call` con progreso periódico y
  gestión de cancelación.
- Canal IPC MCP-server↔Execution (`packages/shared/src/mcp/execution-channel.ts`), procesos
  separados.

Ver `decisions/DECISIONS.md` (DEC-043 a DEC-047) y `STATE.md` para el detalle completo.

### Fase 7 — Ejecución remota / SSH (2026-09-17, completada)

#### Añadido
- `packages/execution-ssh/` — ejecutor SSH controlado: comandos con plantilla fija por tool,
  confirmación humana síncrona con hash determinista de un solo uso, límites de stdout/stderr,
  timeout de conexión.

#### Corregido
- Revisión de seguridad final: `client.ts` reconstruía una cadena de shell interpretable en el
  host remoto (`argv.join(" ")`) pese a que la plantilla ya resolvía los argumentos de forma
  segura — corregido con citado POSIX explícito (`ssh/shell-quote.ts`).

Ver `decisions/DECISIONS.md` (DEC-037 a DEC-042) y `STATE.md` para el detalle completo. Ningún
sistema remoto real (Debian de casa, VPS Contabo) fue tocado.

### Fase 6 — Secrets Broker (2026-09-16, completada)

#### Añadido
- `packages/secrets-broker/` — almacenamiento cifrado propio (AES-256-GCM), modelo `SecretRecord`
  con 5 kinds, clave maestra en fichero separado con permisos de SO.

Ver `decisions/DECISIONS.md` (DEC-030 a DEC-036) y `STATE.md` para el detalle completo, incluida la
limitación de seguridad documentada explícitamente (DEC-036).

### Fase 5 — Permission / Policy Engine (2026-09-16, completada)

#### Añadido
- `packages/core/src/policy/` — clasificación de riesgo en 3 niveles, motor de reglas con
  overrides, resultado ternario con razón estructurada.

Ver `decisions/DECISIONS.md` (DEC-023 a DEC-029) y `STATE.md` para el detalle completo.

### Fase 4 — Tool Discovery (2026-09-16, completada)

#### Añadido
- `packages/core/src/discovery/` — filtro estático por configuración, proyección reducida
  `DiscoveredToolView`.

Ver `decisions/DECISIONS.md` (DEC-018 a DEC-022) y `STATE.md` para el detalle completo.

### Fase 3 — Tool Registry (2026-09-16, completada)

#### Añadido
- `packages/core/src/registry/` — modelo de datos propio MCP-compatible, identidad
  estable/qualified name/schema fingerprint, caché no autoritativa en JSON.

Ver `decisions/DECISIONS.md` (DEC-013 a DEC-017) y `STATE.md` para el detalle completo.

### Fase 2 — Arquitectura núcleo (2026-09-16, completada)

#### Añadido
- Esqueleto del monorepo: `packages/shared`, `packages/core`, `packages/secrets-broker`, pnpm
  como gestor de paquetes, TypeScript estricto + ESLint + Prettier + Vitest.
- Repositorio Git inicializado y publicado en `https://github.com/catlinux/AgentForge`.

Ver `decisions/DECISIONS.md` (DEC-008 a DEC-012) y `STATE.md` para el detalle completo.

### Fase 1 — Arquitectura y decisiones tecnológicas (2026-09-16, completada)

#### Añadido
- `architecture/ARCHITECTURE.md`/`.en.md` — arquitectura completa aprobada.
- `architecture/TECH-STACK-ANALYSIS.md` — análisis de stack tecnológico.

#### Decidido
- DEC-003 a DEC-007: relación con Claude Code, modelo de amenaza del Secrets Broker, alcance MCP,
  arquitectura SSH, stack tecnológico (TypeScript/Node.js).

### Fase 0.5 — Fundamentos del proyecto y gobernanza (2026-09-16, completada)

#### Añadido
- `README.md` y `README.en.md` — documentación principal del proyecto (español/inglés).
- `CHANGELOG.md` (este archivo).
- `ROADMAP.md` — planificación de fases propuesta.
- `CONTRIBUTING.md` — guía de contribución.
- `DEVELOPMENT.md` — estado del entorno y proceso de desarrollo.
- `SECURITY.md` — principios de seguridad conocidos en esta etapa.
- `.claude/CLAUDE.md` — manual operativo para Claude Code.
- `.gitignore` — preparado para las tecnologías previstas del proyecto.

#### Notas
- En esta fase concreta todavía no se había implementado software funcional (llegó en la Fase 2
  en adelante — ver entradas más recientes arriba).
- Licencia y visibilidad del repositorio siguen pendientes de decisión (ver `decisions/DECISIONS.md`).
- Repositorio Git y GitHub se decidieron y activaron en fases posteriores (Fase 2).
- Se ha detectado y documentado una inconsistencia de idioma: la documentación de la Fase 0 está
  en catalán; a partir de esta fase el proyecto usa español/inglés (ver `README.md`).

### Fase 0 — Technical Research & Bootstrap (2026-09-16, completada)

#### Añadido
- `STATE.md` — estado del proyecto.
- `docs/research/RESEARCH-REPORT.md` — síntesis principal de conclusiones.
- `docs/research/COMPOSIO-ANALYSIS.md` — análisis de Composio (arquitectura, licencia,
  componentes reutilizables).
- `docs/research/MCP-ANALYSIS.md` — análisis del protocolo MCP.
- `docs/research/CLAUDE-CODE-ANALYSIS.md` — análisis de Claude Code, VS Code y el Agent SDK.
- `docs/research/SOURCES.md` — registro consolidado de fuentes.
- `research/SSH-SECURITY-NOTES.md` — notas de investigación sobre SSH y seguridad de agentes.
- `architecture/ARCHITECTURE-DRAFT.md` — primera propuesta de arquitectura (no aprobada).
- `decisions/DECISIONS.md` — creado vacío (ninguna decisión aprobada todavía).

#### Notas
- Ningún sistema remoto fue tocado, modificado o configurado durante esta fase.
- No se implementó ningún framework ni código de producción.
