# Seguridad — AgentForge

Este documento recoge los **principios de seguridad conocidos** en esta etapa del proyecto, tal
como se derivan de la investigación de la Fase 0 (`docs/research/`, `research/SSH-SECURITY-NOTES.md`).
Es un documento **conceptual**: ninguno de estos mecanismos está implementado todavía. Cuando se
implemente software real, este documento deberá actualizarse para reflejar la implementación
efectiva, no solo la intención.

## Reportar una vulnerabilidad

El proyecto no tiene todavía un canal público de reporte de vulnerabilidades (no hay repositorio
remoto ni release pública). Esto se documentará cuando el proyecto decida su estrategia de GitHub
(ver `decisions/DECISIONS.md`, pendiente).

## Principio central: el agente/LLM como componente no confiable

AgentForge parte de una premisa central, respaldada por la investigación de seguridad de agentes
de IA consultada en la Fase 0 (OWASP GenAI LLM Top 10, literatura de "least privilege for AI
agents"): **el agente/LLM no es un programa determinista fijo, sino un componente manipulable a
través de sus propias entradas** (prompt injection, directo o indirecto vía salida de
herramientas). Por tanto:

- El agente **nunca** debe tener acceso directo a credenciales (claves SSH, tokens de API).
- El agente **nunca** debe construir libremente un string de comando de shell que luego se
  ejecute tal cual.
- Toda aplicación de política de seguridad debe vivir en código que el agente no pueda alterar —
  nunca únicamente como instrucción de prompt/CLAUDE.md. Los propios documentos oficiales de
  Claude Code marcan esta misma distinción (CLAUDE.md guía comportamiento, no es una capa de
  aplicación forzosa).

## Límites de confianza (conceptual, ver `architecture/ARCHITECTURE-DRAFT.md` §1)

La arquitectura propuesta (no aprobada) sitúa un gateway/broker entre el agente y la
infraestructura real, con una frontera de confianza explícita: las credenciales y las decisiones
de política viven en el lado del gateway, nunca en el lado del agente. Esto significa que, incluso
si el proceso del agente quedara completamente comprometido, no tendría las claves necesarias para
escalar privilegios ni saltarse la política — porque nunca las tuvo.

## Ejecución remota (SSH)

Principios identificados en la investigación (ver `research/SSH-SECURITY-NOTES.md` para el
detalle y las fuentes):

- Preferir claves ed25519 dedicadas por host; nunca usar agent forwarding SSH.
- Fijar `known_hosts` manualmente/fuera de banda antes de cualquier conexión automatizada;
  `StrictHostKeyChecking yes` en estado estacionario (nunca `StrictHostKeyChecking no`).
- Restringir claves de automatización con `command=`/`restrict` en `authorized_keys` en lugar de
  dar una shell interactiva completa.
- Preferir herramientas específicas con allowlist (`apache_status()`, `docker_restart(servicio)`)
  frente a una herramienta genérica `execute_command(string)` — esta última es casi un ejemplo de
  libro del riesgo "Excessive Agency" (OWASP LLM06).
- Clasificar acciones por reversibilidad/riesgo: solo lectura → automática; escritura
  reversible/bajo impacto → allowlist explícita; destructivo/alto impacto → confirmación humana
  síncrona siempre, sin excepciones.

## MCP

Principios identificados en la investigación (ver `docs/research/MCP-ANALYSIS.md` §7 para el
detalle):

- Tratar las anotaciones/descripciones de herramientas de servidores MCP no verificados como
  datos no confiables, no como instrucciones.
- Nunca reenviar (passthrough) tokens no emitidos específicamente para el propio servidor MCP.
- Validar cuidadosamente cualquier URL de autorización/descubrimiento OAuth para evitar SSRF.
- Requerir consentimiento explícito del usuario antes de cualquier invocación de herramienta con
  efectos reales.

## Herramientas y abuso de herramientas

- Principio de mínimo privilegio: cada herramienta expone solo la capacidad concreta que necesita.
- La salida de una herramienta (incluida la salida de comandos remotos) se trata como dato no
  confiable — nunca se realimenta directamente a un contexto con autoridad de invocación de
  herramientas en vivo sin volver a pasar por la puerta de confirmación/allowlist correspondiente
  (mitigación de prompt injection indirecta).

## Secretos y credenciales

- Nunca se almacenan secretos reales en el repositorio (ver `.gitignore`).
- Las credenciales remotas (claves SSH, tokens) deben vivir en el lado del gateway/broker, nunca
  expuestas directamente al proceso del agente.
- **Pregunta de diseño abierta, sin resolver por ninguna fuente consultada en la Fase 0:** si un
  almacén de credenciales del sistema operativo (p. ej. Windows Credential Manager) es
  suficientemente robusto específicamente contra un actor de amenaza que es el propio proceso del
  agente LLM corriendo en la misma máquina (a diferencia de un atacante remoto o un dispositivo
  robado). Esto queda como **PENDIENTE** de decisión de diseño explícita antes de implementar el
  Secrets Broker.

## Autorización y acciones destructivas

- Ninguna acción destructiva o de alto impacto debe ejecutarse sin confirmación humana síncrona
  explícita, independientemente de si está en una allowlist.
- La confirmación humana debe ser una barrera de ejecución real (detener el flujo), no solo un
  registro posterior.

## Auditoría

- Toda acción relevante que pase por AgentForge debería quedar registrada: herramienta/operación,
  parámetros, host destino, marca de tiempo, duración, código de resultado, si requirió
  confirmación y cómo se resolvió.
- El registro de auditoría debería ser de solo-anexado (append-only) y, idealmente, estar fuera
  del alcance de escritura del propio proceso del agente.

## Separación de responsabilidades

- No duplicar el motor de permisos local de Claude Code (ya cubre bien las acciones locales) — la
  capa de política propia de AgentForge se centra en lo que Claude Code no cubre: ejecución
  remota, secretos multi-herramienta, auditoría centralizada.
- Ver `docs/research/CLAUDE-CODE-ANALYSIS.md` §10 para el análisis completo de qué ya resuelve
  Claude Code y qué es responsabilidad de AgentForge.

## Estado de implementación

**Ninguno de los mecanismos anteriores está implementado.** Este documento describe principios de
diseño derivados de la investigación, no garantías actuales. No debe interpretarse como que
AgentForge ya ofrece alguna de estas protecciones.
