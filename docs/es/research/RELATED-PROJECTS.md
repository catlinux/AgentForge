# Proyectos relacionados — exploración ligera (Fase 0.7)

**Estado:** investigación ligera completada. **Fecha:** 2026-09-16. **Nivel de profundidad:**
deliberadamente superficial (no due-diligence completo como la Fase 0 con Composio) — el objetivo
es identificar ideas y patrones útiles, no auditar exhaustivamente cada proyecto.

> **Aclaración importante sobre el propósito de este documento:** AgentForge **no** se está
> diseñando como una alternativa, sustituto, mejora o "fork conceptual" de ninguno de los
> proyectos aquí analizados — incluido Composio (analizado en profundidad en la Fase 0, ver
> `docs/research/COMPOSIO-ANALYSIS.md`). Composio es solo una de las muchas referencias
> estudiadas. AgentForge es un proyecto independiente que estudia distintas soluciones existentes
> del ecosistema de herramientas para agentes de IA y adapta a su propia arquitectura y
> requisitos los conceptos que le resultan útiles — nunca su código, salvo que una licencia
> concreta lo permita explícitamente y así se decida en una fase futura.

Todas las afirmaciones se clasifican como **FUNCIONALIDAD VERIFICADA** (confirmada en fuente
primaria, con cita), **INTERPRETACIÓN** (inferencia razonable no confirmada textualmente), o
**PENDIENTE DE INVESTIGACIÓN PROFUNDA** (no se pudo confirmar con el nivel de esfuerzo de esta
fase). No se presenta ningún ranking ni puntuación — el objetivo es extraer ideas, no comparar
ganadores.

---

## Nango

### Propósito
FUNCIONALIDAD VERIFICADA (github.com/NangoHQ/nango, nango.dev/docs): plataforma para construir
integraciones de producto con 1.000+ APIs — autenticación (OAuth/API keys), ejecución de llamadas,
escalado y observabilidad, tanto para SaaS tradicional como para agentes de IA.

### Funcionalidades principales
Tres primitivas: **Auth** (OAuth/API keys gestionados, multi-tenant), **Proxy** (llamadas API
autenticadas con manejo de rate limits/reintentos), **Functions** (funciones TypeScript
desplegables para lógica de integración, con generación asistida por IA). Además: syncs, webhooks,
tool calling para agentes.

### Tools / Connectors
Cada "tool" es una función de acción invocable por un agente/LLM/cliente MCP para una conexión
concreta; Nango gestiona credenciales, reintentos, rate limits y logging del lado del proxy.
Configuraciones de tools disponibles en formato compatible con OpenAI o formato nativo.

### Autenticación y credenciales
OAuth (múltiples variantes) y API keys gestionados, con refresco automático de tokens,
multi-tenant ("connections" por integración), "white-label auth flow" embebible.

### Secrets
INTERPRETACIÓN: credenciales de conexión centralizadas en la capa Auth. Mecanismo exacto de
cifrado en reposo — PENDIENTE DE INVESTIGACIÓN PROFUNDA.

### Permisos / autorización
PENDIENTE DE INVESTIGACIÓN PROFUNDA para un RBAC interno propio; el control principal está en los
scopes OAuth pedidos por conexión, no en un motor de políticas propio. SSO/MFA solo en Cloud, no
en self-hosted.

### MCP
Dos servidores MCP distintos: **Management MCP** (config/debug del entorno) y **Tool-Calling MCP
Server** (runtime, ejecución de tools). Importante: es funcionalidad de pago, no incluida en el
self-hosting gratuito.

### Ejecución
Functions TypeScript ejecutadas en el runtime gestionado por Nango (cloud, o infraestructura
propia en Enterprise Self-Hosted).

### Sesiones / estado
La "Connection" (credenciales + metadatos persistentes) es el concepto central de estado; los
syncs mantienen estado incremental. Modelo de sesión de agente vs. conexión — PENDIENTE DE
INVESTIGACIÓN PROFUNDA.

### Auditoría / observabilidad
Sistema de "operations" con "log messages" anidados; exportación OpenTelemetry (solo en tier de
pago Growth). Self-hosted gratuito: observabilidad limitada a Auth+Proxy.

### Self-hosting
Tres modalidades: **Free Self-Hosted** (solo Auth+Proxy, sin syncs/webhooks/tool calls/MCP/SSO),
**Enterprise Self-Hosted** (todas las funciones de pago, infraestructura propia, licencia anual +
mantenimiento), **Nango Cloud** (SaaS gestionado, único con SAML SSO). El repo se describe como
"fully open source" pero la funcionalidad real está fuertemente segmentada por plan.

### Licencia
**Elastic License 2.0 (ELv2)** — source-available, **no aprobada por OSI**. Prohíbe ofrecer el
software como servicio hospedado competidor y eludir mecanismos de "license key" de funciones de
pago. Caveat importante: funciones clave para agentes (tool calling, MCP server, syncs, webhooks)
están bloqueadas tras el modelo de pago incluso en self-hosting.

### Ideas potencialmente útiles para AgentForge
- Patrón "operations + log messages anidados" para observabilidad estructurada.
- Separación conceptual Auth / Proxy / Functions como capas independientes.
- Dos servidores MCP con propósitos distintos (gestión/desarrollo vs. runtime) — separa plano de
  control del plano de ejecución.
- Principio "el agente nunca ve las credenciales, solo se inyectan en la llamada".
- OpenTelemetry como formato estándar de observabilidad.

### Elementos que probablemente no necesitamos
- El modelo de negocio de feature-gating agresivo vía licencia (decisión comercial, no patrón
  técnico).
- El catálogo de 1.000+ conectores prediseñados como objetivo en sí.
- El "white-label auth flow" para productos SaaS de terceros (caso de uso distinto al de
  AgentForge).

---

## Arcade (Arcade AI)

### Propósito
FUNCIONALIDAD VERIFICADA (docs.arcade.dev): "the enterprise-ready actions runtime for AI agents".
Tres pilares: **Autorización** (OAuth 2.0/API keys/tokens de usuario), **Ejecución** (tools
fiables a escala), **Gobernanza** (control centralizado, visibilidad, cumplimiento).

