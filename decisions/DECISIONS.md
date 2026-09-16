# DECISIONS.md — AgentForge

Aquest fitxer registra **únicament** decisions arquitectòniques o de projecte que l'usuari ha
aprovat explícitament. Durant la FASE 0 (Technical Research & Bootstrap) no s'ha pres cap decisió
d'aquest tipus — només s'han generat propostes (`PROPOSAL`), que es documenten a
`architecture/ARCHITECTURE-DRAFT.md` i `docs/research/RESEARCH-REPORT.md`, no aquí.

Format per a cada decisió futura:

```
## DEC-XXX — <títol curt>
- Data: <data>
- Context: <per què calia decidir>
- Opcions considerades: <resum>
- Decisió: <què s'ha decidit>
- Aprovat per: <usuari>
- Conseqüències: <impacte a curt/llarg termini>
```

---

## DEC-001 — Uso de GitHub para AgentForge

- Fecha: 2026-09-16
- Contexto: la Fase 0.5 requiere no asumir el uso de GitHub y preguntar explícitamente.
- Opciones consideradas: usar GitHub ahora / más adelante / no usarlo.
- Decisión: **sí, usar GitHub ahora**. Repositorio ya creado por el usuario:
  `https://github.com/catlinux/AgentForge`, a la espera del primer commit.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: se configurará el remoto `origin` apuntando a esta URL cuando el usuario autorice
  el primer push (autorización separada del commit, ver `CONTRIBUTING.md`/`.claude/CLAUDE.md`).
  **Visibilidad del repositorio (público/privado) no confirmada explícitamente** — no asumida,
  pendiente de confirmar si es relevante antes del primer push.

## DEC-002 — Identidad Git local para AgentForge

- Fecha: 2026-09-16
- Contexto: la identidad Git global de la máquina (`warcrafted-server`) no corresponde a este
  proyecto; la Fase 0.5 exige no modificar la configuración global y usar configuración local del
  repositorio.
- Opciones consideradas: usar la identidad global existente / configurar una identidad local
  específica.
- Decisión: configurar identidad **local** (no global) para el repositorio de AgentForge con
  email `marc.catlinux@gmail.com`, nombre `catlinux` (correspondiente al usuario de GitHub del
  repositorio). El usuario indica que las credenciales de acceso a GitHub para esta cuenta ya
  están guardadas en el equipo.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: cuando se autorice `git init`, se ejecutará
  `git config user.name "catlinux"` y `git config user.email "marc.catlinux@gmail.com"` **sin**
  `--global`, exclusivamente dentro de este repositorio.

## DEC-003 — Relación de AgentForge con Claude Code

- Fecha: 2026-09-16
- Contexto: `architecture/ARCHITECTURE-DRAFT.md` §0 identificó tres caminos posibles (wrap de la
  CLI, Agent SDK como producto separado, extensión in-place), con impacto en cascada sobre todo el
  resto del diseño.
- Opciones consideradas: (a) wrap de la CLI como subproceso; (b) Agent SDK como producto separado;
  (c) extensión in-place vía hooks/servidores MCP propios.
- Decisión: **(c) extensión in-place**. AgentForge se conecta a Claude Code vía hooks
  (`PreToolUse`/`PostToolUse`) y/o servidores MCP propios, sin runtime de agente separado.
- Aprobado por: usuario (2026-09-16, vía AskUserQuestion).
- Consecuencias: no se duplica el cliente MCP, motor de permisos local, ni subagents de Claude
  Code (ver `docs/research/CLAUDE-CODE-ANALYSIS.md` §10). AgentForge se diseña como un conjunto de
  servidores MCP propios más, opcionalmente, hooks HTTP — nunca como un runtime de agente
  alternativo. Esta decisión condiciona directamente el diseño de la Fase 1
  (`architecture/ARCHITECTURE.md`).

## DEC-004 — Modelo de amenaza del Secrets Broker

- Fecha: 2026-09-16
- Contexto: `SECURITY.md` y `architecture/ARCHITECTURE-DRAFT.md` §5/§9.2 dejaron abierta la
  pregunta de si el Secrets Broker debía correr en el mismo proceso/usuario que el agente o
  separado, dado que el propio proceso del agente LLM es un actor de amenaza potencial (prompt
  injection).
- Opciones consideradas: proceso separado con usuario/permisos propios del SO / mismo
  proceso-usuario que el agente.
- Decisión: **proceso separado, con usuario y permisos propios del sistema operativo**. El Secrets
  Broker nunca comparte espacio de proceso ni identidad de SO con el agente/Claude Code.
- Aprobado por: usuario (2026-09-16, vía AskUserQuestion).
- Consecuencias: incluso si el proceso del agente quedara comprometido, no podría leer
  directamente las credenciales — solo podría solicitar su uso a través de una interfaz mediada
  (IPC/socket local/HTTP local) sujeta a las mismas reglas de permisos/confirmación que cualquier
  otra acción del gateway. Esto añade complejidad de despliegue (dos procesos mínimo) que debe
  reflejarse en la arquitectura de la Fase 1.

## DEC-005 — Alcance MCP de AgentForge

- Fecha: 2026-09-16
- Contexto: `docs/research/MCP-ANALYSIS.md` documentó que la especificación MCP `2026-07-28` es
  una reescritura incompatible (stateless, sin sampling/roots) respecto a versiones anteriores
  ("Legacy"), y que el ecosistema de terceros probablemente aún habla mayoritariamente la versión
  anterior.
- Opciones consideradas: Modern-only (solo espec `2026-07-28`) / Dual-era (Modern + Legacy).
- Decisión: **Modern-only**. AgentForge dirige sus servidores/clientes MCP propios exclusivamente
  a la especificación `2026-07-28`.
- Aprobado por: usuario (2026-09-16, vía AskUserQuestion).
- Consecuencias: diseño más simple, sin lógica de negociación de compatibilidad dual. Riesgo
  aceptado: posible falta de interoperabilidad con servidores MCP de terceros que todavía no hayan
  migrado a la versión moderna del protocolo — a revisar caso por caso si se integra un servidor
  MCP de terceros concreto que resulte ser "Legacy".

## DEC-006 — Arquitectura de autenticación SSH para ejecución remota (fase 1)

- Fecha: 2026-09-16
- Contexto: `research/SSH-SECURITY-NOTES.md` y `architecture/ARCHITECTURE-DRAFT.md` §4/§9.4
  dejaron abierta la elección entre claves SSH dedicadas por host o una CA SSH desde el principio,
  para los dos hosts remotos previstos (Debian de casa, VPS Contabo).
- Opciones consideradas: claves ed25519 dedicadas por host / CA SSH de certificados de corta
  duración desde el inicio.
- Decisión: **claves ed25519 dedicadas por host**, sin agent forwarding, para la fase 1.
- Aprobado por: usuario (2026-09-16, vía AskUserQuestion).
- Consecuencias: diseño proporcionado al tamaño actual (2 hosts, 1 desarrollador). Se revisará la
  necesidad de una CA SSH si el número de hosts u operadores crece significativamente en fases
  futuras (ver `architecture/ARCHITECTURE.md`, sección de extensibilidad).

## DEC-007 — Stack tecnológico de AgentForge

- Fecha: 2026-09-16
- Contexto: `architecture/ARCHITECTURE.md` §17 dejó el stack tecnológico como la pregunta abierta
  más importante de la Fase 1, condicionando varias decisiones secundarias (IPC, empaquetado del
  Secrets Broker, librería SSH). Se elaboró un análisis dedicado en
  `architecture/TECH-STACK-ANALYSIS.md` evaluando TypeScript/Node.js, Python, Go, Rust y C#/.NET
  contra las restricciones de DEC-003 a DEC-006.
- Opciones consideradas: TypeScript/Node.js; Python; Go/Rust/C# (SDK MCP no verificado
  directamente); verificar primero un SDK adicional antes de decidir.
- Decisión: **TypeScript/Node.js**, como stack único para todo AgentForge (Core, servidores MCP
  propios, y el Secrets Broker como proceso separado en el mismo lenguaje — ver DEC-004).
- Aprobado por: usuario (2026-09-16, vía AskUserQuestion, siguiendo la recomendación del
  análisis).
