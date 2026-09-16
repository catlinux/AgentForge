# AgentForge

**Estado del proyecto: investigación completada, fundamentos en curso. Ninguna línea de software
funcional ha sido implementada todavía.**

[English version](README.en.md)

---

## Qué es AgentForge

AgentForge es un proyecto propio destinado a construir una infraestructura modular que permita a
agentes de IA — inicialmente Claude Code — utilizar herramientas, MCP, conectores, sistemas
remotos, APIs, autenticación, permisos, descubrimiento de herramientas, sesiones y
automatizaciones de forma controlada, extensible y sin dependencia obligatoria de un proveedor
externo.

El proyecto toma como referencia, entre otras cosas, ideas y arquitectura presentes en Composio,
pero **no asume que haya que copiar Composio** ni que su arquitectura sea necesariamente la mejor
opción para este caso de uso.

## Qué problema pretende resolver

Claude Code ya resuelve muy bien una parte importante de "dar herramientas a un agente": cliente
MCP, permisos locales, hooks, subagentes, sandboxing de Bash y gestión de sus propias credenciales.
La investigación de la Fase 0 (ver `docs/research/`) identificó un conjunto de huecos concretos
que Claude Code **no** cubre hoy:

- Ejecución remota (SSH) controlada, auditada y con permisos de grano fino.
- Un registro de herramientas/capacidades consultable entre proyectos y máquinas.
- Un broker de secretos unificado entre múltiples herramientas/servidores MCP.
- Un log de auditoría centralizado entre sesiones y máquinas.
- Orquestación de múltiples sesiones/máquinas más allá de un único proceso de Claude Code.

AgentForge pretende llenar específicamente estos huecos — no reimplementar lo que Claude Code ya
hace bien.

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

## Qué NO pretende hacer (por ahora)

- No pretende ser "un Composio gratis" ni clonar su producto.
- No pretende duplicar funcionalidad que Claude Code ya resuelve bien (cliente MCP, permisos
  locales, hooks, subagentes, sandboxing de Bash, gestión de sus propias credenciales).
- No pretende, en esta fase, tener ninguna implementación funcional: ni backend, ni gateway, ni
  servidor MCP propio, ni ejecutor SSH, ni broker de secretos, ni dashboard.

## Estado actual del proyecto

| Área | Estado |
|---|---|
| Investigación técnica (Composio, MCP, Claude Code, VS Code, SSH, seguridad) | **Completada** (Fase 0) |
| Fundamentos, documentación y gobernanza del proyecto | **En curso** (Fase 0.5) |
| Decisiones de arquitectura | **Pendientes** — el documento de arquitectura es un borrador, no una decisión aprobada |
| Implementación de software | **No iniciada** |
| Repositorio Git | No inicializado todavía |
| Repositorio remoto (GitHub u otro) | No decidido — pendiente de confirmación del usuario |

Ver `STATE.md` para el estado detallado y actualizado del proyecto en todo momento.

## Arquitectura conceptual actual (propuesta, no aprobada)

```
Claude Code (agente, razonamiento — tratado como no confiable)
        │  (hooks / servidor(es) MCP propios)
        ▼
AgentForge — capa de gateway/broker (PROPUESTA)
   ├── Tool Registry
   ├── Permission / Policy Layer
   ├── Secrets Broker
   ├── Audit Log
   └── Execution Backends (SSH, conectores API, MCP propios)
        ▼
Sistemas locales / remotos (Debian de casa, VPS Contabo, GitHub, Dropbox, APIs externas)
```

Este diagrama representa la dirección de investigación actual, **no una arquitectura aprobada en
su totalidad** (aunque ya incluye 4 decisiones aprobadas — DEC-003 a DEC-006, ver
`decisions/DECISIONS.md`). El detalle completo de la Fase 1, con cada pieza justificada y
clasificada como decisión/propuesta/pregunta abierta, está en `architecture/ARCHITECTURE.md`
(y su equivalente `architecture/ARCHITECTURE.en.md`). El documento original de la Fase 0,
`architecture/ARCHITECTURE-DRAFT.md`, se conserva como referencia histórica.

## Principios principales

1. El agente/LLM es un componente de razonamiento potencialmente manipulable (prompt injection) —
   nunca debe tener acceso directo a credenciales ni construir libremente comandos de ejecución.
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

La Fase 1 (arquitectura y decisiones tecnológicas) está **completada**: 5 decisiones aprobadas
(DEC-003 a DEC-007 — relación con Claude Code, modelo de amenaza del Secrets Broker, alcance MCP,
arquitectura SSH, y stack tecnológico TypeScript/Node.js). Ver `decisions/DECISIONS.md` y
`architecture/ARCHITECTURE.md`.

1. Fase 2 — Arquitectura núcleo (siguiente fase propuesta, no iniciada, requiere autorización
   explícita).
2. Decisiones menores todavía pendientes: licencia del proyecto, visibilidad del repositorio,
   detalles de implementación de la Fase 2 (ver `decisions/DECISIONS.md`, sección "PENDIENTE").

Ver `ROADMAP.md` para la planificación completa propuesta.

## Cómo está organizado el proyecto

```
AgentForge/
├── .claude/
│   └── CLAUDE.md              — manual operativo para Claude Code
├── docs/
│   └── research/               — investigación Fase 0 (catalán): Composio, MCP, Claude Code, fuentes
├── research/
│   └── SSH-SECURITY-NOTES.md   — notas de investigación SSH/seguridad (catalán)
├── architecture/
│   └── ARCHITECTURE-DRAFT.md   — propuesta de arquitectura (catalán, NO aprobada)
├── decisions/
│   └── DECISIONS.md            — decisiones realmente aprobadas (vacío por ahora)
├── STATE.md                    — estado actual del proyecto (fuente de verdad)
├── README.md / README.en.md    — este documento
├── CHANGELOG.md
├── ROADMAP.md
├── CONTRIBUTING.md
├── DEVELOPMENT.md
└── SECURITY.md
```

## Licencia

**Pendiente de decisión.** El proyecto todavía no tiene una licencia asignada. No se debe asumir
ninguna licencia hasta que el usuario la decida explícitamente. Ver `DEVELOPMENT.md` y
`decisions/DECISIONS.md` para el seguimiento de esta decisión pendiente.