### Funcionalidades principales
Framework Python `arcade-mcp` para construir servidores MCP y tools; 7.500+ tools prediseñadas en
81 servidores MCP; CLI (`arcade new`, `arcade deploy`); integración con Claude Desktop/Cursor/VS
Code; registro central de tools con versionado.

### Tools / Connectors
API basada en decoradores cubriendo la especificación MCP completa; scopes declarados con clases
helper (`GitHub(scopes=["repo"])`). Arquitectura en dos zonas: **Local Zone** (desarrollo
single-user) y **Platform Zone** (Arcade Engine — control plane con gestión de proyectos/usuarios,
registro de tools, auth/secretos, runtime distribuido).

### Autenticación y credenciales
Patrón "check-then-request": comprueba si el usuario ya autorizó los scopes necesarios; si no,
inicia OAuth con URL de consentimiento explícito. Token recordado hasta expiración/revocación,
inyectado en el Context de la tool en la siguiente invocación — **el cliente/LLM nunca ve el
token**.

### Secrets
Almacenamiento centralizado (`.env` solo en desarrollo; Dashboard/CLI recomendado en producción),
"entorno cifrado" con inyección en tiempo de ejecución. Detalle criptográfico exacto — PENDIENTE
DE INVESTIGACIÓN PROFUNDA.

### Permisos / autorización
Autorización fine-grained por acción, integrable con IdP/DLP/SIEM del cliente; hooks y rate
limiting para enforcement en runtime; "visibility filtering" en el registro compartido de tools.

### MCP
Central al producto — "the MCP runtime for production AI agents". El framework `arcade-mcp` es
la base para construir servidores MCP; el Engine expone las 7.500+ tools como servidores MCP y
permite registrar servidores MCP externos bajo el mismo marco de gobernanza.

### Ejecución
Runtime distribuido dentro del Arcade Engine (producción); en desarrollo, servidor MCP local
(stdio/HTTP).

### Sesiones / estado
INTERPRETACIÓN: tokens/autorizaciones de usuario por proveedor + registro de tools versionado.
Modelo exacto de sesión de agente/conversación — PENDIENTE DE INVESTIGACIÓN PROFUNDA.

### Auditoría / observabilidad
"OpenTelemetry audit logs" rastreando ejecución de tools y patrones de acceso, como parte central
del pilar de Gobernanza.

### Self-hosting
Arcade Cloud (gestionado), self-hosted del Engine completo (Helm/Kubernetes, marketplace
Azure/AWS/GCP), o "Hybrid MCP servers" (servidores MCP propios conectados a Arcade Cloud para
auth/gobernanza).

### Licencia
Repo principal `arcade-ai`/`arcade-mcp`: **MIT**. Algunos repos (docs, paquetes TS): Apache 2.0.
**Caveat importante**: no hay evidencia clara de que el **Arcade Engine** (control plane de
producción) comparta la licencia MIT del framework de desarrollo — la documentación de hosting no
menciona su licencia explícitamente. PENDIENTE DE INVESTIGACIÓN PROFUNDA.

### Ideas potencialmente útiles para AgentForge
- Separación explícita "Local Zone" (desarrollo) vs. "Platform Zone" (producción/gobernanza) como
  modelo mental de arquitectura.
- Patrón de autorización "check-then-request" con inyección de token en el Context, nunca visible
  al LLM.
- Registro centralizado de tools con versionado y "visibility filtering".
- Auditoría vía OpenTelemetry desde el diseño inicial.
- Registrar servidores MCP externos ("vendor-managed") bajo el mismo marco de gobernanza que las
  tools propias.

### Elementos que probablemente no necesitamos
- El catálogo de 7.500+ tools prediseñadas.
- Integraciones específicas con frameworks de terceros (LangChain, CrewAI, etc.).
- El modelo comercial de marketplace para self-hosting.

---

## Windmill

### Propósito
FUNCIONALIDAD VERIFICADA (README oficial): plataforma de infraestructura open-source que convierte
scripts en webhooks/workflows/UIs — alternativa self-hosted a Retool (UIs) y Temporal
(orquestación).

### Funcionalidades principales
Scripts (Python/TypeScript/Go/Bash/SQL/GraphQL/PowerShell/Rust) convertidos automáticamente en UIs
ejecutables; composición en "flows" o apps low-code; triggers (schedules, webhooks, Kafka,
WebSockets, email); Hub comunitario de scripts.

### Tools / Connectors
Gestión mediante **"Resources"**: objetos JSON adheridos a un **"Resource Type"** (schema JSON,
200+ tipos preconstruidos, personalizables). Soporta placeholders dinámicos resueltos en tiempo de
ejecución (`$var:` para secrets, `$res:` para embeber otro recurso, `$WM_*` variables
contextuales).

### Autenticación y credenciales
SSO/OAuth configurable (Google Workspace, Microsoft/Azure, Okta); service accounts (tokens) para
automatización sin login.

### Secrets
Credenciales sensibles almacenadas como "Variables" cifradas; cuando un Resource referencia un
secreto vía `$var:`, solo la referencia queda en el historial de versiones — el secreto nunca
entra en él. Historial append-only (hasta 100 versiones) con purga selectiva de credenciales
inline antiguas. Detalle criptográfico exacto — PENDIENTE DE INVESTIGACIÓN PROFUNDA.

### Permisos / autorización
Modelo multinivel: Superadmin/Devops/Usuario (instancia); Admin/Developer/Operator/Service
Accounts (workspace); ACLs de grano fino (Owner/Writer/Viewer) por entidad; organización por rutas
(`u/<user>/`, `f/<folder>/` con permisos en cascada); **"Run on behalf of"** (ejecución con
identidad de usuario designado); Guests y Anonymous Viewers.

### MCP
No mencionado en el README — Windmill no parece centrado en MCP. PENDIENTE DE INVESTIGACIÓN
PROFUNDA si alguna feature reciente lo añade.