- Consecuencias: SDK MCP oficial TypeScript (Tier 1, Apache 2.0/MIT) como base del transporte MCP;
  librería `ssh2` para el executor SSH (DEC-006); acceso a Windows Credential Manager vía librería
  Node (p. ej. `keytar` o equivalente, a confirmar en la Fase 2); el Secrets Broker se despliega
  como proceso Node independiente bajo una cuenta de Windows distinta (DEC-004), requiriendo que
  Node esté disponible en el `PATH` de esa cuenta. Framework HTTP concreto (Express/Fastify/otro)
  y detalles de empaquetado quedan pospuestos a la Fase 2, para no decidir de más en esta fase
  (`architecture/TECH-STACK-ANALYSIS.md` §5).

## DEC-008 — Estructura de repositorio (Fase 2)

- Fecha: 2026-09-16
- Contexto: `architecture/CORE-STRUCTURE-ANALYSIS.md` (Decisión 1) evaluó monorepo con workspaces,
  paquete único con carpetas internas, y multi-repo, dado que DEC-004 exige que Core y el Secrets
  Broker sean procesos separados y el proyecto debe poder crecer con más servidores MCP/execution
  backends sin reestructurar lo existente.
- Opciones consideradas: (A) monorepo con workspaces; (B) paquete único con carpetas internas;
  (C) multi-repo.
- Decisión: **(A) monorepo con workspaces**, con paquetes iniciales `packages/shared`,
  `packages/core`, `packages/secrets-broker`.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: cada paquete declara sus propias dependencias, reforzando a nivel de empaquetado
  la separación Core/Secrets Broker exigida por DEC-004. Añadir un nuevo servidor MCP o execution
  backend en el futuro es añadir un paquete (`packages/mcp-<nombre>`, `packages/execution-<nombre>`)
  sin tocar los existentes.

## DEC-009 — Gestor de paquetes (Fase 2)

- Fecha: 2026-09-16
- Contexto: `architecture/CORE-STRUCTURE-ANALYSIS.md` (Decisión 2) evaluó npm, pnpm y yarn para el
  monorepo de DEC-008, con especial atención a si el gestor refuerza o debilita el aislamiento de
  dependencias entre Core y el Secrets Broker.
- Opciones consideradas: npm; pnpm; yarn (Classic o Berry/PnP).
- Decisión: **pnpm**.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: el `node_modules` estricto de pnpm impide que un paquete resuelva dependencias no
  declaradas explícitamente ("dependencias fantasma"), reforzando automáticamente, a nivel de
  instalación, la frontera de confianza de DEC-004. Instalación vía Corepack, sin fricción
  adicional.

## DEC-010 — Mecanismo de IPC entre Core y Secrets Broker (Fase 2)

- Fecha: 2026-09-16
- Contexto: `architecture/CORE-STRUCTURE-ANALYSIS.md` (Decisión 3) evaluó named pipe de Windows,
  TCP local con token, socket de dominio Unix en Windows, y pipe stdio (descartado por ser
  incompatible en la práctica con DEC-004). Se amplió el análisis a petición del usuario para
  cubrir explícitamente el comportamiento en Windows, Linux y el impacto de un futuro soporte de
  macOS.
- Opciones consideradas: (A) named pipe de Windows + ACL; (B) TCP loopback + token; (C) socket de
  dominio Unix en Windows; (D) pipe stdio (descartado, incompatible con DEC-004).
- Decisión: mecanismo de IPC con **implementación nativa por sistema operativo**, unificada detrás
  de una interfaz de transporte agnóstica en `packages/shared`, seleccionada en tiempo de ejecución
  según `process.platform`:
  - **Windows:** named pipe (`\\.\pipe\agentforge-secrets`) con ACL restringida al SID del usuario
    de Core y al del Secrets Broker.
  - **Linux/macOS:** Unix domain socket con permisos de fichero/directorio restringidos al usuario
    de Core.
  - La interfaz de `packages/shared` se diseña con vocabulario neutro de sistema operativo (sin
    filtrar conceptos específicos de Windows) desde el principio.
  - **La rama Linux/macOS no se implementa todavía** — Windows es el único sistema operativo real
    de ejecución hoy. Solo se garantiza que la interfaz no excluye añadirla más adelante sin
    rediseño.
- Aprobado por: usuario (2026-09-16, vía respuesta directa, incorporando la aclaración
  multiplataforma).
- Consecuencias: en ambos sistemas operativos, la frontera "solo Core puede hablar con el Broker"
  la aplica el sistema operativo (ACL o permisos de fichero) sobre el canal mismo, no un token de
  aplicación — mantiene intacta la garantía de DEC-004 de forma equivalente en cada SO. El coste de
  un cambio de transporte futuro queda acotado a la implementación de la interfaz en
  `packages/shared`, no a todo el código que la usa. Pendiente, no bloqueante: si en el futuro Core
  y el Secrets Broker corrieran en contenedores/namespaces separados en Linux en vez de como
  usuarios Linux distintos en el mismo host, el modelo de aislamiento cambiaría — no está decidido
  ni es relevante hoy (no hay containerización prevista en el roadmap actual).

## DEC-011 — Convenciones de código (Fase 2)

- Fecha: 2026-09-16
- Contexto: `architecture/CORE-STRUCTURE-ANALYSIS.md` (Decisión 4) evaluó linter/formatter,
  configuración de TypeScript, y framework de testing para el monorepo de DEC-008.
- Opciones consideradas: ESLint+Prettier vs. Biome; TypeScript estricto desde el inicio vs.
  configuración laxa progresiva; Vitest vs. Jest vs. `node:test`.
- Decisión: **TypeScript en modo estricto desde el principio**, **ESLint + Prettier**, **Vitest**
  como framework de testing.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: configuraciones base (`tsconfig.base.json`, configuración raíz de ESLint) viven en
  la raíz del monorepo y cada paquete las extiende. Se considerará `eslint-plugin-security` como
  parte del hardening de una fase posterior (Fase 13 del roadmap), no como requisito de esta fase.

## DEC-012 — Creación del esqueleto de carpetas (Fase 2)

- Fecha: 2026-09-16
- Contexto: `architecture/CORE-STRUCTURE-ANALYSIS.md` (Decisión 5) planteó si crear ya el esqueleto
  de carpetas/`package.json`/configuración base tras aprobar DEC-008 a DEC-011, o tratar esta fase
  como puramente de decisión y crear el esqueleto en un paso posterior explícitamente autorizado.
- Opciones consideradas: (A) crear el esqueleto ahora; (B) esperar a un paso posterior explícito.
- Decisión: **(B) esperar**. No se crea ninguna carpeta ni fichero todavía.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: el árbol de carpetas y el contenido propuesto de cada fichero de configuración se
  presentarán para revisión explícita antes de crear nada, como paso separado.

## DEC-013 — Modelo de datos del Tool Registry (Fase 3)

- Fecha: 2026-09-16
- Contexto: la Fase 3 necesitaba decidir si el modelo interno de datos de una "tool" debía ser
  MCP-native (adoptar literalmente el formato `tools/list` de MCP), MCP-independiente (sin relación
  con MCP), o MCP-compatible (modelo propio con adaptador en el borde). El usuario pidió
  explícitamente no asumir que reutilizar MCP fuera automáticamente la mejor opción.
- Opciones consideradas: (A) schema propio de AgentForge; (B) formato `tools/list` de MCP
  extendido; (C) modelo propio con adaptador MCP explícito en el borde.
- Decisión: **(C) MCP-compatible**. Modelo propio de AgentForge en `packages/shared`, inspirado en
  convenciones de MCP donde aporta valor (JSON Schema para `inputSchema`, que es un estándar en sí
  mismo, no propietario de MCP), con un adaptador explícito MCP↔modelo propio en el borde de
  integración (Fase 8). AgentForge no adopta el formato de MCP como su modelo de dominio.
- Aprobado por: usuario (2026-09-16, vía respuesta directa, tras análisis con implicaciones de
  seguridad, interoperabilidad con DEC-005, y coste de cambio).
