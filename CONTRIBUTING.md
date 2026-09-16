# Contribuir a AgentForge

AgentForge es, por ahora, un proyecto personal en fase de investigación y fundamentos — todavía no
hay código funcional ni un proceso de contribución externo activo. Este documento establece las
convenciones que regirán las contribuciones cuando el proyecto llegue a ese punto, y las que ya
aplican hoy a nivel de documentación.

## Estado actual

- No hay código de producción todavía (ver `STATE.md`).
- No se ha decidido si el proyecto será público ni si aceptará contribuciones externas.
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

No aplica todavía — no hay repositorio remoto ni colaboradores externos. Se documentará este
proceso cuando el proyecto decida usar GitHub (ver `decisions/DECISIONS.md`, pendiente).

## Principios de seguridad para cualquier contribución

- Nunca incluir secretos, claves privadas ni credenciales reales en el repositorio.
- Tratar el agente/LLM como un componente potencialmente no confiable en cualquier diseño
  propuesto (ver `SECURITY.md`).
- Cualquier cambio que implique tocar sistemas externos reales (Debian de casa, VPS Contabo,
  GitHub, Dropbox) requiere autorización explícita, incluso en fases futuras.

## Tests

Todavía no existen tests porque no existe código funcional. Cuando se implemente software real, se
documentarán aquí las convenciones de testing (framework, cobertura esperada, cómo ejecutarlos).

## Idiomas

- Español es el idioma principal de la documentación de gobernanza del proyecto.
- Inglés es el segundo idioma; los documentos principales deben mantenerse equivalentes en ambos.
- La documentación de investigación de la Fase 0 está en catalán (ver nota en `README.md`) — no se
  traduce retroactivamente en esta fase.