### Ejecución
Workers stateless (Rust) consumiendo cola en Postgres; aislamiento vía **nsjail**
(filesystem/recursos) y namespace de PID; overhead ~50ms por job.

### Sesiones / estado
Persistencia de estado entre ejecuciones vía API `wmill.getState()`/`setState()`.

### Auditoría / observabilidad
Logs siempre disponibles, formato JSON opcional; métricas Prometheus **solo en Enterprise
Edition**.

### Self-hosting
Docker Compose, Helm/Kubernetes, despliegue en clouds. **Modelo dual importante**: el binario sin
flag "enterprise" es AGPLv3 puro, pero la Community Edition distribuida incluye componentes
propietarios de código no público — no se puede revender, ofrecer como servicio gestionado,
modificar o empaquetar sin acuerdo explícito.

### Licencia
Modelo múltiple: **AGPLv3** (backend/frontend por defecto), **Apache 2.0** (clientes, specs
OpenAPI/OpenFlow), **propietaria/comercial** (features bajo flag "enterprise", no en el repo
fuente).

### Ideas potencialmente útiles para AgentForge
- Patrón **Resource / Resource Type** (schema JSON + tipos reutilizables + Hub comunitario) para
  definir conectores de forma declarativa y versionada.
- **Placeholders resueltos en tiempo de ejecución** (`$var:`, `$res:`) para evitar que secretos
  entren en historiales/logs.
- **ACLs de grano fino basadas en rutas** combinadas con roles de workspace.
- **"Run on behalf of"** (ejecución delegada con identidad acotada) — relevante para auth/permisos
  en ejecución remota de tools.
- Aislamiento de ejecución vía sandboxing de procesos (nsjail) como referencia.
- Historial append-only de configuración con purga selectiva de secretos.

### Elementos que probablemente no necesitamos
- El motor de workflows completo tipo DAG (orquestación de baja latencia comparable a
  Airflow/Temporal) — fuera del alcance de infraestructura de tool-use.
- Generación automática de UIs (low-code app builder).
- Triggers Kafka/WebSockets/email como mecanismos de disparo.
- El modelo de negocio dual con componentes propietarios cerrados — patrón a evitar, no a adoptar.

---

## IBM ContextForge (MCP Gateway / `IBM/mcp-context-forge`)

### Propósito
FUNCIONALIDAD VERIFICADA: gateway, proxy y registro de MCP — punto central de gestión para
tools/resources/prompts accesibles por aplicaciones LLM compatibles con MCP. Convierte REST↔MCP,
compone "virtual MCP servers", convierte entre transportes (stdio/SSE/Streamable HTTP/WebSocket).

### Funcionalidades principales
Federa múltiples servidores MCP, servidores A2A y APIs REST/gRPC en un endpoint unificado;
descubrimiento centralizado; rate-limiting; observabilidad; composición de "virtual servers"; UI
de administración opcional; sistema de plugins; escala multi-cluster en Kubernetes con
federación/caché Redis.

### Tools / Connectors
Registro central de tools/prompts/resources **con versionado y rollback**; adaptación automática
de endpoints REST a MCP (extracción de JSON Schema); descubrimiento con federación namespaced;
múltiples gateways remotos como peers con health-checking.

### Autenticación y credenciales
Email + hashing Argon2id; JWT (HS256/RS256); SSO (GitHub, Google, Microsoft Entra ID, IBM Security
Verify, Okta, Keycloak, OIDC genérico); OAuth 2.0 con Dynamic Client Registration (RFC 7591); API
keys; "One-Time Authentication Servers" (credenciales de un solo uso).

### Secrets
INTERPRETACIÓN: configuración vía variables de entorno con almacenamiento cifrado en PostgreSQL
cuando aplica. Mecanismo exacto de cifrado/rotación e integración con vaults externos — PENDIENTE
DE INVESTIGACIÓN PROFUNDA.

### Permisos / autorización
Modelo basado en **equipos**: equipos personales con invitaciones; permisos por roles con alcance
global/equipo/personal; autorización de tools a nivel de recurso dentro de virtual servers; roles
personalizados con configuración de bootstrap; caché de datos de auth para reducir lookups.

### MCP
**Núcleo del proyecto**: implementación nativa de servidor MCP (protocolo 2025-03-26), federando
múltiples gateways peer. Es el proyecto de los nueve estudiados más directamente centrado en MCP.

### Ejecución
Arquitectura híbrida en tres modos: Python-only (FastAPI, todas las operaciones), Shadow mode
(sidecar Rust espejando tráfico para pruebas), Edge/Full mode (runtime Rust maneja tráfico público
`/mcp`, Python sigue siendo autoridad de auth/RBAC).

### Sesiones / estado
JWT para sesiones; federación multi-cluster opcional respaldada por Redis; pooling de sesiones
MCP; caché configurable de lookup de tools.

### Auditoría / observabilidad
OpenTelemetry (Jaeger, Zipkin, Phoenix, backends OTLP); logging JSON estructurado con rotación;
API de métricas (`/metrics`, solo admin); generación de "support bundles" para troubleshooting;
audit trails para compliance.

### Self-hosting
Totalmente self-hostable, sin versión "hosted-only" detectada: standalone (Python + SQLite),
contenedor (Docker/Podman rootless), Kubernetes nativo, serverless (IBM Cloud Code Engine, AWS
Lambda, Google Cloud Run, Azure Container Apps), on-premises (Docker Compose, Terraform, Ansible).

### Licencia
**Apache License 2.0**, sin modelo dual ni edición enterprise cerrada detectada — proyecto
totalmente abierto bajo licencia permisiva.

### Ideas potencialmente útiles para AgentForge
- **"Virtual MCP servers"**: composición/agregación de tools de múltiples fuentes (REST, otros
  MCP, A2A) bajo un endpoint namespaced único — directamente aplicable al objetivo de AgentForge.
- **Federación namespaced de tools** para evitar colisiones de nombres al agregar fuentes.
- **Registro de tools/prompts/resources con versionado y rollback**.
- Modelo de **auth en capas** (SSO/OIDC + JWT + API keys + DCR) — estudiar DCR para
  auto-registro de clientes MCP.