- Consecuencias: una tool declarada por un hook propio de AgentForge (DEC-003) o un futuro
  execution backend no necesita simular ser MCP para encajar en el Registry. El Policy Engine
  (Fase 5) puede añadir campos propios (nivel de riesgo, origen) sin ensuciar el formato MCP. Un
  futuro cambio de especificación MCP se absorbe en el adaptador, sin tocar el modelo de dominio ni
  sus consumidores (Policy Engine, Audit Log, UI).

## DEC-014 — Almacenamiento del Tool Registry (Fase 3)

- Fecha: 2026-09-16
- Contexto: había que separar explícitamente cuatro conceptos que se confunden fácilmente: fuente
  de verdad, caché/estado derivado, configuración declarativa, y descubrimiento dinámico — para
  evitar que el Registry tratara una caché de un servidor MCP como si fuera autoritativa.
- Opciones consideradas: (A) ficheros declarativos versionables; (B) base de datos ligera embebida
  (SQLite); (C) solo en memoria, reconstruido en cada arranque.
- Decisión: **(A) ficheros declarativos versionables** para la configuración (qué orígenes
  conectar, metadatos propios de AgentForge) — fuente de verdad de lo que AgentForge decide
  registrar. **Caché ligera en fichero (JSON), no SQLite**, para el resultado del descubrimiento
  dinámico, explícitamente no tratada como fuente de verdad. Sin base de datos en esta fase.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: para tools de un servidor MCP externo, la fuente de verdad real es siempre el
  propio servidor — el Registry nunca sustituye esa autoridad, solo cachea su última respuesta
  conocida con invalidación explícita. Configuración versionable en git, auditable por diff,
  coherente con el resto del proyecto. Migrar a SQLite más adelante (si el catálogo crece mucho o
  se necesita multiusuario) queda acotado si el acceso al Registry pasa siempre por una interfaz
  (`ToolRegistryStore` o equivalente), no por lectura directa de ficheros desde cualquier parte del
  código.

## DEC-015 — Alcance estático/dinámico del Tool Registry (Fase 3)

- Fecha: 2026-09-16
- Contexto: había que decidir si el catálogo es fijo, puramente descubierto en tiempo de ejecución,
  o una combinación — y, crucialmente, trazar la frontera entre el Tool Registry (Fase 3) y el
  futuro Tool Discovery (Fase 4) para que no se solapen responsabilidades.
- Opciones consideradas: (A) catálogo fijo declarado de antemano; (B) descubrimiento dinámico puro;
  (C) combinación — base declarativa de orígenes + descubrimiento dinámico del contenido real.
- Decisión: **(C) combinación**. Qué servidores/orígenes conectar y sus metadatos de AgentForge es
  configuración declarativa (DEC-014); qué tools expone cada origen ahora mismo se obtiene por
  descubrimiento dinámico contra ese origen. Frontera explícita: **Registry cataloga** (qué existe
  y su forma) — **Discovery filtra** (qué subconjunto se expone al agente y cuándo, Fase 4) —
  **Policy Engine autoriza** (qué está permitido ejecutar, Fase 5). El Registry no decide qué
  mostrarle al agente en un momento dado, ni autoriza ejecución.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: el Tool Discovery (Fase 4) se diseñará para leer del Registry, no para
  reimplementar el descubrimiento MCP. El Policy Engine (Fase 5) consumirá el catálogo del
  Registry con su clasificación, no descubrirá tools por sí mismo. El Registry cataloga tools
  nuevas descubiertas dinámicamente sin autorizarlas automáticamente para ejecución.

## DEC-016 — Identidad y versionado de una tool (Fase 3)

- Fecha: 2026-09-16
- Contexto: era necesario distinguir tres conceptos (identidad interna estable, nombre legible, y
  versión del contrato) y definir reglas de resolución concretas, para evitar que una tool nueva
  pudiera heredar accidentalmente la identidad o la autorización de una tool previamente conocida
  — en particular frente a un servidor MCP comprometido intentando suplantar una tool aprobada.
- Opciones consideradas: identificador plano por nombre; identificador namespaced por origen sin
  identidad interna separada; identidad interna estable desacoplada del nombre + namespacing +
  fingerprint de schema versionado, con reglas explícitas de no-herencia automática.
- Decisión: se adoptan tres conceptos distintos:
  - **`identity`** — identificador interno, opaco y estable, generado y controlado exclusivamente
    por AgentForge (nunca por el servidor de origen). Es la clave primaria del Registry.
  - **`qualified name`** — `origen:nombre`, legible, atributo mutable de una `identity`, no clave
    primaria.
  - **`schema fingerprint`** — hash determinista del contrato observado (`inputSchema` y otros
    campos de contrato relevantes), versionado con historial mínimo del fingerprint anterior.

  Reglas de resolución:
  - La coincidencia de `identity` se resuelve por **(origen configurado + nombre reportado)** en
    el momento del descubrimiento — nunca por coincidencia de nombre entre orígenes distintos, ni
    de forma retroactiva/heurística.
  - Un nombre no visto antes en un origen ya conocido, o un cambio de servidor físico detrás de un
    mismo origen configurado, generan por defecto una `identity` candidata **nueva** — nunca
    heredan automáticamente una `identity` ni una autorización existente.
  - Fusionar dos `identity` (reconocer un renombrado real) requiere una **acción declarativa
    explícita del usuario**, nunca una decisión automática del Registry.
  - Un cambio de `schema fingerprint` sobre una `identity` existente se **expone como evento
    observable**, nunca se absorbe silenciosamente — el Policy Engine (Fase 5) decide si requiere
    re-aprobación.
  - El Registry **nunca autoriza** — solo cataloga y expone estos hechos; la autorización es
    responsabilidad exclusiva del Policy Engine, lo que acota el daño máximo de cualquier error de
    resolución de identidad a una clasificación incorrecta, nunca a una ejecución no autorizada.
- Aprobado por: usuario (2026-09-16, vía respuesta directa, tras análisis explícito de 9 escenarios:
  tool propia de AgentForge, tool MCP nueva, reinicio de servidor, renombrado, cambio de schema,
  desaparición/reaparición temporal, sustitución de servidor, colisión de nombre entre servidores,
  y servidor comprometido suplantando una tool aprobada).
- Consecuencias: el Audit Log (Fase 10) y el Policy Engine (Fase 5) pueden referenciar una tool de
  forma fiable a través de renombrados legítimos sin perder trazabilidad. Namespacing por origen
  evita colisiones entre `packages/mcp-<nombre>` distintos (DEC-008). La no-herencia automática por
  defecto es la mitigación concreta contra confusión de tool / suplantación por servidor
  comprometido.

## DEC-017 — Ubicación del Tool Registry en el monorepo (Fase 3)

- Fecha: 2026-09-16
- Contexto: había que decidir si el Tool Registry justifica un paquete propio (`packages/registry`)
  o si debe vivir dentro de `packages/core`, comparando con la razón de ser real de la separación
  ya aprobada en DEC-008 (frontera de seguridad de DEC-004 entre Core y Secrets Broker).
- Opciones consideradas: (A) paquete propio `packages/registry` desde ahora; (B) módulo dentro de
  `packages/core`, con el modelo de datos compartido en `packages/shared`.
- Decisión: **(B)**. El Registry vive en `packages/core/src/registry/`; el modelo de datos
  compartido (`identity`, `qualified name`, `schema fingerprint`, tipos de tool) vive en
  `packages/shared`. No se crea `packages/registry`.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: no existe hoy ninguna razón de aislamiento de proceso/seguridad equivalente a la
  de DEC-004/DEC-008 que justifique un paquete separado — crearlo ahora sería sobrearquitectura
  organizativa sin beneficio real. Extraerlo más adelante (si alguna razón concreta apareciera,
  p. ej. Fase 9 — Sessions, o multiusuario futuro) queda barato porque el modelo de datos ya vive
  en `packages/shared` y el módulo tiene límites internos claros desde el principio.

## DEC-018 — Estrategia de reducción del Tool Discovery (Fase 4)

- Fecha: 2026-09-16
- Contexto: había que decidir cómo Tool Discovery reduce el catálogo completo del Registry a un
  subconjunto expuesto al agente, sin invadir responsabilidades de fases posteriores (uso/
  historial pertenece a Audit Log, Fase 10; relevancia semántica requeriría una dependencia nueva
  no justificada al tamaño actual del proyecto).
