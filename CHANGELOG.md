# Changelog

Todas las entradas relevantes del proyecto se documentan en este archivo. El proyecto todavía no
tiene versiones publicadas (no hay releases ni tags) — todo el trabajo actual vive bajo
`Unreleased`.

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/), adaptado: como no hay
releases todavía, no se usa versionado semántico hasta la primera release.

## [Unreleased]

### Fase 0.5 — Fundamentos del proyecto y gobernanza (2026-09-16, en curso)

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
- No se ha implementado software funcional.
- No se ha decidido licencia.
- No se ha inicializado el repositorio Git.
- No se ha decidido si el proyecto usará GitHub.
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