- Arquitectura híbrida Python (autoridad auth/RBAC) + runtime rápido opcional en el hot path.
- Observabilidad con OpenTelemetry estándar (múltiples backends).
- Roles con alcance global/equipo/personal como modelo RBAC granular.

### Elementos que probablemente no necesitamos
- El sidecar Rust y los tres modos de ejecución — optimización de rendimiento específica de escala
  multi-cluster IBM, prematuro para fases iniciales de AgentForge.
- Despliegues serverless específicos de IBM Cloud.
- Integración específica con IBM Security Verify (nicho corporativo).

---

## MCPX (Lunar.dev — `TheLunarCompany/lunar`)

> **Nota sobre ambigüedad del nombre:** "MCPX" es un nombre usado por varios proyectos/paquetes en
> el espacio MCP. El candidato con mayor peso institucional y mejor documentado es el componente
> "MCP Gateway" de Lunar.dev, perfilado aquí. Otros usos menores del nombre no se investigaron.

### Propósito
FUNCIONALIDAD VERIFICADA: gateway/proxy nativo para agentes de IA que gestiona, gobierna y
optimiza el consumo de APIs de terceros y el tráfico MCP entre agentes y servidores MCP (locales y
remotos).

### Funcionalidades principales
Agregación "zero-code" de múltiples servidores MCP en un único punto de acceso (config JSON, sin
modificar servidores existentes); visibilidad de tráfico en tiempo real (latencia, errores,
costes, tokens); policy enforcement; control de tráfico (rate limiting, reintentos, colas de
prioridad, circuit breakers); Control Plane para inspección/administración en vivo; service
discovery.

### Tools / Connectors
Gateway único para servidores MCP locales y remotos, lanzando otros servidores MCP internamente en
tiempo real; registro centralizado de servidores MCP internos/externos vía portal unificado.

### Autenticación y credenciales
Token, perfiles de acceso basados en roles, API keys, OAuth para acceso a servidores MCP,
integraciones SSO (Okta, Azure AD). "Atribución on-behalf-of": cada acción trazable a un usuario o
agente específico.

### Secrets
INTERPRETACIÓN: sin documentación primaria detallada. La edición enterprise incluye DLP para
redactar información sensible en requests/responses. Mecanismo exacto de gestión de secretos —
PENDIENTE DE INVESTIGACIÓN PROFUNDA.

### Permisos / autorización
RBAC con permisos granulares (qué usuarios invocan qué herramientas de qué agentes); ACLs y
"consumer tags" para restringir qué agentes invocan qué herramientas; límites de tasa/presupuesto
por rol.

### MCP
Núcleo del producto — es literalmente un gateway/agregador MCP, compatible con Claude Desktop,
Cursor y otras apps MCP.

### Ejecución
Contenedor Docker; despliegue local (edición open source), autoalojado en nube privada/on-premise,
o en la VPC propia del cliente (enterprise).

### Sesiones / estado
PENDIENTE DE INVESTIGACIÓN PROFUNDA — sin documentación primaria clara sobre manejo de
sesiones/estado persistente.

### Auditoría / observabilidad
"Audit trails inmutables" por acción de agente; telemetría por llamada MCP/herramienta; métricas
Prometheus (nombres de tool, IDs de agente, estados de error); streaming a SIEM; dashboards con
detección de anomalías.

### Self-hosting
Open-source en su núcleo, gratuito para uso no productivo/personal. Edición enterprise (RBAC
centralizado, auditoría avanzada, soporte) requiere onboarding guiado, exclusivamente autoalojada.
Línea exacta entre lo MIT/abierto y lo exclusivamente de pago — no completamente clara.

### Licencia
Repo raíz: **MIT** (confirmado en LICENSE). **Caveat importante**: el README indica "gratis solo
para uso no productivo/personal", lo cual contrasta con una licencia MIT puramente permisiva sin
esa restricción legal — contradicción aparente no resuelta con las fuentes disponibles. PENDIENTE
DE INVESTIGACIÓN PROFUNDA si existen partes con licencia distinta no detectadas.

### Ideas potencialmente útiles para AgentForge
- Patrón de **gateway/agregador central** con configuración declarativa (JSON) en vez de código
  por conector.
- **Atribución on-behalf-of** por llamada a herramienta — trazabilidad para un sistema de
  permisos.
- **ACLs + "consumer tags"** como modelo de autorización granular a nivel de tool-call.
- **Audit trail inmutable + métricas Prometheus** por llamada a herramienta.
- Traffic shaping (rate limiting, circuit breakers, colas de prioridad) aplicado específicamente a
  llamadas de herramientas de agentes.
- Separación conceptual proxy/gateway de control vs. servidores MCP reales.

### Elementos que probablemente no necesitamos
- Integraciones SSO empresariales específicas como prioridad temprana.
- Optimización de costes de API / detección de "waste" (orientado a FinOps de terceros).
- Dashboards de detección de anomalías tipo SIEM — sobre-ingeniería para fase temprana.

---

## Activepieces

### Propósito
FUNCIONALIDAD VERIFICADA: plataforma de automatización/workflows open-source, descrita como
alternativa a Zapier/Make/n8n, con integración nativa de agentes de IA vía MCP como diferenciador.

### Funcionalidades principales
Constructor de workflows con loops/ramas/reintentos; 200-300+ integraciones ("pieces"); ejecución
de código Node.js dentro de workflows; capacidades de IA nativas ("Ask AI in Code"); flujos
human-in-the-loop con aprobaciones; versionado de flows; exposición de piezas como servidores MCP
(~400 según marketing).

### Tools / Connectors
"Pieces": paquetes npm TypeScript con framework type-safe y hot-reload, ~60% contribuidos por la
comunidad. Cada pieza puede exponerse automáticamente como servidor/herramienta MCP.

### Autenticación y credenciales
"Piece Auth": cada pieza declara qué credenciales necesita; el usuario las introduce una vez en
una "Connection" reutilizable en múltiples flows.

