# AgentForge

**Estado del proyecto: release `0.1.0` — 15 fases completadas (investigación, gobernanza,
arquitectura núcleo, Tool Registry, Tool Discovery, Policy Engine, Secrets Broker, ejecución
remota SSH, integración MCP, Sessions, Audit Log, Connectors, Dashboard Web, Hardening de
seguridad, Testing e integración, y Documentación/release). Implementación real en
TypeScript/Node.js, con tests automatizados y CI. `0.1.0` es la primera release interna del
estado actual del proyecto — no implica que AgentForge sea ya un producto de producción completo
(sigue sin existir un `main`/CLI de producción real desplegable). Ver `STATE.md` para el detalle
completo y actualizado.**

[English version](README.en.md)

---

## Qué es AgentForge

AgentForge es un proyecto propio que construye una infraestructura modular que permite a agentes
de IA — inicialmente Claude Code — utilizar herramientas, MCP, conectores, sistemas remotos, APIs,
autenticación, permisos, descubrimiento de herramientas, sesiones y automatizaciones de forma
controlada, extensible y sin dependencia obligatoria de un proveedor externo.

El proyecto tomó como referencia, entre otras cosas, ideas y arquitectura presentes en Composio,
pero **no asume que haya que copiar Composio** ni que su arquitectura sea necesariamente la mejor
opción para este caso de uso. Ningún código de Composio ni de ningún otro proyecto estudiado ha
sido reutilizado.

## Qué problema resuelve

Claude Code ya resuelve muy bien una parte importante de "dar herramientas a un agente": cliente
MCP, permisos locales, hooks, subagentes, sandboxing de Bash y gestión de sus propias credenciales.
La investigación de la Fase 0 (ver `docs/research/`) identificó un conjunto de huecos concretos que
Claude Code no cubre — y AgentForge ya los implementa:

- **Ejecución remota (SSH) controlada y auditada** — `packages/execution-ssh`, con comandos
  parametrizados (nunca shell arbitraria) y confirmación humana síncrona para acciones de riesgo.
- **Un registro de herramientas consultable** — `packages/core` (Tool Registry + Tool Discovery).
- **Un broker de secretos unificado** — `packages/secrets-broker`, proceso separado con usuario y
  permisos propios del sistema operativo, almacenamiento cifrado (AES-256-GCM).
- **Un log de auditoría centralizado** — cada proceso escribe sus propios eventos en JSON Lines,
  con minimización estricta de datos sensibles.
- **Conectores a servicios externos** — `packages/connector-github`, con el mismo patrón de
  ejecución controlada que SSH.
- **Un dashboard web de solo lectura** — `packages/dashboard`, para visualizar Tool Registry,
  Discovery, Policy Engine y Audit Log.

AgentForge llena específicamente estos huecos — no reimplementa lo que Claude Code ya hace bien.

## Objetivos

- Aprovechar ideas y código open source cuando la licencia lo permita.
- Evitar dependencias innecesarias.
- Ser local-first.
- Ser modular y extensible.
- Ser seguro por diseño (el agente/LLM se trata como un componente potencialmente no confiable).
- Ser transparente: control real sobre herramientas y permisos, no solo a nivel de prompt.
- Permitir herramientas locales y remotas, en distintos proyectos y servidores.
- Permitir integrar servidores MCP externos y crear servidores MCP propios.
- Poder funcionar sin depender de Composio ni de ningún otro servicio externo concreto.
- Poder usar servicios externos de forma opcional cuando aporten valor real.

## Qué NO pretende hacer

- No pretende ser "un Composio gratis" ni clonar su producto.
- No pretende duplicar funcionalidad que Claude Code ya resuelve bien (cliente MCP, permisos
  locales, hooks, subagentes, sandboxing de Bash, gestión de sus propias credenciales).
- No expone una herramienta de shell genérica al agente — cada capacidad remota es una operación
  concreta con plantilla fija (principio de mínimo privilegio).

## Estado actual del proyecto

