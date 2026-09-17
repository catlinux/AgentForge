# Seguridad — AgentForge

Este documento recoge los **principios de seguridad** identificados durante la investigación de la
Fase 0 (`docs/research/`, `research/SSH-SECURITY-NOTES.md`), junto con **su estado real de
implementación**, actualizado por última vez en la Fase 13 (Hardening de seguridad, 2026-09-17).
Cada sección indica explícitamente qué está implementado y verificado, y qué sigue siendo
únicamente un principio de diseño sin código real detrás — ver la sección final "Estado de
implementación" para el resumen completo y las limitaciones conocidas.

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

## Límites de confianza

**Implementado (Fases 2, 5, 6):** la arquitectura aprobada (`architecture/ARCHITECTURE.md` §3, §8)
sitúa el Secrets Broker como proceso separado del Core (DEC-004), con el Policy Engine (DEC-023 a
DEC-029) decidiendo la autorización antes de cualquier ejecución. Las credenciales viven
exclusivamente en el proceso del Secrets Broker (DEC-030 a DEC-036); el agente nunca las recibe
directamente.

**Limitación conocida y documentada explícitamente (DEC-036, sin cambios en la Fase 13):** el
Policy Engine corre en el mismo proceso que Core (DEC-029), no en el Secrets Broker. Esto significa
que un Core comprometido puede invocar `evaluate()` directamente y obtener una autorización legítima
para cualquier `identity`, sin necesidad de falsificar ninguna evidencia — el Broker no exige ni
valida ninguna prueba criptográfica de autorización independiente. El aislamiento de proceso
protege el **almacenamiento** de los secretos (nadie fuera del proceso Broker puede leer el fichero
cifrado ni la clave maestra directamente), pero no convierte a Policy Engine en una autoridad
verdaderamente independiente frente a un Core comprometido. Ver DEC-036 en
`decisions/DECISIONS.md` para el análisis completo.

## Ejecución remota (SSH)

Principios identificados en la investigación (ver `research/SSH-SECURITY-NOTES.md` para el
detalle y las fuentes), con su estado real de implementación (`packages/execution-ssh`, Fase 7):

- Claves ed25519 dedicadas por host (DEC-006) — **implementado**: `HostEntry.sshKeySecretId`
  referencia un secreto propio por host, nunca compartido; agent forwarding SSH no se usa en
  ningún punto del código.
- Comandos parametrizados con plantilla fija por tool (DEC-037) — **implementado**: nunca shell
  arbitraria ni argumentos libres del agente. Corregido en Fase 7 un fallo real donde
  `argv.join(" ")` reconstruía una cadena de shell interpretable en el host remoto pese a que la
  plantilla ya resolvía los argumentos de forma segura — ver `ssh/shell-quote.ts` y el punto
  correspondiente de `STATE.md` (Fase 7, revisión de seguridad final) para el detalle completo.
- Confirmación humana síncrona antes de cualquier acción de riesgo (DEC-038) — **implementado**:
  hash determinista, un solo uso, timeout, rechazo por defecto. Limitación documentada
  explícitamente: requiere un operador humano presente en el momento de la ejecución (sin cola de
  aprobaciones diferidas en esta fase).
- Clasificación de riesgo por reversibilidad (DEC-023/023b) — **implementado** en Policy Engine,
  no en Execution: solo lectura → `allow`; escritura reversible → `allow` salvo override;
  destructivo → `requires-confirmation` por defecto.
- `known_hosts`/`StrictHostKeyChecking` y restricción de claves con `command=`/`restrict` en
  `authorized_keys` — **sin verificar en esta fase**: son configuraciones del lado del host remoto
  (Debian casa, VPS Contabo), fuera del código de AgentForge y de los sistemas remotos reales, que
  siguen sin tocarse. Quedan como principio de despliegue, no como código verificable aquí.

## MCP

Principios identificados en la investigación (ver `docs/research/MCP-ANALYSIS.md` §7 para el
detalle), con su estado real de implementación (`packages/mcp-server`, Fase 8):

- Consentimiento explícito antes de invocaciones con efecto real — **implementado** vía Policy
  Engine + confirmación síncrona de Execution (DEC-045, amplía DEC-038 al ciclo de vida de
  `tools/call`).