### Secrets
El campo `value` de cada Connection se cifra (`encryptUtils`) antes de guardarse en PostgreSQL, y
se descifra solo al enviarlo al motor de ejecución; clave de cifrado de 256 bits
(`AP_ENCRYPTION_KEY`) vía variable de entorno — confirmado en `.env.example` del repo (fuente
primaria). También soporta integración con AWS Secrets Manager para recuperar el valor en tiempo
de ejecución en vez de guardarlo localmente.

### Permisos / autorización
RBAC por "Projects": roles Admin/Editor/Operator/Viewer, roles personalizados con permisos
granulares. **Caveat importante**: la documentación indica explícitamente que este RBAC granular
es "a paid feature" (Enterprise/Cloud), no parte del núcleo MIT.

### MCP
Uso central: las 200-300+ pieces se exponen automáticamente como herramientas MCP, ejecutando un
servidor MCP que expone servicios como Gmail/Slack/Stripe como tools invocables. Compatible con
Claude Desktop, Cursor, Windsurf.

### Ejecución
Arquitectura basada en colas (Redis/BullMQ): workers hacen polling de jobs, asignan un sandbox de
un pool, ejecutan el flow con el engine (TS compilado) dentro del sandbox, comunicación vía
WebSocket. Componentes: `api` (Fastify), `worker`, `server-sandbox`, `engine`.

### Sesiones / estado
Flows versionados con seguimiento de ejecución ("runs", incl. soporte para retrasos de aprobación
humana); persistencia en PostgreSQL; almacenamiento de objetos para logs de ejecución.

### Auditoría / observabilidad
"Audit Logs con seguimiento completo de actividad" mencionado como función **Enterprise-grade**
(junto con SOC 2 Type II, GDPR, SSO SAML) — no confirmado como parte del núcleo community. Detalle
exacto de logging por defecto en community — PENDIENTE DE INVESTIGACIÓN PROFUNDA.

### Self-hosting
Totalmente autoalojable vía Docker/Docker Compose, promocionado explícitamente como
"network-gapped for maximum security". Núcleo completo (MIT) cubre constructor de flows, pieces,
ejecución, conexiones cifradas. Funciones Enterprise (RBAC granular, SSO SAML, audit logs
completos, branding, aislamiento multi-tenant avanzado) bajo licencia comercial separada.

### Licencia
Dual: **MIT** para el código Community Edition (la mayoría del repo); `packages/ee/` y
`packages/server/api/src/app/ee` bajo **licencia propietaria separada** (`packages/ee/LICENSE`,
contenido exacto no leído en este pase — PENDIENTE DE INVESTIGACIÓN PROFUNDA si se necesita
evaluar restricciones específicas).

### Ideas potencialmente útiles para AgentForge
- Modelo **"piece" type-safe** con esquema declarativo de auth por conector — patrón limpio para
  definir conectores de forma uniforme.
- **Cifrado de credenciales a nivel de campo** con clave configurable vía entorno, descifrado solo
  en el momento de uso — patrón simple y auditable para self-hosted.
- **Integración con gestores de secretos externos** (AWS Secrets Manager) como alternativa al
  almacenamiento local.
- **Arquitectura worker + sandbox pool + engine** con colas — buen modelo de referencia para
  ejecución remota aislada y escalable.
- **Auto-exposición de conectores existentes como herramientas MCP** — "un conector, múltiples
  protocolos de consumo".
- Modelo de Projects + roles como unidad de aislamiento multi-tenant (el concepto de scoping por
  proyecto es replicable aunque el RBAC granular sea de pago).

### Elementos que probablemente no necesitamos
- Constructor de workflows no-code/visual completo — AgentForge es infraestructura de tool-use,
  no un builder de flujos end-user.
- Ecosistema de 200-300+ integraciones de negocio predefinidas.
- Funciones de branding/white-labeling.
- Cumplimiento normativo específico (SOC 2, GDPR) como producto — importante como objetivo eventual,
  no como patrón arquitectónico a adaptar ahora.

---

## Pipedream (perfil breve — proyecto secundario)

### Propósito
FUNCIONALIDAD VERIFICADA (pipedream.com/docs/connect/mcp, github.com/PipedreamHQ/pipedream):
plataforma de integración/automatización que conecta agentes de IA y workflows con miles de
APIs/apps SaaS, gestionando auth y ejecución centralizadamente.

### Funcionalidades principales
"3.000+ apps/APIs" y "10.000+ tools" preconstruidas con interfaz consistente; automatizaciones
event-driven además de acceso vía MCP; credenciales cifradas en reposo, peticiones pasan por los
servidores de Pipedream sin exponerlas al modelo/agente.

### MCP
Servidor MCP oficial ("Pipedream Connect MCP") que expone su catálogo a asistentes de IA;
servidores alojados por Pipedream o auto-desplegables (mcp.pipedream.com); mantienen
`PipedreamHQ/awesome-mcp-servers`, lista curada de servidores MCP de terceros.

### Licencia / self-hosting
El repo tiene LICENSE pero el tipo exacto no se confirmó (PENDIENTE DE INVESTIGACIÓN PROFUNDA). La
documentación de Connect MCP no menciona self-hosting del servicio principal — parece
fundamentalmente una plataforma SaaS alojada; uso personal gratuito, producción de terceros
requiere plan de pago.

### Ideas potencialmente útiles para AgentForge
- Patrón "credenciales nunca expuestas directamente al modelo, todo pasa por un proxy
  intermediario" — patrón de seguridad sólido para la capa de secrets/auth.
- Catálogo curado tipo "awesome-mcp-servers" como referencia ligera para catalogar/filtrar
  conectores de terceros, sin construir infraestructura propia de descubrimiento.

---

## Smithery (perfil breve — proyecto secundario)

### Propósito
FUNCIONALIDAD VERIFICADA (smithery.ai): registro/marketplace de servidores MCP para descubrir,
instalar y conectar agentes a miles de herramientas, gestionando automáticamente
autenticación/credenciales/sesiones.