| Área | Estado |
|---|---|
| Investigación técnica (Composio, MCP, Claude Code, VS Code, SSH, seguridad) | **Completada** (Fase 0) |
| Fundamentos, documentación y gobernanza del proyecto | **Completada** (Fase 0.5) |
| Arquitectura y decisiones tecnológicas | **Completada** (Fase 1) |
| Arquitectura núcleo, Tool Registry, Tool Discovery, Policy Engine | **Completadas e implementadas** (Fases 2–5) |
| Secrets Broker, ejecución remota SSH, integración MCP | **Completadas e implementadas** (Fases 6–8) |
| Sessions, Audit Log, Connectors, Dashboard Web | **Completadas e implementadas** (Fases 9–12) |
| Hardening de seguridad | **Completada** (Fase 13) |
| Testing e integración | **Completada** (Fase 14) |
| Documentación y release | **Completada** (Fase 15) — release `0.1.0` |
| Implementación de software | **Sí — 8 paquetes TypeScript/Node.js reales, con tests automatizados** |
| Repositorio Git | Inicializado, con historial completo de fases |
| Repositorio remoto | `https://github.com/catlinux/AgentForge` — visibilidad decidida como Público (DEC-076), cambio real pendiente de aplicar por el usuario |
| CI/CD | GitHub Actions, matriz Linux/Windows (DEC-078) |
| Licencia | MIT (ver `LICENSE`) |

Ver `STATE.md` para el estado detallado y actualizado del proyecto en todo momento — es la única
fuente de verdad sobre el progreso real; este README se actualiza en cada fase pero puede quedar
puntualmente por detrás si no se ha sincronizado explícitamente.

## Arquitectura actual (implementada)

```
Claude Code (agente, razonamiento — tratado como no confiable)
        │  MCP (transporte stdio)
        ▼
packages/mcp-server — servidor MCP propio, único, agnóstico del backend de ejecución
   ├── packages/core — Tool Registry + Tool Discovery + Policy Engine
   ├── packages/secrets-broker — proceso separado, almacenamiento cifrado
   ├── packages/shared — tipos, contratos, Audit Log
   ├── packages/execution-ssh — Execution Backend: SSH controlado y auditado
   ├── packages/connector-github — Execution Backend: conector GitHub (API REST)
   └── packages/dashboard — interfaz web de solo lectura
        ▼
Sistemas locales / remotos (Debian de casa, VPS Contabo, GitHub — nunca tocados sin
autorización explícita separada; toda verificación se hace contra mocks/fixtures)
```

Cada componente corre como proceso separado, comunicado por canales IPC propios (named pipe en
Windows, Unix domain socket en Linux/macOS), con fail-closed uniforme ante cualquier ambigüedad.
El detalle completo de cada decisión está en `architecture/ARCHITECTURE.md` (y su equivalente
`architecture/ARCHITECTURE.en.md`) y en `decisions/DECISIONS.md` — más de 80 decisiones aprobadas
a lo largo de 15 fases. El documento original de la Fase 0, `architecture/ARCHITECTURE-DRAFT.md`,
se conserva como referencia histórica.

## Principios principales

1. El agente/LLM es un componente de razonamiento potencialmente manipulable (prompt injection) —
   nunca tiene acceso directo a credenciales ni construye libremente comandos de ejecución.
2. Toda decisión de política (qué se puede ejecutar, qué necesita confirmación humana) se aplica
   en código, no solo como instrucción de prompt.
3. Mínimo privilegio: cada herramienta expone solo lo que necesita, no una shell genérica cuando
   una operación concreta es suficiente.
4. Trazabilidad: toda acción relevante queda auditada.
5. No duplicar lo que Claude Code ya resuelve bien.

## Estado de la investigación

La Fase 0 (investigación técnica) está completa. Cubre Composio (arquitectura, licencia,
componentes reutilizables), el protocolo MCP (especificación, seguridad, ecosistema), Claude Code
y VS Code (qué resuelve y qué no), y patrones de ejecución remota/SSH y seguridad para agentes.

