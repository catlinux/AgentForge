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
| 3 | Tool Registry | Propuesta, no iniciada |
| 4 | Tool Discovery | Propuesta, no iniciada |
| 5 | Permission / Policy Engine | Propuesta, no iniciada |
| 6 | Secrets Broker | Propuesta, no iniciada |
| 7 | Ejecución remota / SSH | Propuesta, no iniciada |
| 8 | Integración MCP | Propuesta, no iniciada |
| 9 | Sessions | Propuesta, no iniciada |
| 10 | Audit Log | Propuesta, no iniciada |
| 11 | Connectors | Propuesta, no iniciada |
| 12 | Dashboard Web | Propuesta, no iniciada |
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
- **Fase 4 — Tool Discovery**: mecanismo de descubrimiento/reducción de herramientas expuestas al
  contexto del agente (inspirado conceptualmente en el Tool Router de Composio, sin su código).
- **Fase 5 — Permission / Policy Engine**: clasificación de acciones por riesgo/reversibilidad y
  aplicación de política fuera del control del modelo.
- **Fase 6 — Secrets Broker**: gestión de credenciales (claves SSH, tokens) nunca expuestas
  directamente al agente.
- **Fase 7 — Ejecución remota / SSH**: ejecutor SSH controlado y auditado hacia Debian de casa y
  VPS Contabo (sin tocar esos sistemas hasta que esta fase esté explícitamente autorizada).
- **Fase 8 — Integración MCP**: servidor(es) MCP propio(s) y/o hooks de Claude Code.
- **Fase 9 — Sessions**: gestión de sesiones de agente (identidad + herramientas + estado).
- **Fase 10 — Audit Log**: registro centralizado y consultable de todas las acciones.
- **Fase 11 — Connectors**: integraciones concretas con servicios externos (GitHub, Dropbox, etc.),
  solo tras autorización explícita.
- **Fase 12 — Dashboard Web**: interfaz de administración/visualización.
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