- Opciones consideradas: (A1) filtro estático por configuración; (A2) basada en uso/heurística
  (requiere telemetría inexistente hoy); (A3) relevancia semántica (embeddings); (A4) híbrida por
  capas con una estrategia base más una interfaz abierta a añadir otras.
- Decisión: **(A1) filtro estático por configuración**, con la interfaz interna diseñada como
  (A4) — abierta a añadir estrategias adicionales combinables más adelante sin rediseño. No se
  implementan A2 ni A3 en esta fase.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: Discovery no depende de que exista telemetría de uso (Fase 10) ni de una
  dependencia de embeddings. Queda documentado explícitamente como una limitación conocida y
  temporal, no como diseño final — añadir A2/A3 en el futuro es aditivo sobre la interfaz de
  estrategia, no un rediseño.

## DEC-019 — Configuración declarativa del Tool Discovery (Fase 4)

- Fecha: 2026-09-16
- Contexto: había que decidir si la configuración de qué tools se exponen reutiliza el mismo
  fichero de orígenes del Registry (DEC-014) o vive en un fichero propio, para no mezclar la
  responsabilidad de "qué orígenes existen" (Registry) con "qué se expone al agente" (Discovery).
- Opciones consideradas: (B1) reutilizar el fichero de configuración de orígenes de Registry,
  añadiendo un campo de activación; (B2) fichero de configuración propio y separado.
- Decisión: **(B2)**. Fichero de configuración propio de Discovery, en JSON (mismo formato que
  DEC-014), separado del fichero de orígenes del Registry.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: refuerza la frontera Registry/Discovery también a nivel de configuración, no solo
  de código. Establece el patrón de un fichero de configuración por responsabilidad, aplicable
  también cuando el Policy Engine (Fase 5) necesite el suyo.

## DEC-020 — Forma de salida del Tool Discovery (Fase 4)

- Fecha: 2026-09-16
- Contexto: había que decidir si Discovery expone `ToolEntry` completos (incluyendo `identity`
  interna y `schemaFingerprint`) o una proyección reducida, respetando que el agente es un
  componente potencialmente no confiable (DEC-003) y que `identity` se diseñó como opaca e interna
  (DEC-016).
- Opciones consideradas: (C1) devolver `ToolEntry` completo; (C2) proyección reducida propia
  (`DiscoveredToolView`), sin campos internos de identidad ni acoplada al formato MCP.
- Decisión: **(C2)**. Discovery expone una proyección reducida propia, no `ToolEntry` ni el
  formato `tools/list` de MCP directamente — misma razón de fondo que DEC-013 (no acoplar el
  dominio interno a un protocolo externo).
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: el agente nunca ve `identity` ni `schemaFingerprint` en bruto. El futuro adaptador
  MCP (Fase 8) se simplifica, porque solo traduce formato, sin decidir qué ocultar.

## DEC-021 — Tratamiento de entradas `stale` en Tool Discovery (Fase 4)

- Fecha: 2026-09-16
- Contexto: había que decidir si las entradas marcadas `stale` (DEC-016 — no vistas en el último
  descubrimiento del Registry) se excluyen automáticamente del resultado de Discovery o quedan a
  criterio de cada estrategia de reducción.
- Opciones consideradas: (D1) exclusión automática por defecto; (D2) inclusión, dejando la
  decisión a la estrategia de reducción.
- Decisión: **(D1)**. Las entradas `stale` se excluyen automáticamente del resultado de Discovery,
  sin que cada estrategia deba reimplementarlo.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: coherente con la semántica de `stale` ya aprobada en DEC-016 — mientras no se
  confirme que una tool sigue existiendo en su origen, no se ofrece al agente para uso.

## DEC-022 — Ubicación del Tool Discovery en el monorepo (Fase 4)

- Fecha: 2026-09-16
- Contexto: mismo razonamiento que DEC-017 para el Registry — evaluar si Tool Discovery justifica
  un paquete propio o debe vivir dentro de `packages/core`.
- Opciones consideradas: (A) paquete propio; (B) módulo dentro de `packages/core`.
- Decisión: **(B)**. Discovery vive en `packages/core/src/discovery/`, como módulo hermano de
  `packages/core/src/registry/`, consumiendo el modelo de `packages/shared`. No se crea paquete
  propio.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: mismas que DEC-017 — no existe hoy ninguna razón de aislamiento de
  proceso/seguridad que justifique un paquete separado; extraerlo después, si hiciera falta, queda
  barato por los límites de módulo ya claros.

## DEC-023 — Origen y clasificación de riesgo del Policy Engine (Fase 5)

- Fecha: 2026-09-16
- Contexto: el análisis inicial de Fase 5 mencionó un "metadato de riesgo" en `ToolEntry` sin
  especificar su origen, lo cual entraba en conflicto con el límite explícito de no modificar el
  modelo `ToolEntry`/`identity`/`schemaFingerprint` aprobado en DEC-013/DEC-016. El usuario pidió
  aclarar explícitamente de dónde procede la clasificación de riesgo antes de aprobar el conjunto.
- Opciones consideradas: (1) metadato de configuración propio del Policy Engine, separado de
  `ToolEntry`, indexado por `identity`; (2) declarado junto a la configuración de reglas (variante
  de formato de la opción 1, no alternativa arquitectónica distinta); (3) inferido
  automáticamente a partir del nombre/descripción/schema de la tool; (4) autodeclarado por el
  servidor MCP de origen.
- Decisión: **(1)**. Clasificación de riesgo de **tres niveles** (`read-only`,
  `reversible-write`, `destructive`), **declarada explícitamente por el usuario en configuración
  propia del Policy Engine** (no en `ToolEntry`), **indexada por `identity`** (nunca por
  `qualifiedName` a secas, mismo principio de DEC-016). Una `identity` sin clasificación explícita
  recibe por defecto el tratamiento más conservador: `requires-confirmation`. El Policy Engine
  **nunca** confía en autodeclaración del servidor MCP de origen ni en heurísticas de
  nombre/descripción/schema como fuente de verdad de riesgo.
- Aprobado por: usuario (2026-09-16, vía respuesta directa, tras análisis explícito de las 4
  alternativas y sus implicaciones de seguridad/mantenimiento/compatibilidad con DEC-013 a
  DEC-022).
- Consecuencias: `ToolEntry`, `identity` y `schemaFingerprint` (DEC-013/DEC-016) permanecen
  intactos — el Policy Engine los consume por lectura, nunca los modifica ni añade campos.
  Requiere que el usuario clasifique manualmente cada `identity` nueva; el valor conservador por
  defecto evita que una tool no clasificada quede accesible sin fricción.

## DEC-023b — Granularidad constante por `identity` de la clasificación de riesgo (Fase 5)

- Fecha: 2026-09-16
- Contexto: una misma tool puede tener impacto muy distinto según sus argumentos (p. ej.
  `delete_file(path="/tmp/x")` frente a `delete_file(path="/")`). Había que decidir si el riesgo se
  modula por invocación o se mantiene constante por `identity`, sin reabrir la decisión ya tomada
  en DEC-024 de no implementar un lenguaje de reglas expresivo.
- Opciones consideradas: (A2-1) riesgo base constante por `identity`, usando el peor caso
  razonable; (A2-2) override simple basado en coincidencia de argumentos; (A2-3) lenguaje de
  reglas expresivo completo (equivalente a la opción ya descartada en DEC-024).
- Decisión: **(A2-1)**. La clasificación de riesgo es **constante por `identity`** en esta fase —
  sin modulación automática por los argumentos de una invocación concreta. Cuando una tool pueda
  tener impactos distintos según sus argumentos, debe clasificarse según su **peor caso
  razonable**.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: **limitación documentada explícitamente**: el riesgo es una clasificación base
  por `identity`, no una clasificación por invocación. La modulación de riesgo según argumentos
  queda fuera de esta fase — no se reabre DEC-024 (sigue sin lenguaje de reglas expresivo ni
  condiciones sobre argumentos). Coherente con el resto de reglas conservadoras de la fase (DEC-023,
  DEC-026): ante ambigüedad, se prefiere fricción (confirmación/clasificación más estricta) a una
  heurística que podría clasificar mal un caso destructivo como seguro.

