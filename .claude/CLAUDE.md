# CLAUDE.md — AgentForge (manual operativo)

Este archivo es el manual operativo permanente para Claude Code trabajando en AgentForge. Es
deliberadamente conciso — el contexto completo del proyecto vive en `STATE.md` y en
`docs/`/`architecture/`/`decisions/`, no aquí.

## Reglas de trabajo

1. Lee `STATE.md` antes de empezar cualquier tarea.
2. Revisa `decisions/DECISIONS.md` — solo lo que está ahí es una decisión aprobada. Todo lo
   demás (incluida la arquitectura en `architecture/ARCHITECTURE-DRAFT.md`) es propuesta.
3. No inventes hechos. Si algo no está verificado, dilo explícitamente.
4. Clasifica siempre: HECHO/VERIFICADO, PROPUESTA, DECISIÓN, PENDIENTE, BLOQUEADO.
5. No cambies decisiones arquitectónicas ni conviertas una propuesta en decisión sin autorización
   explícita del usuario.
6. Trabaja por fases y microtareas; no implementes fases futuras sin autorización.
7. Verifica los cambios antes de darlos por terminados.
8. Documenta los cambios relevantes en el lugar correspondiente (no dupliques información).
9. Actualiza `STATE.md` al final de cada bloque de trabajo significativo.
10. Revisa el diff (`git status`/`git diff`) antes de proponer un commit.
11. Pide autorización explícita antes de hacer `git commit`.
12. Pide autorización explícita **por separado** antes de hacer `git push`.
13. No modifiques sistemas externos (Debian de casa, VPS Contabo, GitHub, Dropbox, etc.) sin
    autorización explícita.
14. No modifiques la configuración Git global (`git config --global`) sin autorización explícita.
15. Nunca guardes secretos, claves o credenciales reales en el repositorio.
16. Mantén la documentación principal bilingüe (español + inglés) cuando corresponda — ver
    sección de idiomas en `README.md`.
17. Español es el idioma principal del proyecto; inglés es el segundo idioma.
18. Mantén la arquitectura preparada para i18n futura, sin implementarla todavía.
19. Antes de una fase o microtarea significativa, evalúa si el modelo/nivel de esfuerzo actual es
    adecuado; si crees que debería cambiar (arriba o abajo), pide autorización antes de cambiarlo.
20. Después de un `/clear`, usa los archivos del proyecto (`STATE.md` primero) como única fuente
    de continuidad — no asumas nada del contexto de conversación previo.

## Dónde está cada cosa

- Estado actual del proyecto: `STATE.md`.
- Decisiones aprobadas: `decisions/DECISIONS.md`.
- Investigación completa (Fase 0, en catalán): `docs/research/`, `research/`.
- Arquitectura propuesta (no aprobada): `architecture/ARCHITECTURE-DRAFT.md`.
- Gobernanza y fundamentos del proyecto (Fase 0.5, en español/inglés): `README.md`,
  `README.en.md`, `CONTRIBUTING.md`, `DEVELOPMENT.md`, `SECURITY.md`, `ROADMAP.md`,
  `CHANGELOG.md`.