### Funcionalidades principales
Catálogo con "21.000+ MCPs" listados, con métricas de uso por servidor; instalación/gestión vía
CLI (`smithery auth login`, `smithery mcp add`, `smithery tool call`); promete "cero configuración
OAuth" y almacenamiento seguro de credenciales (mecanismo interno exacto — PENDIENTE DE
INVESTIGACIÓN PROFUNDA).

### MCP
Habla MCP nativamente — es una capa de registro/despliegue sobre el ecosistema MCP, no un
protocolo propio.

### Licencia / self-hosting
Repos bajo `smithery-ai` para CLI y colecciones comunitarias, pero la licencia del núcleo del
registro/marketplace no quedó clara (PENDIENTE DE INVESTIGACIÓN PROFUNDA). Mención de "agent.pw"
como "open-source agent vault" (no verificado en detalle). Recientemente Smithery pasó a formar
parte de Arcade.dev.

### Ideas potencialmente útiles para AgentForge
- Modelo de "registro con métricas de uso por servidor" como señal de confianza/calidad — podría
  inspirar cómo AgentForge decide qué conectores de terceros recomendar.
- CLI unificada simple (`auth login` / `mcp add` / `tool call`) como patrón de UX limpio.

---

## GooSio — no verificado como proyecto real

Durante la investigación **no se pudo confirmar la existencia de un proyecto real llamado
"GooSio"** en el espacio de herramientas para agentes de IA/MCP/conectores. Las primeras búsquedas
generaron información que resultó ser **fabricada por las propias herramientas de búsqueda/fetch**
(un dominio, un paquete PyPI y un repositorio que no existen), detectada y descartada mediante
verificación cruzada directa:

- La API de GitHub no lista ningún repositorio "goosio" en la organización que se citaba
  inicialmente.
- El dominio `goosio.dev` no resuelve en DNS.
- El paquete `goosio` no existe en PyPI.
- "Goosio" parece corresponder a un personaje de un programa infantil maltés, sin relación con
  software.

**No se incluye ningún perfil de GooSio** porque no existe fuente primaria verificable. Esto queda
marcado explícitamente como **PENDIENTE DE INVESTIGACIÓN PROFUNDA** — si "GooSio" es un proyecto
real con otro nombre exacto, URL o repositorio, deberá confirmarse esa referencia concreta antes de
investigarlo. No se debe incorporar ninguna "idea de GooSio" a AgentForge hasta resolver esta
ambigüedad.

---

## Matriz consolidada de funcionalidades

La columna "Relevancia potencial" usa categorías descriptivas, no puntuaciones: **Muy interesante
para estudiar**, **Interesante**, **Posiblemente útil**, **Probablemente fuera de alcance**,
**Requiere más investigación**.

| Funcionalidad | Proyectos que la ofrecen | Relevancia potencial para AgentForge | Observaciones |
|---|---|---|---|
| Tool Registry (con versionado) | ContextForge, Arcade, Nango (parcial), MCPX (parcial) | Muy interesante para estudiar | ContextForge es el más explícito en versionado+rollback |
| Tool Discovery / agregación de fuentes | ContextForge (virtual servers, federación namespaced), MCPX (gateway zero-code) | Muy interesante para estudiar | Complementa el patrón de meta-tools ya estudiado en Composio (Fase 0) |
| OAuth / auth por conector | Nango, Arcade, Windmill, ContextForge, Activepieces, Pipedream, Smithery | Interesante | Patrón "check-then-request" de Arcade y el flujo de Piece Auth de Activepieces son los más claros y documentados |
| Secrets Broker | Windmill (`$var:`), Activepieces (cifrado de campo + AWS Secrets Manager), Arcade | Muy interesante para estudiar | Activepieces es el único con detalle técnico primario concreto (variable de cifrado, campo cifrado en BD) |
| Authorization / Policy (RBAC granular) | Windmill, ContextForge, MCPX, Activepieces (de pago) | Interesante | En varios proyectos el RBAC granular es función de pago, no del núcleo abierto — relevante para decisiones de licencia propia |
| MCP Gateway / agregación | ContextForge, MCPX, Arcade (Platform Zone) | Muy interesante para estudiar | Los tres abordan el mismo problema con arquitecturas distintas — buena base comparativa para diseño propio |
| Remote Execution | Windmill (workers + nsjail), Activepieces (worker+sandbox+engine), Arcade (runtime distribuido) | Interesante | Los patrones de aislamiento de ejecución (nsjail, sandbox pool) son los más transferibles a la ejecución SSH que AgentForge necesita |
| Audit Log | ContextForge, MCPX, Arcade, Nango (de pago), Activepieces (de pago) | Muy interesante para estudiar | OpenTelemetry aparece como estándar de facto en varios proyectos |
| Sessions | Nango (Connections), Windmill (getState/setState), Activepieces (runs versionados) | Posiblemente útil | Ningún proyecto documenta con claridad primaria un modelo de "sesión de agente" equivalente al que investigó la Fase 0 sobre Composio |
| Connectors (catálogo) | Todos en distinto grado | Probablemente fuera de alcance como objetivo | Expandir un catálogo de cientos/miles de conectores no es el problema central de AgentForge; el patrón de *cómo* se definen sí interesa |
| Web Dashboard | Windmill, ContextForge, MCPX, Activepieces | Probablemente fuera de alcance por ahora | Relevante solo si AgentForge decide construir Fase 12 (Dashboard) del roadmap |
| Self-hosting | Todos los principales, en distinto grado | Interesante para estudiar el patrón, no para copiar el modelo de licencia | Patrón común detectado: framework/core relativamente abierto + funciones de producción/gobernanza restringidas o de licencia poco clara ("open-core") |

---

## Ideas candidatas para AgentForge

Estas son ideas candidatas para evaluación futura — **ninguna constituye una decisión
arquitectónica**. Su origen en un proyecto concreto no implica intención de copiar su
implementación; el objetivo es identificar el concepto y, en una fase posterior, decidir cómo (o
si) AgentForge lo implementaría según su propia arquitectura.