> **Nota de idioma:** los documentos de investigación de la Fase 0 (`docs/research/`, `research/`,
> `architecture/ARCHITECTURE-DRAFT.md`) están escritos en **catalán**, idioma en el que se
> encargó originalmente esa fase. A partir de la Fase 0.5 el proyecto adopta español como idioma
> principal e inglés como segundo idioma (ver más abajo). Esta inconsistencia de idioma entre
> fases está documentada como **PENDIENTE** en `STATE.md` y no se ha resuelto unilateralmente
> (traducir retroactivamente ~150KB de investigación no es una tarea de gobernanza y podría
> introducir errores de traducción en contenido técnico ya verificado).

Ver `docs/research/RESEARCH-REPORT.md` para la síntesis completa de conclusiones.

Adicionalmente, en la Fase 0.7 se hizo una exploración ligera de otros proyectos relacionados con
el ecosistema de herramientas para agentes de IA (Nango, Arcade, Windmill, IBM ContextForge, MCPX,
Activepieces, y de forma más breve Pipedream y Smithery), para identificar ideas y patrones
adicionales — no para elegir "el mejor proyecto" ni para modelar AgentForge sobre ninguno de ellos
en particular. Ver `docs/es/research/RELATED-PROJECTS.md`.

## Próximos pasos

Las 15 fases previstas para esta etapa del proyecto están completas. El ROADMAP contempla fase
16 (Stable Release) como siguiente paso propuesto, todavía no iniciado ni autorizado. Ver
`ROADMAP.md` para la planificación completa.

Decisión menor todavía pendiente: inconsistencia de idioma de la Fase 0 (investigación en catalán
frente al resto del proyecto en español/inglés) — mantenida deliberadamente sin resolver, ver
`decisions/DECISIONS.md`, sección "PENDIENTE".

## Cómo está organizado el proyecto

```
AgentForge/
├── .claude/
│   └── CLAUDE.md              — manual operativo para Claude Code
├── .github/
│   └── workflows/ci.yml        — CI (GitHub Actions, matriz Linux/Windows)
├── docs/
│   └── research/               — investigación Fase 0 (catalán): Composio, MCP, Claude Code, fuentes
├── research/
│   └── SSH-SECURITY-NOTES.md   — notas de investigación SSH/seguridad (catalán)
├── architecture/
│   ├── ARCHITECTURE.md         — arquitectura completa (español, principal)
│   ├── ARCHITECTURE.en.md      — arquitectura completa (inglés)
│   ├── TECH-STACK-ANALYSIS.md/.en.md      — análisis de stack tecnológico
│   ├── CORE-STRUCTURE-ANALYSIS.md/.en.md  — análisis de estructura núcleo
│   └── ARCHITECTURE-DRAFT.md   — propuesta original de la Fase 0 (catalán, histórico)
├── decisions/
│   └── DECISIONS.md            — más de 80 decisiones aprobadas a lo largo de 15 fases
├── packages/
│   ├── shared/                 — tipos, contratos, Audit Log, utilidades compartidas
│   ├── core/                   — Tool Registry, Tool Discovery, Policy Engine
│   ├── secrets-broker/         — almacenamiento cifrado de secretos, proceso separado
│   ├── execution-ssh/          — Execution Backend: SSH controlado y auditado
│   ├── connector-github/       — Execution Backend: conector GitHub
│   ├── mcp-server/             — servidor MCP propio
│   └── dashboard/              — interfaz web de solo lectura
├── tests/
│   └── integration/            — tests de integración real entre procesos (Fase 14)
├── LICENSE                     — MIT
├── STATE.md                    — estado actual del proyecto (fuente de verdad)
├── README.md / README.en.md    — este documento
├── CHANGELOG.md
├── ROADMAP.md
├── CONTRIBUTING.md
├── DEVELOPMENT.md
└── SECURITY.md
```

## Licencia

**MIT** (DEC-075, Fase 15). Ver `LICENSE` en la raíz del repositorio.
