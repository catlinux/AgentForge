# Contribuir a AgentForge

AgentForge es, por ahora, un proyecto personal con implementación real (8 paquetes TypeScript/
Node.js, 13 fases completadas) pero sin un proceso de contribución externo activo — el
repositorio existe en GitHub pero no acepta colaboradores externos todavía. Este documento
establece las convenciones que regirán las contribuciones si el proyecto se abre en el futuro, y
las que ya aplican hoy al trabajo interno (con o sin asistencia de Claude Code).

## Estado actual

- Hay código de producción real desde la Fase 2 en adelante (ver `STATE.md` y `packages/`).
- El repositorio es `https://github.com/catlinux/AgentForge`; no se ha decidido si aceptará
  contribuciones externas ni se ha confirmado explícitamente su visibilidad pública/privada.
- No se ha decidido licencia (ver `DEVELOPMENT.md`).

Hasta que estos puntos se decidan, este documento describe las convenciones de trabajo internas,
no un proceso de contribución abierto.

## Flujo de trabajo

1. **Inspeccionar** el estado actual (`STATE.md`, `decisions/DECISIONS.md`) antes de proponer un
   cambio.
2. **Comprender** qué es hecho/verificado, qué es propuesta y qué es decisión aprobada.
3. **Planificar** el cambio a nivel de microtarea.
4. **Confirmar** con el usuario si el cambio afecta a una decisión arquitectónica abierta o
   aprobada.
5. Implementar (cuando corresponda), probar, verificar.
6. **Documentar** el cambio en el lugar correspondiente (evitar duplicar información).
7. **Actualizar `STATE.md`**.
8. Revisar el diff antes de proponer un commit.
9. Solicitar autorización explícita para el commit, y por separado para el push.

## Convenciones de documentación

- Una única fuente de verdad por tipo de información — no dupliques contenido entre documentos;
  enlaza en su lugar.
- Usa siempre esta clasificación cuando sea relevante: **HECHO/VERIFICADO**, **PROPUESTA**,
  **DECISIÓN**, **PENDIENTE**, **BLOQUEADO**.
- Nunca presentes una propuesta como si fuera una decisión aprobada.
- Si detectas una contradicción entre documentos, documéntala explícitamente — no la resuelvas
  unilateralmente si implica una decisión de producto o arquitectura.

## Convenciones de commits

- Mensajes de commit preferentemente en español, en modo imperativo/descriptivo
  (`docs: ...`, `feat: ...`, `fix: ...`).
- Un commit debe representar un cambio coherente y revisable.
- Antes de cualquier commit: revisar que no haya secretos, credenciales, claves o código de
  producción no autorizado incluido por error.

## Issues y cambios

Todavía no hay un rastreador de issues público. Los cambios propuestos se discuten y aprueban
dentro de la conversación de trabajo con el usuario y quedan registrados en
`decisions/DECISIONS.md` cuando son decisiones arquitectónicas.

## Pull requests

El repositorio remoto ya existe (`https://github.com/catlinux/AgentForge`), pero no hay
colaboradores externos todavía — todo el trabajo se hace directamente sobre `master`, con
autorización explícita del usuario para cada `commit` y, por separado, cada `push`. Un proceso de
PR formal se documentará aquí si el proyecto llega a aceptar contribuciones externas.

## Principios de seguridad para cualquier contribución

- Nunca incluir secretos, claves privadas ni credenciales reales en el repositorio.
- Tratar el agente/LLM como un componente potencialmente no confiable en cualquier diseño
  propuesto (ver `SECURITY.md`).
- Cualquier cambio que implique tocar sistemas externos reales (Debian de casa, VPS Contabo,
  GitHub, Dropbox) requiere autorización explícita, incluso en fases futuras.

## Tests

- Framework: [Vitest](https://vitest.dev/), un fichero `*.test.ts` junto al código que prueba,
  dentro de cada paquete de `packages/`.
- `pnpm run test` ejecuta todos los tests unitarios/aislados de los 8 paquetes (rápido, sin
  procesos reales del SO).
- `pnpm run test:integration` ejecuta los tests de `tests/integration/` (Fase 14) — más lentos,
  arrancan procesos reales del sistema operativo comunicados por los canales IPC reales del
  proyecto; requieren `pnpm run build` antes (corren contra `dist/`, no `src/`). Ningún test, de
  ningún tipo, toca sistemas remotos reales (Debian de casa, VPS Contabo, GitHub) — los bordes
  externos se simulan localmente (servidor SSH/HTTP en loopback).
- `pnpm run test:coverage` genera un reporte de cobertura de código, informativo, sin umbral que
  bloquee ningún script (ver DEC-073 en `decisions/DECISIONS.md`).
- Antes de dar una fase por cerrada: `pnpm run typecheck`/`lint`/`format`/`test`/`build` deben
  pasar limpios en todos los paquetes.

## Idiomas

- Español es el idioma principal de la documentación de gobernanza del proyecto.
- Inglés es el segundo idioma; los documentos principales deben mantenerse equivalentes en ambos.
- La documentación de investigación de la Fase 0 está en catalán (ver nota en `README.md`) — no se
  traduce retroactivamente en esta fase.