- Ningún contenido no-MCP se escribe en stdout del servidor (DEC-046) — **implementado y
  verificado** con un test estático que comprueba que ningún fichero de `mcp-server` usa
  `console.*`/`process.stdout`/`process.stdin` directamente.
- OAuth/passthrough de tokens — **sin OAuth implementado todavía** (DEC-061, Fase 11): la única
  autenticación existente es Personal Access Token gestionado manualmente por el usuario vía
  Secrets Broker; no aplica todavía el riesgo de passthrough de tokens OAuth.
- Tratar anotaciones/descripciones de servidores MCP no verificados como datos no confiables —
  **sin servidores MCP de terceros conectados todavía** (Discovery expone solo `ToolEntry` propios
  y de conectores propios, Fase 3/4); principio a revisar cuando exista integración con servidores
  MCP externos.

## Herramientas y abuso de herramientas

**Implementado (Fase 7, DEC-037; Fase 11, DEC-062):**

- Principio de mínimo privilegio: cada herramienta expone solo una operación concreta con
  plantilla fija de comando/endpoint — nunca shell arbitraria ni HTTP libre del agente.
- La salida de comandos remotos (stdout/stderr) se trunca por tamaño y nunca se registra en claro
  en Audit Log (DEC-040, DEC-055) — mitigación estructural, no solo de proceso, frente a prompt
  injection indirecta vía salida de herramientas.

## Secretos y credenciales

- Nunca se almacenan secretos reales en el repositorio (ver `.gitignore`) — **verificado
  repetidamente en cada fase** mediante grep explícito sobre el código nuevo/modificado antes de
  cerrar cada fase (ver `STATE.md`, sección VERIFY de cada fase).
- Almacenamiento: fichero cifrado propio (AES-256-GCM), no OS credential store (DEC-030) —
  **implementado**: se descartó explícitamente depender de un almacén de credenciales del sistema
  operativo (Windows Credential Manager, Linux Secret Service) por no ser viable en el despliegue
  headless previsto ni ofrecer garantías claras frente al propio proceso del agente — la pregunta
  de diseño original de la Fase 0 quedó resuelta por DEC-030, no simplemente pospuesta.
- Las credenciales remotas viven exclusivamente en el proceso del Secrets Broker — **implementado**
  (DEC-004, DEC-030 a DEC-035) y verificado en Fase 13: el canal Execution↔Secrets Broker
  (`packages/shared/src/secrets/execution-secrets-client.ts`,
  `packages/secrets-broker/src/ipc/execution-secrets-server.ts`) expone únicamente una operación
  `get` de solo lectura — un Execution Backend no puede crear, modificar, eliminar ni enumerar
  secretos ni siquiera si su propio proceso quedara comprometido.
- **Limitación heredada, documentada explícitamente:** el canal Core↔Secrets Broker (DEC-010) para
  el propio Core sigue sin transporte real implementado — sigue siendo solo una interfaz agnóstica
  sin ninguna implementación de producción, porque ningún paquete tiene todavía un `main`/CLI real
  que conecte Core con nada (hallazgo de Fase 12). Esto es distinto del canal Execution↔Secrets
  Broker, que sí tiene una implementación real desde la Fase 13.

## Autorización y acciones destructivas

**Implementado (Fase 5, DEC-023 a DEC-029; Fase 7, DEC-038; Fase 8, DEC-045):**

- Ninguna acción `destructive` se ejecuta sin confirmación humana síncrona explícita — verdadera
  barrera de ejecución (hash determinista, un solo uso, timeout, rechazo por defecto), no solo un
  registro posterior.
- La confirmación se puede cancelar antes de resolverse; cancelarla después de una aprobación ya
  concedida no aborta una ejecución SSH ya en curso (DEC-045) — límite documentado explícitamente,
  no un descuido: una vez aprobada y en marcha, la ejecución remota ya está comprometida por
  diseño de SSH (no hay forma de "deshacer" un `exec` en curso salvo el propio timeout).

## Auditoría

**Implementado (Fase 10, DEC-052 a DEC-057; corregido tras revisión de código real, ver `STATE.md`
Fase 10 segunda ronda):**