### Tools y Registry
- **Registro de tools con versionado y rollback** (de: ContextForge). Resuelve: poder evolucionar
  el catálogo de herramientas sin romper integraciones existentes. Por qué útil: es un requisito
  básico de cualquier Tool Registry de producción. Complejidad aproximada: media. Requiere más
  investigación: sí — cómo ContextForge implementa el rollback en detalle.
- **Patrón Resource / Resource Type** (de: Windmill). Resuelve: definir conectores de forma
  declarativa, reutilizable y con schema validado. Por qué útil: separa "qué es una conexión" de
  "cómo se usa", con un Hub de tipos reutilizables. Complejidad aproximada: media.

### Discovery
- **Virtual MCP servers / federación namespaced** (de: ContextForge). Resuelve: agregar tools de
  múltiples fuentes (REST, MCP, otros) bajo un espacio de nombres sin colisiones. Por qué útil:
  complementa directamente el patrón de meta-tools ya estudiado en Composio (Fase 0). Complejidad
  aproximada: alta. Requiere más investigación: sí.
- **Gateway zero-code con config declarativa** (de: MCPX/Lunar.dev). Resuelve: agregar servidores
  MCP existentes sin modificarlos. Por qué útil: reduce fricción de integración. Complejidad
  aproximada: media.

### Connectors
- **"Piece" type-safe con auth declarada** (de: Activepieces). Resuelve: definir de forma uniforme
  qué credenciales necesita cada conector. Por qué útil: patrón limpio, con implementación de
  referencia concreta y verificable (paquetes npm TypeScript). Complejidad aproximada: media.
- **Auto-exposición de conectores como MCP** (de: Activepieces, Arcade). Resuelve: evitar duplicar
  trabajo de definición entre "conector interno" y "herramienta MCP". Por qué útil: un conector,
  múltiples protocolos de consumo. Complejidad aproximada: media-alta.

### OAuth / autenticación
- **Patrón "check-then-request"** (de: Arcade). Resuelve: no repetir flujos OAuth innecesariamente,
  con consentimiento explícito solo cuando falta. Por qué útil: buena UX de autorización sin
  comprometer seguridad. Complejidad aproximada: media.
- **Dynamic Client Registration (RFC 7591)** (de: ContextForge). Resuelve: auto-registro de
  clientes MCP. Por qué útil: reduce fricción operativa a escala. Complejidad aproximada: alta.
  Requiere más investigación: sí (ya señalado también en `docs/research/MCP-ANALYSIS.md` de la
  Fase 0, donde se documentó que CIMD está sustituyendo a DCR como mecanismo primario en la
  especificación MCP más reciente — contrastar antes de adoptar DCR).

### Secrets
- **Cifrado de credenciales a nivel de campo con clave vía entorno** (de: Activepieces). Resuelve:
  gestión de secretos self-hosted simple y auditable, sin infraestructura de vault externa
  obligatoria. Por qué útil: es el patrón con más detalle técnico primario verificado de todo este
  bloque de investigación (variable `AP_ENCRYPTION_KEY`, campo cifrado en BD). Complejidad
  aproximada: baja-media. Coherente con la conclusión de la Fase 0 (`SECURITY.md`,
  `research/SSH-SECURITY-NOTES.md`) de que un vault empresarial completo es sobredimensionado para
  la fase 1.
- **Integración opcional con gestores de secretos externos** (de: Activepieces — AWS Secrets
  Manager). Resuelve: permitir que AgentForge no sea la única fuente de verdad de secretos si el
  usuario ya tiene un vault. Por qué útil: opcional, no bloqueante. Complejidad aproximada: media.
- **Placeholders resueltos en tiempo de ejecución** (de: Windmill). Resuelve: que los secretos
  nunca aparezcan en historiales de configuración versionados. Por qué útil: mitigación concreta y
  simple de fuga de secretos por versionado. Complejidad aproximada: baja.

### Authorization / Policy
- **ACLs + "consumer tags" a nivel de tool-call** (de: MCPX/Lunar.dev). Resuelve: qué agente puede
  invocar qué herramienta, no solo qué conexión puede usar. Por qué útil: grano más fino que el
  simple allow/deny de conexión. Complejidad aproximada: media.
- **"Run on behalf of"** (de: Windmill). Resuelve: ejecución delegada con identidad acotada de un
  usuario virtual. Por qué útil: relevante para el problema de auth en ejecución remota que
  AgentForge ya identificó como forco propio en la Fase 0. Complejidad aproximada: media-alta.

### MCP
- **Dos servidores MCP con propósitos distintos (gestión vs. runtime)** (de: Nango). Resuelve:
  separar el plano de control (configuración/debug) del plano de ejecución (tool calling real).
  Por qué útil: reduce superficie de riesgo del servidor de ejecución. Complejidad aproximada:
  media.
- **Registrar servidores MCP externos bajo el mismo marco de gobernanza que las tools propias**
  (de: Arcade). Resuelve: gobernar de forma unificada tools propias y de terceros. Por qué útil:
  evita tener dos sistemas de política distintos. Complejidad aproximada: media-alta.

### Remote Execution
- **Aislamiento de ejecución vía sandboxing de procesos** (de: Windmill — nsjail; Activepieces —
  sandbox pool). Resuelve: ejecutar código/comandos de forma aislada y con recursos acotados. Por
  qué útil: directamente relevante para el ejecutor SSH que la Fase 0 identificó como forato
  propio de AgentForge (ver `architecture/ARCHITECTURE-DRAFT.md` §4). Complejidad aproximada: alta.
  Requiere más investigación: sí — nsjail es específico de Linux, hay que evaluar equivalentes o
  el hecho de que la ejecución SSH ya corre en el host remoto (Debian), no en la máquina Windows.
- **Arquitectura worker + cola + engine** (de: Activepieces). Resuelve: desacoplar la recepción de
  una petición de ejecución de su procesamiento real, con reintentos y aislamiento. Por qué útil:
  patrón escalable y bien establecido. Complejidad aproximada: alta — probablemente
  sobredimensionado para la fase 1 de AgentForge (un solo desarrollador, dos hosts).

