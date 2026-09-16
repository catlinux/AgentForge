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