- Cada proceso (servidor MCP, Execution) escribe sus propios eventos de auditoría de forma
  autónoma: `tool-invoked`, `policy-decided`, `confirmation-requested`/`confirmation-resolved`,
  `execution-completed`, `operation-cancelled`.
- Persistencia JSON Lines append-only, un fichero por proceso escritor, permisos `0o600` (no
  verificable en Windows — ver limitación en "Estado de implementación").
- Minimización estricta de datos (DEC-055): nunca secretos, claves, passphrases, stdout/stderr
  completo, ni valores de parámetros — solo metadatos, nombres de clave, longitudes en bytes.
- Best-effort y no bloqueante (DEC-057): un fallo de escritura de auditoría nunca aborta, revierte
  ni condiciona la operación real que describe — es evidencia, no mecanismo de control.
- **Limitación heredada:** sin un `main`/CLI de producción real (hallazgo de Fase 12), estos
  ficheros de auditoría nunca se han generado en una ejecución real fuera de test/fixtures.

## Separación de responsabilidades

- No duplicar el motor de permisos local de Claude Code (ya cubre bien las acciones locales) — la
  capa de política propia de AgentForge se centra en lo que Claude Code no cubre: ejecución
  remota, secretos multi-herramienta, auditoría centralizada.
- Ver `docs/research/CLAUDE-CODE-ANALYSIS.md` §10 para el análisis completo de qué ya resuelve
  Claude Code y qué es responsabilidad de AgentForge.

## Estado de implementación

**Actualizado en la Fase 13 (Hardening de seguridad, 2026-09-17).** A diferencia de lo que
afirmaba una versión anterior de este documento, la mayoría de los mecanismos descritos arriba
**sí están implementados y verificados con tests automatizados** desde las Fases 3 a 13. Este
documento ya no es puramente conceptual — cada sección indica explícitamente qué está implementado
y dónde.

**Limitaciones de seguridad conocidas, documentadas y aceptadas explícitamente (no defectos
ocultos):**

1. **DEC-036** — Policy Engine comparte proceso con Core; el Secrets Broker no exige evidencia
   criptográfica de autorización independiente. Ver sección "Límites de confianza".
2. **Canal Core↔Secrets Broker (DEC-010) sin transporte real** — sigue siendo solo una interfaz
   agnóstica; nunca se ha conectado Core con el Broker en una ejecución real, porque ningún
   paquete tiene todavía un `main`/CLI de producción (hallazgo de Fase 12). El canal distinto
   Execution↔Secrets Broker sí tiene una implementación real desde la Fase 13 (DEC-F).
3. **Rama Linux/macOS del transporte IPC (DEC-010) no implementada** — solo la interfaz agnóstica
   y la variante Windows (named pipe) están cubiertas por código; la variante Unix domain socket
   queda pendiente para cuando haya despliegue real en esos sistemas operativos.
4. **Verificación de permisos POSIX del fichero de clave maestra omitida en Windows** — 2 tests de
   `packages/secrets-broker` (`master-key.test.ts`) se saltan explícitamente en Windows porque
   `chmod`/`stat().mode` no tienen la misma semántica en NTFS; sin verificación automatizada real
   en la plataforma de desarrollo actual, solo verificable en un sistema POSIX real.
5. **Límite "operador presente"** (DEC-038) — la confirmación humana requiere un operador
   disponible en el momento exacto de la ejecución; no existe cola de aprobaciones diferidas.
6. **Instancia única, sin discovery multi-instancia** (DEC-047) — servidor MCP, Execution SSH,
   Connector GitHub y ahora también el Secrets Broker asumen una única instancia de cada uno por
   despliegue, en rutas de canal fijas.
7. **Ningún sistema remoto real ha sido tocado ni configurado** (Debian de casa, VPS Contabo) —
   todo lo anterior está verificado únicamente con mocks/fixtures/tests en memoria, nunca contra
   infraestructura real, porque tocar esos sistemas requiere autorización explícita separada que
   no se ha solicitado ni concedido todavía.

Ninguna de estas limitaciones es una vulnerabilidad no documentada — cada una está registrada en
`decisions/DECISIONS.md` bajo la decisión correspondiente, con su razonamiento completo.
