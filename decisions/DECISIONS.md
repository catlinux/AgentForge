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

**Genuinamente pendientes** (no bloqueantes para cerrar la Fase 1; trasladadas a considerar
durante la Fase 2 o cuando corresponda):

1. **Licencia del proyecto** — todavía no elegida. Ver `DEVELOPMENT.md`.
2. **Inconsistencia de idioma entre fases** — la documentación de la Fase 0 está en catalán; desde
   la Fase 0.5 el proyecto usa español/inglés. Pendiente decidir si en algún momento se traduce la
   investigación de la Fase 0, o si se mantiene como está permanentemente (ver `README.md`).
3. **Visibilidad del repositorio** `catlinux/AgentForge` (público/privado) — no confirmada
   explícitamente por el usuario, no asumida.
4. **Traducción al inglés de `architecture/TECH-STACK-ANALYSIS.md`** — pospuesta a propósito
   hasta que la documentación esté más estable (decisión del usuario, 2026-09-16).
5. Preguntas de detalle de implementación de la Fase 2, listadas en `architecture/ARCHITECTURE.md`
   §20 (framework HTTP concreto, formato del Tool Registry, mecanismo de IPC, etc.) — no repetidas
   aquí para evitar una segunda fuente de verdad; ver ese documento.