## DEC-024 — Motor de reglas del Policy Engine (Fase 5)

- Fecha: 2026-09-16
- Contexto: pregunta abierta heredada de Fase 1 (`ARCHITECTURE.md` §20, punto 4: "¿allowlists
  planas o algo más expresivo?"). Había que decidir el mecanismo que traduce la clasificación de
  riesgo (DEC-023) en una decisión de autorización.
- Opciones consideradas: (B1) allowlist plana por `identity`/`qualifiedName` como mecanismo
  primario; (B2) reglas derivadas de la clasificación de riesgo como mecanismo primario, con
  overrides tipo allowlist/denylist como capa adicional; (B3) lenguaje de reglas expresivo
  (condiciones sobre argumentos, patrones, etc.).
- Decisión: **(B2)**. Mecanismo primario: `read-only` → `allow` automático; `reversible-write` →
  `allow` (sujeto a que no exista un override de denegación); `destructive` →
  `requires-confirmation` por defecto. Capa adicional: overrides simples `allow`/`deny` por
  `identity`, sin condiciones sobre argumentos ni lenguaje de reglas expresivo.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: evita mantenimiento manual de una allowlist exhaustiva (B1 puro) sin la
  complejidad de un motor de reglas expresivo (B3, sin caso de uso demostrado todavía) — mismo
  principio de evitar complejidad prematura ya aplicado en DEC-014/DEC-018. Un futuro
  multiusuario/lenguaje de reglas más expresivo queda como evolución posible, no bloqueante ahora.

## DEC-025 — Forma del resultado de evaluación del Policy Engine (Fase 5)

- Fecha: 2026-09-16
- Contexto: había que definir el contrato de salida que consumirán la futura ejecución (Fase 7) y
  el futuro Audit Log (Fase 10), evitando tener que rediseñarlo una vez que ambas fases dependan de
  él.
- Opciones consideradas: (C1) resultado binario `allow`/`deny`; (C2) resultado ternario
  `allow`/`deny`/`requires-confirmation`, sin implementar el mecanismo de confirmación en sí; (C3)
  ternario + razón estructurada (regla aplicada, riesgo base evaluado, `identity`,
  `schemaFingerprint`).
- Decisión: **(C3)**. Resultado ternario con razón estructurada, incluyendo como mínimo: regla
  aplicada, riesgo base evaluado, `identity` evaluada, y `schemaFingerprint` evaluado.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: el Policy Engine no implementa el mecanismo de confirmación humana (sigue como
  pregunta abierta, `ARCHITECTURE.md` §20 punto 2) — solo produce la señal. La razón estructurada
  es directamente consumible por un futuro Audit Log sin rediseño del contrato.

## DEC-026 — Invalidación de aprobación ante cambio de `schemaFingerprint` (Fase 5)

- Fecha: 2026-09-16
- Contexto: DEC-016 dejó explícitamente pendiente para esta fase decidir qué ocurre cuando el
  `schemaFingerprint` de una `identity` cambia respecto al evaluado la última vez.
- Opciones consideradas: (D1) cualquier cambio de fingerprint invalida automáticamente cualquier
  aprobación previa; (D2) solo un cambio "incompatible" (heurística sobre el schema) invalida la
  aprobación; (D3) el cambio nunca invalida automáticamente, solo se notifica.
- Decisión: **(D1)**. Cualquier cambio de `schemaFingerprint` respecto al último evaluado para esa
  `identity` invalida automáticamente la aprobación previa — sin heurística de compatibilidad.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: cierra el vector de seguridad ya identificado en DEC-016 (caso 9: un servidor
  comprometido podría cambiar silenciosamente el contrato de una tool ya aprobada). Puede generar
  fricción tras actualizaciones benignas de un servidor MCP — aceptado como coste del
  comportamiento conservador por defecto.

## DEC-027 — Persistencia y auditoría del Policy Engine (Fase 5)

- Fecha: 2026-09-16
- Contexto: había que decidir si el Policy Engine debía anticipar el futuro Audit Log (Fase 10)
  persistiendo o emitiendo eventos de las decisiones que toma.
- Opciones consideradas: (E1) no registra nada, solo devuelve la decisión; (E2) escribe
  directamente a algún almacenamiento de auditoría, anticipando Fase 10; (E3) emite un
  evento/callback observable en memoria, sin persistencia.
- Decisión: **(E1)**. El Policy Engine no persiste ni emite eventos de auditoría — solo devuelve
  el resultado estructurado (DEC-025) a quien lo invoque.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: evita tomar de forma prematura y silenciosa decisiones de almacenamiento que
  pertenecen a Fase 10 (todavía pendiente, `ARCHITECTURE.md` §20 punto 7). El consumo del
  resultado (hacia Fase 7 o un futuro Fase 10) se decide en esas fases futuras.

## DEC-028 — Configuración declarativa del Policy Engine (Fase 5)

- Fecha: 2026-09-16
- Contexto: había que decidir si la clasificación de riesgo y los overrides viven en un fichero
  propio o reutilizan el de Discovery (DEC-019), aplicando el mismo principio de separación de
  responsabilidades por documento ya usado entre Registry (DEC-014) y Discovery (DEC-019).
- Opciones consideradas: (F1) fichero JSON propio para el Policy Engine; (F2) reutilizar el
  fichero de configuración de Discovery añadiendo campos de política.
- Decisión: **(F1)**. Fichero JSON propio y separado, en `packages/core/src/policy/`, distinto del
  de orígenes del Registry y del de Discovery.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: mantiene "qué existe" (Registry), "qué se expone" (Discovery) y "qué está
  autorizado" (Policy Engine) como responsabilidades documentalmente separadas, coherente con la
  frontera de DEC-015.

## DEC-029 — Ubicación del Policy Engine en el monorepo (Fase 5)

- Fecha: 2026-09-16
- Contexto: mismo razonamiento que DEC-017/DEC-022 — evaluar si el Policy Engine justifica un
  paquete propio o debe vivir dentro de `packages/core`.
- Opciones consideradas: (A) paquete propio; (B) módulo dentro de `packages/core`.
- Decisión: **(B)**. El Policy Engine vive en `packages/core/src/policy/`, sin paquete propio.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: mismas que DEC-017/DEC-022 — no existe hoy ninguna razón de aislamiento de
  proceso/seguridad que justifique un paquete separado.

## DEC-030 — Almacenamiento de secretos (Fase 6)

- Fecha: 2026-09-16
- Contexto: DEC-004 exige que el Secrets Broker sea un proceso separado con usuario de SO propio;
  DEC-010 fija el transporte IPC (named pipe/Unix socket). Faltaba decidir cómo persiste el
  Broker los secretos, evaluando explícitamente si el proyecto debe depender de un OS credential
  store (mencionado como pendiente en DEC-007/`DEVELOPMENT.md`) o de un mecanismo propio, sin
  asumir una solución.
- Opciones consideradas: (A) fichero cifrado propio (AES-256-GCM vía `node:crypto`, sin
  dependencia externa); (B) OS credential store / keychain (Windows Credential Manager, macOS
  Keychain, Linux Secret Service); (C) combinación (OS store solo para la clave maestra).
- Decisión: **(A) fichero cifrado propio**. Se descarta (B) como mecanismo de almacenamiento de
  secretos porque Linux Secret Service depende de una sesión de escritorio con keyring
  desbloqueado, indisponible en el escenario real de despliegue sin entorno gráfico (Debian de
  casa, VPS Contabo) ya previsto en el proyecto — (B) sería además tres implementaciones
  divergentes por SO, contrario a "avoid unnecessary complexity" y a la portabilidad que (A) da
  de forma uniforme en Windows/Linux/macOS.
- Aprobado por: usuario (2026-09-16, vía respuesta directa, tras análisis explícito de
  seguridad/portabilidad/dependencias/complejidad operativa de las 3 alternativas).
- Consecuencias: resuelve explícitamente la pregunta que `DEVELOPMENT.md`/`TECH-STACK-ANALYSIS.md`
  dejaban pendiente sobre el paquete de acceso a Windows Credential Manager — no se necesita
  ninguna dependencia nativa de keychain. El acceso al almacenamiento pasa siempre por una
  interfaz interna del Broker, dejando abierta (sin implementarla) una futura sustitución del
  backend (p. ej. HSM) si se justificara.

## DEC-031 — Modelo de secreto (Fase 6)

- Fecha: 2026-09-16
- Contexto: había que definir un modelo interno mínimo y extensible para los tipos de secreto
  identificados (API keys, tokens, credenciales usuario/contraseña, material SSH), sin
  sobrearquitectura de una clase por tipo ni un blob totalmente opaco.
- Opciones consideradas: clase TypeScript distinta por tipo de secreto; blob opaco sin
  estructura; `SecretRecord` con `kind` discriminador + `payload: Record<string,string>` de forma
  convencional por `kind` + `metadata`.
- Decisión: **`SecretRecord { id, kind, payload, metadata }`**, con `kind` ∈ `"api-key"` |
  `"token"` | `"credential"` | `"ssh-key"` | `"generic"`, y `payload` como diccionario de cadenas
  con forma esperada por `kind` (documentada, no forzada por tipos TS distintos).
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: añadir un `kind` nuevo es una convención de claves dentro de `payload`, no una
  migración de schema. Fase 7/8 consumirán esta forma directamente.

## DEC-032 — Clave maestra y bootstrap (Fase 6)

- Fecha: 2026-09-16
- Contexto: la seguridad de DEC-030 depende enteramente de cómo se protege la clave de cifrado.
  Había que decidir dónde vive, qué ocurre tras reinicios, y si requiere intervención humana.
- Opciones consideradas: (B1) derivada de una passphrase humana en cada arranque del Broker; (B2)
  almacenada en el OS credential store (solo la clave, no los secretos); (B3) fichero de clave
  separado, con permisos de SO restringidos al usuario del Broker (DEC-004), sin passphrase
  humana; (B4) B3 por defecto con opción futura de habilitar B1.
- Decisión: **(B3)**. Fichero de clave separado del fichero de secretos cifrados, con permisos de
  SO restringidos exclusivamente al usuario del Broker. Arranque desatendido: el Broker relee la
  clave al iniciar, sin intervención humana, tanto tras un reinicio del proceso como de la
  máquina. La pérdida de la clave es **irrecuperable por diseño** — no hay backdoor. (B1) queda
  explícitamente fuera de alcance de esta fase.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: coherente con "un solo desarrollador, evitar complejidad prematura". Determina un
  requisito operacional explícito de backup: la clave debe respaldarse por separado del fichero de
  secretos cifrados (ver `SECURITY.md`/documentación operacional), para que un único backup
  comprometido no contenga material suficiente para descifrar. (B1) queda como ampliación futura
  posible, no bloqueante.

## DEC-033 — API del Secrets Broker (Fase 6)

- Fecha: 2026-09-16
- Contexto: había que definir las operaciones mínimas justificadas, sin añadir funcionalidad
  especulativa.
- Opciones consideradas: conjunto mínimo (`get`/`create`/`update`/`delete`/`exists`) vs. conjunto
  ampliado con rotación automática y versionado histórico vs. conjunto mínimo +
  `listMetadata` (sin exponer valores).
- Decisión: **`get`, `create`, `update`, `delete`, `exists`, `listMetadata`**. Sin rotación
  automática ni versionado histórico — ninguna tiene caso de uso concreto en esta fase.
- Aprobado por: usuario (2026-09-16, vía respuesta directa).
- Consecuencias: Fase 7 consumirá `get`; una futura herramienta de administración consumiría
  `listMetadata`/`create`/`update`/`delete`. Ampliar la API más adelante es aditivo.

## DEC-034 — Identidad de secretos y control de acceso (Fase 6, revisada)

- Fecha: 2026-09-16
- Contexto: había que decidir cómo se identifican los secretos (sin reutilizar `ToolIdentity`,
  entidad conceptualmente distinta) y si el Broker debía aplicar algún control de acceso más
  granular que el aislamiento de proceso ya dado por DEC-004/DEC-010. Un primer análisis propuso
  un binding opcional `allowedOrigins` validado contra el `ToolOrigin`/`identity` que Core declara
  en la petición; el usuario señaló correctamente que, si Core está comprometido, no puede
  considerarse fiable un dato que el propio Core declara sobre sí mismo — ese binding sería una
  falsa sensación de least privilege, no protección real frente al modelo de amenaza de DEC-004.
- Opciones consideradas para el binding: (A1) sin binding en esta fase; (A2) binding contra
  `ToolIdentity` en vez de `ToolOrigin` (mismo defecto de fondo: sigue siendo autodeclarado por
  Core); (A3) evidencia de autorización verificable generada por Policy Engine — analizada y
  resuelta en DEC-036 (no implementable de forma que cierre la brecha, dado que Policy Engine
  corre en el mismo proceso que Core, DEC-029).
- Decisión: **identidad** — `SecretId` opaco, interno, generado por el Broker (mismo patrón que
  `ToolIdentity`, pero entidad distinta y no reutilizada), con `metadata.provider?` y
  `metadata.label` (nombre legible, mutable, no identidad). **Control de acceso** — **(A1) sin
  binding secreto↔origen/identity autodeclarado por Core en esta fase.** Se retira el
  `allowedOrigins` propuesto inicialmente. El control de acceso real en esta fase es el que ya da
  DEC-004 (aislamiento de proceso/usuario) + DEC-010 (canal IPC autenticado por SO) — no se añade
  ningún binding de aplicación adicional que dependa de datos autodeclarados por Core.
- Aprobado por: usuario (2026-09-16, vía respuesta directa, tras análisis explícito de las
  alternativas de binding y sus implicaciones de seguridad).
- Consecuencias: el Broker entrega cualquier secreto por `SecretId` a cualquier petición ya
  autenticada por el canal IPC (DEC-010) — sin capa adicional que pudiera aparentar más
  granularidad de la que realmente aporta. Ver DEC-036 para la limitación de seguridad
  relacionada, documentada explícitamente. Un futuro mecanismo de control de acceso más granular
  (si se justificara) requeriría resolver primero el problema de fondo señalado en DEC-036, no
  solo añadir un campo de configuración.

## DEC-035 — Ubicación del Secrets Broker en el monorepo (Fase 6)

- Fecha: 2026-09-16
- Contexto: a diferencia de Registry/Discovery/Policy Engine (DEC-017/DEC-022/DEC-029), el Secrets
  Broker ya tiene paquete propio decidido desde la Fase 2 (`packages/secrets-broker`, DEC-008),
  como consecuencia directa de DEC-004. No hay pregunta real de "paquete propio o módulo en core"
  que resolver aquí.
- Opciones consideradas: ninguna — se confirma la aplicación de DEC-008, no se reabre.
- Decisión: la implementación de la Fase 6 vive en `packages/secrets-broker/src/`, consumiendo el
  modelo compartido de `packages/shared`, mismo patrón que las fases anteriores.
- Aprobado por: usuario (2026-09-16, vía respuesta directa) — confirmación, no decisión nueva de
  fondo.
- Consecuencias: ninguna nueva — refuerza DEC-004/DEC-008 tal como ya estaban aprobados.

## DEC-036 — Evidencia de autorización entre Policy Engine y Secrets Broker (Fase 6)

- Fecha: 2026-09-16
- Contexto: se analizó si el Secrets Broker debía exigir una evidencia de autorización verificable
  (generada por Policy Engine) antes de entregar un secreto, en vez de confiar simplemente en que
  la petición llega por el canal IPC autenticado (DEC-010). Se determinó que, como Policy Engine
  vive dentro de `packages/core/src/policy/` — es decir, en el **mismo proceso y usuario de SO que
  Core** (DEC-029) —, ningún mecanismo de evidencia generado por Policy Engine puede protegerse de
  un Core comprometido: un atacante con control de Core podría invocar `evaluate()` directamente y
  obtener una autorización legítima y verdadera para cualquier `identity` que decida, sin
  necesidad de falsificar nada.
- Opciones consideradas: (a) implementar un mecanismo criptográfico de evidencia (firma/HMAC) que
  el Broker valida antes de entregar un secreto; (b) no implementar ningún mecanismo de evidencia
  en esta fase, documentando explícitamente la limitación de seguridad resultante.
- Decisión: **(b)**. El Secrets Broker no exige ni valida ninguna evidencia criptográfica de
  autorización en esta fase — confía en que toda petición que llega por el canal IPC autenticado
  por SO (DEC-010) proviene del código legítimo de Core.
- Aprobado por: usuario (2026-09-16, vía respuesta directa, con instrucción explícita de mantener
  documentada la limitación de seguridad identificada).
- Consecuencias — **limitación de seguridad documentada explícitamente**: con Policy Engine dentro
  del mismo proceso que Core, Policy Engine no puede actuar como una autoridad independiente frente
  a un Core comprometido. El Secrets Broker protege el almacenamiento e impide el acceso directo a
  los secretos fuera del proceso Broker (mediante DEC-004: aislamiento de proceso/usuario,
  impidiendo lectura directa del fichero cifrado y de la clave maestra desde Core), pero **no puede
  impedir que un Core comprometido obtenga secretos a través del flujo de autorización legítimo que
  ya tiene disponible** (invocar Policy Engine directamente, que es código legítimo compartiendo su
  proceso). Cerrar esa brecha de forma real exigiría separar Policy Engine de Core en un proceso
  distinto — una decisión arquitectónica mayor, explícitamente no propuesta ni decidida aquí, que
  quedaría para una futura fase de hardening (Fase 13) si se decide abordarla.

## DEC-037 — Modelo de comandos de Execution (Fase 7)

- Fecha: 2026-09-17
- Contexto: había que decidir si Execution acepta un comando SSH arbitrario construido por el
  agente/Core, o solo plantillas de comando predefinidas con parámetros tipados, dado que Core es
  un componente potencialmente no confiable (DEC-003) y ninguna capa anterior (Registry/Discovery/
  Policy Engine) inspecciona el *contenido* de un comando, solo la *identidad* de la tool.
- Opciones consideradas: (A1) comando fijo con parámetros tipados definidos en el `inputSchema` de
  Registry (DEC-013), sustituidos en una plantilla predefinida; (A2) cadena de comando arbitraria
  validada solo por Policy Engine; (A3) comandos predefinidos con un parámetro de "argumentos
  libres" poco restringido.
- Decisión: **(A1)**. Cada tool SSH declara una plantilla de comando fija; Execution nunca
  concatena texto libre del agente — solo sustituye valores ya validados en posiciones tipadas de
  su propia plantilla.
- Aprobado por: usuario (2026-09-17, vía respuesta directa).
- Consecuencias: descarta la inyección de comandos como superficie de ataque directa. El Audit Log
  (Fase 10) podrá registrar "se ejecutó la tool X con parámetros Y" de forma legible, no una
  cadena opaca. Coherente con DEC-023b (una tool que permitiera comando arbitrario tendría que
  clasificarse siempre `destructive`, señal de que el diseño estaría mal si es evitable).

## DEC-038 — Confirmación humana síncrona para operaciones `requires-confirmation` (Fase 7)

- Fecha: 2026-09-17
- Contexto: la pregunta abierta desde Fase 1 (`ARCHITECTURE.md` §20 punto 2) sobre el mecanismo de
  confirmación humana síncrona dejó de ser postergable en esta fase. Una primera propuesta (B2)
  sugería usar los hooks `PreToolUse` de Claude Code como canal de confirmación. Verificación
  técnica explícita contra la documentación oficial de Claude Code (`hooks-guide.md`, `hooks.md`,
  `permissions.md`) determinó que PreToolUse es síncrono de un solo disparo, sin mecanismo de
  pausa-y-reanudación con estado externo, y sin ningún token/señal verificable que Claude Code
  entregue a un proceso externo para distinguir una confirmación humana genuina de un simple
  `allow` — B2 fue descartada tras esta verificación.
- Opciones consideradas: (B1) bloquear el proceso Core esperando respuesta; (B2) hooks de Claude
  Code — **descartada tras verificación técnica**; (B3) interfaz de confirmación propia de
  AgentForge, gestionada directamente por Execution, fuera del espacio de confianza de Core.
- Decisión: **(B3)**. Execution implementa su propio mecanismo de confirmación síncrona, en su
  propio proceso/paquete (DEC-042), con las siguientes garantías obligatorias:
  1. La confirmación se vincula a un **hash determinista** de (`identity` + parámetros
     canonicalizados + host + `schemaFingerprint`) — nunca a la tool en abstracto.
  2. Es de **un solo uso**: no se persiste entre invocaciones (a diferencia de la aprobación de
     Policy Engine en DEC-026, que sí persiste por diseño); no puede reutilizarse para una
     operación con un hash distinto, incluida la misma tool con distintos parámetros/host.
  3. Lo que se muestra al operador procede de la **configuración propia de Execution** (plantilla
     de comando real de DEC-037, host real de DEC-039) — nunca una descripción de más alto nivel
     suministrada por Core.
  4. **Timeout** obligatorio con denegación por defecto; rechazo explícito distinguible de
     expiración por timeout.
  5. Ante cualquier ambigüedad, fallo, o ausencia de confirmación válida: **denegar**, nunca
     proceder.
  La lógica de seguridad (hash, un solo uso, timeout, rechazo por defecto) se implementa separada
  del mecanismo concreto de interacción, detrás de una interfaz `ConfirmationChannel`, con
  `ReadlineConfirmationChannel` como única implementación de esta fase — mismo patrón ya aplicado
  en DEC-010 (transporte agnóstico) y DEC-013 (modelo de dominio agnóstico de MCP). Esta separación
  es un detalle de implementación derivado del principio de diseño ya consistente del proyecto, no
  una decisión arquitectónica adicional.
- Aprobado por: usuario (2026-09-17, vía respuesta directa, tras verificación técnica explícita de
  los hooks de Claude Code y un análisis adicional de las garantías de vinculación/no-reutilización
  del mecanismo propio).
- Consecuencias — **limitaciones aceptadas explícitamente**: requiere un operador con acceso
  interactivo directo al proceso Execution en el momento de la operación; no proporciona aprobación
  remota/asíncrona en esta fase — en su ausencia, toda operación `requires-confirmation` se deniega
  por defecto (seguro, no necesariamente útil en despliegues sin sesión interactiva). **Limitación
  heredada, no resuelta por esta decisión** (ya documentada en DEC-036): Execution no puede
  verificar de forma criptográficamente independiente que el `PolicyDecision` recibido de Core es
  genuino — mitigado parcialmente por mostrar siempre al operador el comando/host reales desde la
  configuración propia de Execution, nunca una descripción que Core pudiera haber manipulado.

## DEC-039 — Configuración declarativa de hosts remotos (Fase 7)

- Fecha: 2026-09-17
- Contexto: había que decidir dónde vive la configuración de qué hosts remotos existen y qué
  usuario de conexión usa cada uno, aplicando el mismo principio de separación de responsabilidades
  ya usado en DEC-014/DEC-019/DEC-028 (Registry/Discovery/Policy Engine, cada uno con su propio
  fichero de configuración).
- Opciones consideradas: (C1) fichero JSON propio; (C2) reutilizar alguna configuración ya
  existente (Registry/Discovery/Policy).
- Decisión: **(C1)**. Fichero JSON propio para la configuración de hosts remotos (host, usuario de
  conexión, referencia al `SecretId` de la clave SSH correspondiente, DEC-031), separado de
  Registry/Discovery/Policy.
- Aprobado por: usuario (2026-09-17, vía respuesta directa).
- Consecuencias: mantiene el patrón ya establecido de "un fichero de configuración por
  responsabilidad" — sin excepción para Execution.

## DEC-040 — Límites y no exposición de stdout/stderr (Fase 7)

- Fecha: 2026-09-17
- Contexto: un comando remoto podría, por error o por diseño malicioso del lado remoto, volcar
  contenido sensible a stdout/stderr; sin control, eso se propagaría sin límite.
- Opciones consideradas: (D1) capturar todo sin límite; (D2) límite de tamaño (truncar) y nunca
  loguear el contenido capturado en ningún log propio de Execution, solo metadatos (exit code,
  tamaño, duración).
- Decisión: **(D2)**. Mismo principio ya aplicado en el Secrets Broker (DEC-030/§1: nunca loguear
  valores).
- Aprobado por: usuario (2026-09-17, vía respuesta directa).
- Consecuencias: acota el riesgo de fuga de datos sensibles a través de la salida de un comando
  remoto, incluso si el propio comando o el host remoto se comportan de forma inesperada.

## DEC-041 — Timeout y cancelación de conexión SSH (Fase 7)

- Fecha: 2026-09-17
- Contexto: sin timeout, un comando remoto colgado bloquearía Execution (y por extensión, la
  operación que depende de él) indefinidamente.
- Opciones consideradas: (E1) timeout configurable por tool/operación con cierre forzado de la
  conexión SSH al expirar; (E2) sin timeout, espera indefinida.
- Decisión: **(E1)**.
- Aprobado por: usuario (2026-09-17, vía respuesta directa).
- Consecuencias: riesgo operacional simple evitado; el timeout de confirmación (DEC-038, punto 4)
  y el timeout de conexión SSH son mecanismos distintos, cada uno con su propio plazo configurable.

## DEC-042 — Ubicación de Execution SSH en el monorepo (Fase 7)

- Fecha: 2026-09-17
- Contexto: a diferencia de Registry/Discovery/Policy Engine (DEC-017/DEC-022/DEC-029), DEC-008 ya
  reservó explícitamente el patrón de nombre `packages/execution-<nombre>` para backends de
  ejecución futuros, anticipando que podría haber varios (SSH ahora, quizá otros después).
- Opciones consideradas: (F1) paquete propio `packages/execution-ssh`; (F2) módulo dentro de
  `packages/core`.
- Decisión: **(F1)**. Aplicación directa del patrón ya reservado por DEC-008 — no una pregunta
  nueva de "paquete o módulo", a diferencia de las fases anteriores.
- Aprobado por: usuario (2026-09-17, vía respuesta directa).
- Consecuencias: coherente con "crecer por adición, no por reestructuración" (razón central de
  DEC-008). Aísla la dependencia externa nueva (`ssh2`) fuera de `packages/core`, que no la
  necesita directamente.

---

## PENDIENTE — decisiones abiertas que requieren autorización explícita del usuario

Estas no son decisiones — son la lista de puntos que necesitan decisión antes o durante la Fase 1.
Se listan aquí para que sean visibles y no se pierdan entre sesiones. Cuando una de ellas se
apruebe, debe moverse arriba como `DEC-XXX` con el formato correspondiente.

**Resueltas** (conservadas aquí solo como índice, con referencia a su decisión):
- ~~Relación con Claude Code~~ → DEC-003.
- ~~Modelo de amenaza del Secrets Broker~~ → DEC-004.
- ~~Estrategia MCP~~ → DEC-005.
- ~~Arquitectura de ejecución remota (fase 1)~~ → DEC-006.
- ~~Uso de GitHub~~ → DEC-001.
- ~~Identidad Git~~ → DEC-002.
- ~~Stack tecnológico~~ → DEC-007.
- ~~Estructura de repositorio (Fase 2)~~ → DEC-008.
- ~~Gestor de paquetes (Fase 2)~~ → DEC-009.
- ~~Mecanismo de IPC Core↔Secrets Broker (Fase 2)~~ → DEC-010.
- ~~Convenciones de código (Fase 2)~~ → DEC-011.
- ~~Creación del esqueleto de carpetas (Fase 2)~~ → DEC-012.
- ~~Modelo de datos del Tool Registry (Fase 3)~~ → DEC-013.
- ~~Almacenamiento del Tool Registry (Fase 3)~~ → DEC-014.
- ~~Alcance estático/dinámico del Tool Registry (Fase 3)~~ → DEC-015.
- ~~Identidad y versionado de una tool (Fase 3)~~ → DEC-016.
- ~~Ubicación del Tool Registry en el monorepo (Fase 3)~~ → DEC-017.
- ~~Estrategia de reducción del Tool Discovery (Fase 4)~~ → DEC-018.
- ~~Configuración declarativa del Tool Discovery (Fase 4)~~ → DEC-019.
- ~~Forma de salida del Tool Discovery (Fase 4)~~ → DEC-020.
- ~~Tratamiento de entradas stale en Tool Discovery (Fase 4)~~ → DEC-021.
- ~~Ubicación del Tool Discovery en el monorepo (Fase 4)~~ → DEC-022.
- ~~Origen y clasificación de riesgo del Policy Engine (Fase 5)~~ → DEC-023.
- ~~Granularidad constante por identity de la clasificación de riesgo (Fase 5)~~ → DEC-023b.
- ~~Motor de reglas del Policy Engine (Fase 5)~~ → DEC-024.
- ~~Forma del resultado de evaluación del Policy Engine (Fase 5)~~ → DEC-025.
- ~~Invalidación de aprobación ante cambio de schemaFingerprint (Fase 5)~~ → DEC-026.
- ~~Persistencia y auditoría del Policy Engine (Fase 5)~~ → DEC-027.
- ~~Configuración declarativa del Policy Engine (Fase 5)~~ → DEC-028.
- ~~Ubicación del Policy Engine en el monorepo (Fase 5)~~ → DEC-029.
- ~~Almacenamiento de secretos (Fase 6)~~ → DEC-030.
- ~~Modelo de secreto (Fase 6)~~ → DEC-031.
- ~~Clave maestra y bootstrap (Fase 6)~~ → DEC-032.
- ~~API del Secrets Broker (Fase 6)~~ → DEC-033.
- ~~Identidad de secretos y control de acceso (Fase 6)~~ → DEC-034.
- ~~Ubicación del Secrets Broker en el monorepo (Fase 6)~~ → DEC-035.
- ~~Evidencia de autorización entre Policy Engine y Secrets Broker (Fase 6)~~ → DEC-036.
- ~~Modelo de comandos de Execution (Fase 7)~~ → DEC-037.
- ~~Confirmación humana síncrona para operaciones requires-confirmation (Fase 7)~~ → DEC-038.
- ~~Configuración declarativa de hosts remotos (Fase 7)~~ → DEC-039.
- ~~Límites y no exposición de stdout/stderr (Fase 7)~~ → DEC-040.
- ~~Timeout y cancelación de conexión SSH (Fase 7)~~ → DEC-041.
- ~~Ubicación de Execution SSH en el monorepo (Fase 7)~~ → DEC-042.

**Genuinamente pendientes** (no bloqueantes para cerrar la Fase 1; trasladadas a considerar
durante la Fase 2 o cuando corresponda):

1. **Licencia del proyecto** — todavía no elegida. Ver `DEVELOPMENT.md`.
2. **Inconsistencia de idioma entre fases** — la documentación de la Fase 0 está en catalán; desde
   la Fase 0.5 el proyecto usa español/inglés. Pendiente decidir si en algún momento se traduce la
   investigación de la Fase 0, o si se mantiene como está permanentemente (ver `README.md`).
3. **Visibilidad del repositorio** `catlinux/AgentForge` (público/privado) — no confirmada
   explícitamente por el usuario, no asumida.
4. **Traducción al inglés de `architecture/TECH-STACK-ANALYSIS.md`** y
   **`architecture/CORE-STRUCTURE-ANALYSIS.md`** — pospuesta a propósito hasta que la
   documentación esté más estable (decisión del usuario, 2026-09-16).
5. Preguntas de detalle de implementación de la Fase 2 todavía no cubiertas por DEC-008 a DEC-012
   (framework HTTP concreto, formato del Tool Registry, paquete de acceso a Windows Credential
   Manager, empaquetado exacto del Secrets Broker, etc.), listadas en
   `architecture/ARCHITECTURE.md` §20 — no repetidas aquí para evitar una segunda fuente de verdad.
6. Implementación de la rama Linux/macOS del transporte IPC (DEC-010) — deliberadamente no
   implementada todavía; solo la interfaz agnóstica y la implementación Windows están previstas
   para cuando se cree el esqueleto.