### Sessions
- Ningún proyecto de este bloque documentó con claridad primaria un modelo de "sesión de agente"
  comparable en profundidad al de Composio (analizado en Fase 0). **Requiere más investigación**
  si se decide profundizar, o bien construir el modelo de sesión de AgentForge principalmente a
  partir de lo ya estudiado en Composio (`docs/research/COMPOSIO-ANALYSIS.md` §4) más el patrón de
  "Connection" de Nango como referencia adicional ligera.

### Audit / Observability
- **OpenTelemetry como estándar de auditoría/observabilidad** (de: ContextForge, Arcade, Nango).
  Resuelve: no inventar un formato propietario de logs/métricas. Por qué útil: aparece de forma
  consistente en 3 de los 9 proyectos, sugiriendo que es efectivamente un estándar de facto en
  este espacio. Complejidad aproximada: media. Coherente con la recomendación ya hecha en
  `SECURITY.md` de que el Audit Log sea append-only y consultable.
- **Audit trail inmutable por llamada a herramienta con atribución on-behalf-of** (de: MCPX). Ver
  también sección Authorization/Policy — mismo concepto aplicado a logging.

### Dashboard
- Ningún hallazgo específico más allá de "todos los proyectos con producto maduro tienen uno" —
  no se identificó ningún patrón técnico de dashboard suficientemente diferenciado como para
  destacarlo en esta fase ligera. **Probablemente fuera de alcance** hasta que AgentForge llegue a
  la fase de Dashboard del roadmap (Fase 12).

### Plugins / extensibilidad
- **Sistema de plugins como framework de middleware** (de: ContextForge, ADR 0016). Resuelve:
  extender el comportamiento del gateway sin modificar su núcleo. Por qué útil: relevante si
  AgentForge construye un gateway/broker propio (ver `architecture/ARCHITECTURE-DRAFT.md` §1-§3).
  Complejidad aproximada: alta. Requiere más investigación: sí.

### Self-hosting
- **Patrón "open-core"** observado de forma consistente (Nango, Windmill, Arcade probablemente,
  Activepieces, MCPX): framework/núcleo relativamente abierto + funciones de producción/gobernanza
  restringidas o de licencia poco clara. Esto **no es una idea a adoptar como patrón de
  licenciamiento** para AgentForge (contrario al principio de transparencia ya declarado en
  `README.md`), pero sí es una observación relevante: casi ningún proyecto estudiado ofrece un
  self-hosting verdaderamente completo y gratuito con todas sus capacidades de producción — algo a
  tener presente si en el futuro se evalúa la licencia de AgentForge (decisión todavía pendiente,
  ver `decisions/DECISIONS.md`).

---

## Notas sobre licencias — PENDIENTE DE REVISIÓN

Resumen de licencias identificadas (no se ha copiado código de ningún proyecto; esta fase es
únicamente de estudio de ideas):

| Proyecto | Licencia del núcleo/repo principal | Componentes con licencia distinta |
|---|---|---|
| Nango | Elastic License 2.0 (source-available, no OSI) | — |
| Arcade AI (`arcade-ai`/`arcade-mcp`) | MIT | Algunos repos (docs, paquetes TS): Apache 2.0. Licencia del Arcade Engine (producción): **no confirmada** — `PENDIENTE DE REVISIÓN` |
| Windmill | AGPLv3 (backend/frontend por defecto) | Clientes/specs: Apache 2.0. Features "enterprise": propietaria, no en el repo — `PENDIENTE DE REVISIÓN` si se considera relevante en el futuro |
| IBM ContextForge | Apache 2.0 | Ninguna detectada en esta pasada |
| MCPX (Lunar.dev) | MIT (repo raíz) | Contradicción aparente entre MIT y mensaje "gratis solo para uso no productivo" — `PENDIENTE DE REVISIÓN` |
| Activepieces | MIT (Community Edition) | `packages/ee/` y `packages/server/api/src/app/ee`: licencia propietaria separada (contenido exacto no leído) — `PENDIENTE DE REVISIÓN` |
| Pipedream | No confirmada con precisión en esta pasada | `PENDIENTE DE REVISIÓN` |
| Smithery | No confirmada con precisión en esta pasada (núcleo del registro/marketplace) | `PENDIENTE DE REVISIÓN` |
| GooSio | No aplica — proyecto no verificado como real | — |

No se ha detectado ningún problema legal urgente para AgentForge en esta fase, ya que **no se ha
copiado ni se va a copiar código de ninguno de estos proyectos** — solo se estudian conceptos. Los
puntos marcados `PENDIENTE DE REVISIÓN` solo cobrarían relevancia legal si en el futuro se
considerara reutilizar código concreto de alguno de estos proyectos, lo cual no es el caso ahora.

---

## Proyectos adicionales detectados durante la investigación (no solicitados, mencionados brevemente)

Ninguno de los agentes de investigación reportó un candidato adicional claramente relevante fuera
de la lista original de 9 proyectos. No se amplía el alcance.

---

## Metodología y limitaciones

- Esta es una investigación **ligera**, no una due-diligence completa como la realizada con
  Composio en la Fase 0. No se ha examinado código fuente en detalle salvo puntos concretos
  (ficheros LICENSE, `.env.example` de Activepieces).
- Varias fuentes fueron resúmenes generados por herramientas de fetch/búsqueda sobre páginas
  oficiales, no siempre cita textual exacta — se han marcado con el nivel de confianza
  correspondiente en cada informe de origen.
- El caso de GooSio confirma la importancia de verificar con fuentes "duras" (API directa, DNS,
  registro de paquetes) antes de aceptar contenido resumido sobre páginas no encontradas — una
  lección metodológica que queda registrada aquí para futuras fases de investigación.
- Los puntos marcados `PENDIENTE DE INVESTIGACIÓN PROFUNDA` no se han investigado más a fondo
  deliberadamente, siguiendo el criterio de eficiencia de esta fase (valor de la información /
  tiempo invertido).
