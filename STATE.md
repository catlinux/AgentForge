# STATE.md — AgentForge

**Última actualización:** 2026-09-16 (fin de la Fase 0.5)

## Proyecto

AgentForge: infraestructura modular propia para que agentes de IA (inicialmente Claude Code)
puedan usar herramientas, MCP, conectores, sistemas remotos, APIs, autenticación, permisos,
descubrimiento de herramientas, sesiones y automatizaciones de forma controlada, extensible y sin
dependencia obligatoria de un proveedor externo. Toma Composio como referencia (no como modelo a
copiar).

## Fase actual

**Fase 4 — Tool Discovery**

**Estado:** COMPLETADA (2026-09-16) — 5 decisiones aprobadas (DEC-018 a DEC-022: estrategia de
reducción estática por configuración, configuración declarativa propia, salida por proyección
reducida `DiscoveredToolView`, exclusión automática de `stale`, y ubicación dentro de
`packages/core`). Implementación completa con tests. Ver `decisions/DECISIONS.md` para el registro
formal.

**Implementación:** Tool Discovery funcional, de solo lectura sobre el Registry (Fase 3): modelo
`DiscoveredToolView` en `packages/shared/src/discovery/`; `DiscoveryConfig`/`loadDiscoveryConfig`,
`DiscoveryStrategy`/`StaticConfigDiscoveryStrategy`, y `discoverTools` (excluye `stale`, aplica
estrategia, proyecta a vista reducida) en `packages/core/src/discovery/`. Fase 3 (Tool Registry,
DEC-013 a DEC-017) sigue vigente y sin cambios — `ToolEntry` y el Registry no se han tocado.

**Investigación:** Fases 0, 0.7 completadas. Fase 0.5 (gobernanza) completada.

**Arquitectura:** BASE ARQUITECTÓNICA APROBADA (Fase 1: DEC-003 a DEC-007) + ESTRUCTURA NÚCLEO
APROBADA (Fase 2: DEC-008 a DEC-012) + TOOL REGISTRY APROBADO E IMPLEMENTADO (Fase 3: DEC-013 a
DEC-017) + TOOL DISCOVERY APROBADO E IMPLEMENTADO (Fase 4: DEC-018 a DEC-022). Resto documentado
como PROPOSAL/OPEN QUESTION en `architecture/ARCHITECTURE.md` §20.

## Microtarea actual

Fase 4 cerrada, pendiente de verificación final y de autorización de commit+push. Siguiente paso
tras el cierre: presentar el resumen de objetivos y decisiones a analizar de la Fase 5 (Policy
Engine) — sin implementar nada todavía.

## Trabajo completado

### Fase 0 — Technical Research & Bootstrap (completada, 2026-09-16)
- Investigación de Composio, MCP, Claude Code/VS Code/Agent SDK, y SSH/seguridad para agentes.
- Documentos: `docs/research/RESEARCH-REPORT.md`, `COMPOSIO-ANALYSIS.md`, `MCP-ANALYSIS.md`,
  `CLAUDE-CODE-ANALYSIS.md`, `SOURCES.md`; `research/SSH-SECURITY-NOTES.md`;
  `architecture/ARCHITECTURE-DRAFT.md` (propuesta, no aprobada); `decisions/DECISIONS.md` (creado).
- **Nota de idioma:** todos estos documentos de la Fase 0 están en **catalán**, idioma en el que se
  encargó originalmente esa fase.

### Fase 0.5 — Fundamentos del proyecto y gobernanza (completada, 2026-09-16)
- [x] Inspección del estado existente (Fase 0) antes de modificar nada.
- [x] `README.md` (español, principal) y `README.en.md` (inglés) — creados.
- [x] `CHANGELOG.md` — creado, con entradas reales de la Fase 0 y Fase 0.5 bajo `Unreleased`.
- [x] `ROADMAP.md` — creado, con las 16 fases propuestas (0–16) claramente marcadas como
      propuesta de planificación, no autorización.
- [x] `CONTRIBUTING.md` — creado.
- [x] `DEVELOPMENT.md` — creado, con stack tecnológico y licencia marcados `PENDIENTE DE DECISIÓN`.
- [x] `SECURITY.md` — creado, principios conceptuales de seguridad derivados de la Fase 0.
- [x] `.claude/CLAUDE.md` — creado, manual operativo conciso para Claude Code.
- [x] `.gitignore` — creado, cubre secretos/credenciales/claves SSH y stacks candidatos
      (Node/TypeScript, Python).
- [x] `decisions/DECISIONS.md` — actualizado con una lista explícita de "PENDIENTE — decisiones
      abiertas" (8 puntos), sin convertir ninguna propuesta en decisión.
- [x] `CODE_OF_CONDUCT.md` — **NO creado deliberadamente**: para un proyecto personal, todavía
      privado, sin colaboradores externos ni repositorio público, se ha considerado prematuro.
      Puede crearse más adelante si el proyecto se abre a contribuciones externas.
- [x] `LICENSE` — **NO creado deliberadamente**: no se ha inventado ninguna licencia; queda
      documentado como PENDIENTE DE DECISIÓN en `DEVELOPMENT.md`, `README.md` y
      `decisions/DECISIONS.md`.

### Fase 0.7 — Exploración de proyectos y funcionalidades relacionadas (completada, 2026-09-16)
- [x] Investigación ligera de 9 proyectos: Nango, Arcade, Windmill, IBM ContextForge, MCPX
      (Lunar.dev), Activepieces, GooSio (no verificable como proyecto real), Pipedream, Smithery.
- [x] `docs/es/research/RELATED-PROJECTS.md` — perfiles completos de los 7 proyectos principales,
      perfiles breves de Pipedream/Smithery, nota explícita sobre GooSio, matriz consolidada de
      funcionalidades, ideas candidatas agrupadas por área, notas de licencias.
- [x] `docs/en/research/RELATED-PROJECTS.md` — equivalente en inglés, mismo contenido.
- [x] Corrección documental menor: añadida una referencia cruzada breve en `README.md`/
      `README.en.md` apuntando al nuevo documento (no se ha modificado ni reescrito ninguna otra
      parte de la Fase 0 ni de la Fase 0.5).
- [x] Ninguna idea de esta fase se ha convertido en decisión — todas quedan explícitamente como
      candidatas pendientes de evaluación en la Fase 1.
- [x] Verificado: ningún código copiado de los proyectos estudiados; ninguna afirmación de
      funcionalidad de AgentForge que no exista; AgentForge no se presenta en ningún documento
      como alternativa/sustituto/evolución de Composio ni de ningún otro proyecto estudiado.

**Hallazgo metodológico relevante:** durante la investigación de "GooSio", las herramientas de
búsqueda/fetch generaron inicialmente información fabricada (dominio, paquete PyPI y repositorio
inexistentes) que fue detectada y descartada mediante verificación cruzada directa (API de GitHub,
DNS, registro de PyPI) antes de incluirse en ningún documento. No se incluyó ningún perfil de
GooSio — queda marcado como no verificable, sin inventar contenido.

### Fase 1 — Arquitectura y decisiones tecnológicas (en curso, iniciada y avanzada 2026-09-16)
- [x] Inspección del estado real del repositorio antes de trabajar (git log, listado de archivos)
      — coincide con lo documentado, sin contradicciones detectadas.
- [x] Evaluación de modelo/nivel de esfuerzo: adecuado para trabajo de síntesis arquitectónica, sin
      cambio.
- [x] Confirmadas con el usuario (vía AskUserQuestion) las 4 preguntas arquitectónicas que
      condicionaban en cascada el resto del diseño, antes de escribir la arquitectura completa.
- [x] **DEC-003** — Relación con Claude Code: extensión in-place (hooks + MCP propios).
- [x] **DEC-004** — Secrets Broker: proceso separado, usuario de SO propio.
- [x] **DEC-005** — Alcance MCP: Modern-only (espec `2026-07-28`).
- [x] **DEC-006** — Ejecución remota: claves SSH ed25519 dedicadas por host, sin CA SSH en fase 1.
- [x] `architecture/ARCHITECTURE.md` (español, principal) — base arquitectónica completa: 20
      secciones cubriendo arquitectura general, componentes, fronteras de confianza, flujo,
      Tool Registry, Tool Discovery, Policy Engine, Secrets, ejecución remota, MCP, sesiones,
      auditoría, storage, APIs, dashboard, seguridad, extensibilidad/i18n, dependencias
      tecnológicas, y qué implementa AgentForge vs. qué deja a Claude Code.
- [x] `architecture/ARCHITECTURE.en.md` — equivalente en inglés.
- [x] `architecture/ARCHITECTURE-DRAFT.md` — conservado sin reescribir, con una nota corta
      apuntando al nuevo documento (no se ha eliminado ni modificado su contenido original).
- [x] `decisions/DECISIONS.md` actualizado: DEC-003 a DEC-006 registradas; lista de PENDIENTE
      reducida a solo licencia del proyecto e inconsistencia de idioma.
- [x] `ROADMAP.md` y `README.md`/`README.en.md` actualizados con referencias cruzadas al nuevo
      documento de arquitectura.
- [x] **Stack tecnológico concreto** — `architecture/TECH-STACK-ANALYSIS.md` creado con análisis
      de TypeScript/Node.js, Python, Go, Rust y C#/.NET; **DEC-007 aprobada: TypeScript/Node.js**
      como stack único. `architecture/ARCHITECTURE.md`/`.en.md` §17 y `DEVELOPMENT.md`
      actualizados en consecuencia.
- [ ] Commit y push de los cambios de esta fase (incluye el stack tecnológico) — **pendiente de
      autorización explícita del usuario**.
- [x] Traducción al inglés de `architecture/TECH-STACK-ANALYSIS.md` — **pospuesta a propósito**
      por decisión explícita del usuario (2026-09-16), hasta que la documentación esté más
      estable. Registrado en `decisions/DECISIONS.md`, sección "PENDIENTE".
- [x] **Comprobación de consistencia final** antes de cerrar la fase (2026-09-16): revisadas
      `decisions/DECISIONS.md`, `architecture/ARCHITECTURE.md`, `STATE.md`, `ROADMAP.md`,
      `DEVELOPMENT.md`, `README.md`/`.en.md`. Se encontraron y corrigieron 3 inconsistencias:
      (1) `decisions/DECISIONS.md` tenía contenido duplicado heredado de la Fase 0.5 — los puntos
      "Uso de GitHub" e "Identidad Git" aparecían tachados como resueltos arriba pero repetidos
      íntegros más abajo sin tachar; limpiado en una única lista clara de pendientes reales;
      (2) `ROADMAP.md` seguía marcando el stack tecnológico como pendiente después de aprobarse
      DEC-007; corregido; (3) las secciones "Próximos pasos"/"Next steps" de
      `README.md`/`README.en.md` seguían describiendo la Fase 1 como "no iniciada"; actualizadas
      para reflejar su cierre y apuntar a la Fase 2. Verificado también: ningún secreto/credencial
      ni código funcional introducido (`grep` sobre todos los ficheros modificados/nuevos).

**Verificado antes de cerrar este bloque:** ningún componente funcional implementado (backend,
MCP server real, connectors, secrets broker, SSH executor, dashboard); AgentForge no se describe
en ningún documento como alternativa/sustituto/fork/evolución de Composio ni de ningún otro
proyecto estudiado; toda idea de investigación (Fase 0 y 0.7) que se cita en
`architecture/ARCHITECTURE.md` se marca explícitamente como PROPOSAL o inspiración, nunca como
decisión automática.

### Fase 2 — Arquitectura núcleo (en curso, iniciada 2026-09-16)
- [x] `architecture/CORE-STRUCTURE-ANALYSIS.md` creado: análisis de las 5 decisiones estructurales
      (estructura de repositorio, gestor de paquetes, IPC Core↔Secrets Broker, convenciones de
      código, y si crear ya el esqueleto), cada una con alternativas, ventajas/desventajas,
      dependencias entre decisiones, consecuencias de cambiarla después, y recomendación.
- [x] Ampliación de la Decisión 3 (IPC) a petición explícita del usuario: comportamiento en
      Windows, en Linux, diseño de una abstracción multiplataforma, impacto en la frontera de
      DEC-004, impacto de un futuro soporte de macOS, y revisión de alternativas más simples con
      seguridad equivalente (ninguna encontrada — TCP+token es más simple pero no equivalente en
      seguridad).
- [x] **DEC-008** — Estructura de repositorio: monorepo con workspaces (`packages/shared`,
      `packages/core`, `packages/secrets-broker`).
- [x] **DEC-009** — Gestor de paquetes: pnpm.
- [x] **DEC-010** — IPC Core↔Secrets Broker: named pipe+ACL (Windows) / Unix domain socket
      (Linux-macOS), interfaz agnóstica en `packages/shared`, selección por `process.platform`,
      rama Linux/macOS no implementada todavía.
- [x] **DEC-011** — Convenciones de código: TypeScript estricto, ESLint+Prettier, Vitest.
- [x] **DEC-012** — Esqueleto de carpetas: todavía NO se crea; queda como paso posterior
      explícitamente autorizado.
- [x] `decisions/DECISIONS.md` actualizado con DEC-008 a DEC-012 y la lista de PENDIENTE revisada.
- [x] `architecture/ARCHITECTURE.md`/`.en.md` §20 actualizado: la pregunta abierta sobre el
      mecanismo de IPC marcada como resuelta (DEC-010).
- [x] `ROADMAP.md` actualizado: Fase 2 marcada "En curso" con el resumen de las 5 decisiones.
- [x] Árbol de repositorio propuesto presentado y aprobado por el usuario en principio.
- [x] Dos observaciones del usuario resueltas antes de crear el esqueleto: (1) no crear
      subcarpetas para componentes futuros (Tool Registry, Policy Engine, hooks/MCP, Audit Log,
      Execution Backends) — se posponen a sus fases correspondientes, evita anticipar estructura
      sin decisión propia; (2) formato de ESLint decidido como `eslint.config.js` (flat config,
      estándar desde ESLint 9, compatible con Node 24 instalado) en vez de `.eslintrc.*` (legado) —
      detalle de formato, no una nueva decisión arquitectónica, resuelto sin nuevo DEC-XXX.
- [x] **Esqueleto mínimo creado** (sin funcionalidad, DEC-008 a DEC-012): raíz del monorepo
      (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`/`tsconfig.json`,
      `eslint.config.js`, `.prettierrc.json`/`.prettierignore`, `vitest.workspace.ts`); tres
      paquetes (`packages/shared`, `packages/core`, `packages/secrets-broker`) con `package.json`,
      `tsconfig.json` propios y un `src/index.ts` placeholder; `packages/shared/src/transport`
      contiene el contrato `SecretsBrokerTransport` agnóstico de SO (DEC-010, sin implementación);
      `packages/core/src/transport` y `packages/secrets-broker/src/transport` son placeholders
      vacíos para las futuras implementaciones Windows/Linux-macOS. Ningún componente futuro
      (Tool Registry, Policy Engine, Audit Log, etc.) tiene carpeta todavía.
- [x] Verificado: `pnpm install` correcto (152 paquetes, sin errores); `pnpm run typecheck`
      correcto en los 3 paquetes; `pnpm run lint` sin errores ni warnings; `pnpm run format`
      (Prettier `--check`) correcto, acotado a código fuente vía `.prettierignore` (no reformatea
      la documentación Markdown de fases anteriores); `pnpm run test` correcto (0 tests, exit 0
      vía `--passWithNoTests`, esperado en un esqueleto sin funcionalidad). Verificado también:
      `dist/`, `node_modules/`, `*.tsbuildinfo` correctamente ignorados por `.gitignore`
      (no aparecen en `git status`); grep de patrones de secretos/credenciales sobre todos los
      ficheros nuevos — ninguna coincidencia real (solo referencias legítimas al nombre
      "secrets-broker").
- [x] Commit y push de los cambios de esta fase — autorizados y ejecutados (ver "Último commit" /
      "Estado del push" más abajo).

### Fase 3 — Tool Registry (completada, 2026-09-16)
- [x] Análisis completo de las 5 decisiones (marco previo MCP-native/compatible/independiente +
      modelo de datos, almacenamiento con los 4 conceptos separados —fuente de verdad, caché,
      configuración declarativa, descubrimiento dinámico—, alcance con frontera Registry/
      Discovery/Policy Engine, identidad/versionado, ubicación en el monorepo).
- [x] Profundización adicional a petición del usuario: 9 escenarios de identidad analizados
      (tool propia de AgentForge, tool MCP nueva, reinicio de servidor, renombrado, cambio de
      schema, desaparición/reaparición, sustitución de servidor, colisión de nombre entre
      servidores, servidor comprometido suplantando una tool aprobada) — resultó en precisar
      DEC-016 con reglas explícitas de resolución por (origen+nombre) y no-herencia automática.
- [x] **DEC-013** — Modelo de datos: propio de AgentForge, MCP-compatible, adaptador en el borde.
- [x] **DEC-014** — Almacenamiento: configuración declarativa versionable + caché no autoritativa,
      sin SQLite.
- [x] **DEC-015** — Alcance: estático+dinámico, frontera Registry/Discovery/Policy Engine.
- [x] **DEC-016** — Identidad: `identity`/`qualified name`/`schema fingerprint`, reglas de
      resolución por (origen+nombre), no-herencia automática, fusión solo por acción humana
      explícita.
- [x] **DEC-017** — Ubicación: `packages/core/src/registry/`, modelo en `packages/shared`, sin
      `packages/registry` propio.
- [x] `decisions/DECISIONS.md`, `STATE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
      `architecture/ARCHITECTURE.md`/`.en.md` (§5 y §20) sincronizados con DEC-013 a DEC-017.
- [x] Dos detalles de implementación resueltos con el usuario antes de escribir código (no dados
      por decididos silenciosamente): generación de `identity` como UUID v4 aleatorio
      (`crypto.randomUUID()`); formato de fichero de configuración/caché como JSON (no YAML).
- [x] Implementación: `packages/shared/src/registry/` — `identity.ts` (tipos `ToolIdentity`,
      `QualifiedName`, `SchemaFingerprint`), `fingerprint.ts` (`computeSchemaFingerprint`,
      normalización determinista de JSON Schema), `tool.ts` (`ToolContract`, `ToolOrigin`,
      `ToolEntry`). `packages/core/src/registry/` — `store.ts` (interfaz `ToolRegistryStore`),
      `file-store.ts` (`FileToolRegistryStore`, caché JSON en disco), `resolve.ts`
      (`resolveDiscoveredTool`, aplica las reglas de DEC-016).
- [x] Tests (Vitest): 15 tests — 3 de `computeSchemaFingerprint` (determinismo); 8 de
      `resolveDiscoveredTool` cubriendo explícitamente los casos 2, 3, 4, 5, 7, 8, 9 del análisis
      de identidad, incluyendo un test específico de que un origen no puede suplantar la
      `identity` de otro origen (caso 9) y que `identity` nunca es derivable del nombre/origen; 4
      de `FileToolRegistryStore` (persistencia, caso 6 — stale sin borrado).
- [x] Alcance respetado: no se ha implementado Tool Discovery (Fase 4), Policy Engine (Fase 5),
      Secrets Broker funcional (Fase 6) ni ejecución real (Fase 7). No hay conexión real a
      servidores MCP todavía (Fase 8) — el adaptador MCP↔modelo propio de DEC-013 no se ha
      implementado, solo el modelo de datos que lo hará posible.
- [x] **Verificado:** `pnpm run typecheck` correcto en los 3 paquetes; `pnpm run lint` sin
      errores; `pnpm run format` correcto (Prettier `--check`, tras `--write` sobre 3 ficheros
      nuevos); `pnpm run test` — 15/15 tests correctos; `pnpm run build` correcto en los 3
      paquetes; `pnpm install --frozen-lockfile` correcto (ninguna dependencia nueva añadida —
      solo módulos nativos de Node `node:crypto`/`node:fs`/`node:path`); grep de patrones de
      secretos/credenciales sobre todo el código nuevo — sin coincidencias; `dist/`,
      `node_modules/`, `*.tsbuildinfo` correctamente ignorados, no aparecen en `git status`.

### Fase 4 — Tool Discovery (completada, 2026-09-16)
- [x] Análisis completo de la fase: objetivo/alcance, componentes que intervienen, arquitectura y
      flujo, 5 decisiones (estrategia de reducción, configuración declarativa, forma de salida,
      tratamiento de `stale`, ubicación en el monorepo) con alternativas/ventajas/desventajas/
      impacto en fases posteriores, límites explícitos de no-implementación, riesgos frente a
      DEC-013–017, y cambios de documentación/tests previstos — presentado en una única respuesta
      agrupada, sin preguntas individuales, según lo pedido.
- [x] **DEC-018** — Estrategia de reducción: filtro estático por configuración, interfaz abierta a
      estrategias adicionales (uso/historial, relevancia semántica) no implementadas todavía.
- [x] **DEC-019** — Configuración declarativa: fichero JSON propio, separado del de orígenes del
      Registry.
- [x] **DEC-020** — Salida: proyección reducida propia (`DiscoveredToolView`), sin `identity` ni
      `schemaFingerprint` internos, sin acoplamiento directo a MCP.
- [x] **DEC-021** — Exclusión automática de entradas `stale` (DEC-016) del resultado.
- [x] **DEC-022** — Ubicación: `packages/core/src/discovery/`, sin paquete propio (mismo
      razonamiento que DEC-017).
- [x] `decisions/DECISIONS.md`, `STATE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
      `architecture/ARCHITECTURE.md`/`.en.md` (§6 y §20) sincronizados con DEC-018 a DEC-022.
- [x] Implementación: `packages/shared/src/discovery/` — `view.ts` (`DiscoveredToolView`).
      `packages/core/src/discovery/` — `config.ts` (`DiscoveryConfig`, `loadDiscoveryConfig`),
      `strategy.ts` (interfaz `DiscoveryStrategy`), `static-strategy.ts`
      (`StaticConfigDiscoveryStrategy`), `discover.ts` (`discoverTools`: lee del
      `ToolRegistryStore`, excluye `stale`, aplica estrategia, proyecta a vista reducida).
- [x] Tests (Vitest): 7 nuevos — 5 de `discoverTools` (catálogo vacío, filtro activo/inactivo,
      exclusión de `stale` incluso si está activo en config, forma de la proyección de salida sin
      campos internos, no-mutación del store — Discovery es estrictamente de solo lectura); 2 de
      `loadDiscoveryConfig` (carga desde fichero, valor por defecto si falta el campo).
- [x] Alcance respetado: no se ha implementado Policy Engine (Fase 5), ejecución (Fase 7),
      Secrets Broker funcional (Fase 6), adaptador MCP real (Fase 8), ni telemetría/historial de
      uso. `ToolEntry` y el resto del Registry de Fase 3 quedan intactos, sin ninguna
      modificación (verificado por `git diff` vacío sobre esos ficheros).
- [x] **Verificado:** `pnpm run typecheck` correcto en los 3 paquetes; `pnpm run lint` sin
      errores; `pnpm run format` correcto sin necesidad de autofix; `pnpm run test` — 22/22 tests
      correctos (15 de Fase 3 + 7 nuevos de Fase 4); `pnpm run build` correcto; `pnpm install
      --frozen-lockfile` correcto (sin dependencias nuevas); grep de secretos sin coincidencias;
      `dist/`/`node_modules/`/`*.tsbuildinfo` correctamente ignorados; `git diff` confirma que
      Registry (Fase 3) no fue tocado.

## Documentación sincronizada

- `README.md` / `README.en.md`: contenido equivalente en ambos idiomas, verificado al redactarlos
  juntos (no traducción posterior).
- No se ha reorganizado `docs/research/` en una estructura `docs/es/`/`docs/en/` — esos documentos
  están en catalán (Fase 0) y moverlos sin traducirlos generaría una estructura de idioma
  engañosa. Se ha documentado esta decisión de no-reorganización en `README.md` en vez de
  ejecutarla silenciosamente.

## Contradicciones detectadas (documentadas, no resueltas unilateralmente)

1. **Idioma:** Fase 0 en catalán vs. convención de Fase 0.5 en adelante (español/inglés). Ver
   `README.md` y punto 8 de `decisions/DECISIONS.md`. Marcado **PENDIENTE**.

No se han detectado contradicciones de contenido técnico entre los documentos de la Fase 0.

## Decisiones aprobadas

- **DEC-001** — Usar GitHub. Repositorio ya creado por el usuario:
  `https://github.com/catlinux/AgentForge`. Visibilidad (público/privado) no confirmada
  explícitamente — no asumida.
- **DEC-002** — Identidad Git local (no global) para este repositorio: nombre `catlinux`, email
  `marc.catlinux@gmail.com`. Credenciales de acceso ya guardadas en el equipo según el usuario.
- **DEC-003** — Relación con Claude Code: extensión in-place (hooks + MCP propios), no wrap de CLI
  ni Agent SDK como producto separado.
- **DEC-004** — Secrets Broker: proceso separado del agente, con usuario y permisos propios del
  sistema operativo.
- **DEC-005** — Alcance MCP: Modern-only (especificación `2026-07-28`), sin soporte Dual-era.
- **DEC-006** — Ejecución remota: claves SSH ed25519 dedicadas por host (Debian casa, Contabo),
  sin CA SSH en la fase 1.
- **DEC-007** — Stack tecnológico: TypeScript/Node.js como stack único para todo AgentForge.
- **DEC-008** — Estructura de repositorio: monorepo con workspaces (`packages/shared`,
  `packages/core`, `packages/secrets-broker`).
- **DEC-009** — Gestor de paquetes: pnpm.
- **DEC-010** — IPC Core↔Secrets Broker: named pipe+ACL (Windows) / Unix domain socket
  (Linux-macOS), interfaz agnóstica en `packages/shared`, rama Linux/macOS no implementada todavía.
- **DEC-011** — Convenciones de código: TypeScript estricto, ESLint+Prettier, Vitest.
- **DEC-012** — Esqueleto de carpetas: todavía NO se crea, pendiente de paso posterior autorizado.
- **DEC-013** — Modelo de datos del Tool Registry: propio de AgentForge, MCP-compatible.
- **DEC-014** — Almacenamiento: configuración declarativa versionable + caché no autoritativa.
- **DEC-015** — Alcance: estático+dinámico, frontera Registry/Discovery/Policy Engine.
- **DEC-016** — Identidad: `identity`/`qualified name`/`schema fingerprint`, no-herencia
  automática.
- **DEC-017** — Ubicación: `packages/core/src/registry/`, sin paquete propio.
- **DEC-018** — Estrategia de reducción del Discovery: filtro estático por configuración.
- **DEC-019** — Configuración declarativa del Discovery: fichero JSON propio, separado del
  Registry.
- **DEC-020** — Salida del Discovery: proyección reducida `DiscoveredToolView`, sin campos
  internos.
- **DEC-021** — Exclusión automática de entradas `stale` en Discovery.
- **DEC-022** — Ubicación del Discovery: `packages/core/src/discovery/`, sin paquete propio.

Ver `decisions/DECISIONS.md` para el detalle completo de cada una.

## Propuestas (no decisiones)

La mayor parte de `architecture/ARCHITECTURE.md` sigue siendo PROPOSAL (marcado explícitamente
sección por sección). 5 decisiones están aprobadas (DEC-003 a DEC-007); todo lo demás (diseño del
Tool Registry, formato del Audit Log, lenguaje de reglas del Policy Engine, mecanismo de IPC,
framework HTTP concreto, etc.) sigue abierto. Ver `architecture/ARCHITECTURE.md` §20 para el
listado completo de preguntas abiertas.

## Decisiones pendientes

Lista completa y actualizada en `decisions/DECISIONS.md` (sección "PENDIENTE"). Resumen:
1. ~~Relación con Claude Code~~ — **resuelto, ver DEC-003**.
2. ~~Modelo de amenaza del Secrets Broker~~ — **resuelto, ver DEC-004**.
3. ~~Estrategia MCP~~ — **resuelto, ver DEC-005**.
4. ~~Arquitectura de ejecución remota (fase 1)~~ — **resuelto, ver DEC-006**.
5. Licencia del proyecto — todavía sin elegir.
6. ~~Uso de GitHub~~ — **resuelto, ver DEC-001**.
7. ~~Identidad Git~~ — **resuelto, ver DEC-002**.
8. Qué hacer con la inconsistencia de idioma Fase 0 (catalán) vs. resto del proyecto
   (español/inglés).
9. Visibilidad del repositorio `catlinux/AgentForge` (público/privado) — no confirmada
   explícitamente por el usuario, no asumida.
10. ~~Stack tecnológico concreto~~ — **resuelto, ver DEC-007**. Quedan detalles menores
    (framework HTTP, paquete de Credential Manager, empaquetado del Secrets Broker) pospuestos a
    la Fase 2.

## Bloqueadores

Ninguno técnico. El único bloqueador real es la falta de decisiones del usuario sobre los puntos
anteriores — necesarias antes de iniciar la Fase 1.

## Riesgos

- `LEGAL REVIEW REQUIRED` (heredado de la Fase 0): inconsistencia de licencia MIT/ISC en Composio
  — riesgo bajo, ya documentado, no bloqueante para AgentForge (no se reutiliza código de
  Composio).
- CVEs de seguridad de MCP citados en fuentes secundarias durante la Fase 0 — no verificados
  contra NVD/MITRE, no deben citarse como confirmados.
- Ninguna decisión de esta fase abre nuevos riesgos técnicos, al no haberse implementado software.

## Verificaciones realizadas en esta fase

- Se releyeron `STATE.md`, `decisions/DECISIONS.md` y la lista de archivos existentes antes de
  crear ningún documento nuevo (comando `find` + lectura de cabecera de `DECISIONS.md`).
- Se confirmó de nuevo que el directorio no es un repositorio Git (`git status` →
  "not a git repository").
- No se ha verificado ni tocado ningún sistema remoto (Debian casa, Contabo, GitHub, Dropbox).

## Archivos modificados/creados en esta fase (Fase 0.5)

```
README.md                  (nuevo)
README.en.md                (nuevo)
CHANGELOG.md                (nuevo)
ROADMAP.md                  (nuevo)
CONTRIBUTING.md              (nuevo)
DEVELOPMENT.md               (nuevo)
SECURITY.md                  (nuevo)
.gitignore                   (nuevo)
.claude/CLAUDE.md            (nuevo)
decisions/DECISIONS.md       (actualizado — añadida sección PENDIENTE)
STATE.md                     (actualizado — este archivo)
```

Ningún archivo de la Fase 0 (`docs/research/*`, `research/*`, `architecture/*`) ha sido modificado
ni eliminado en esta fase.

## Estado Git

- Repositorio: **inicializado** (`git init` ejecutado 2026-09-16, con autorización explícita del
  usuario).
- Identidad **local** del repositorio (no global, DEC-002): `catlinux <marc.catlinux@gmail.com>`.
- Identidad global de la máquina: `warcrafted-server <warcrafted.server@gmail.com>` — sigue sin
  tocarse; no afecta a este repositorio gracias a la identidad local configurada.
- Rama actual: `master`, sincronizada con `origin/master` (`up to date`, working tree clean).
- SSH verificado de forma no destructiva antes de cualquier cambio: alias `github-catlinux` →
  clave `~/.ssh/id_ed25519_catlinux`, autenticación confirmada como cuenta `catlinux`.

## Estado GitHub

- Repositorio remoto: `https://github.com/catlinux/AgentForge` (DEC-001), accedido vía SSH con el
  alias `github-catlinux` → `git@github-catlinux:catlinux/AgentForge.git`.
- Remote `origin` configurado y funcionando; rama `master` publicada y en tracking
  (`branch 'master' set up to track 'origin/master'`).
- Visibilidad (público/privado) todavía no confirmada explícitamente por el usuario — no asumida.

## Último commit

- Hash: `1399053f80f27729b2543c62b8bc42a5f8d6c38d` (corto: `1399053`)
- Autor: `catlinux <marc.catlinux@gmail.com>`
- Mensaje: `feat+docs: implementa el Tool Registry — Fase 3 (DEC-013 a DEC-017)`
- Contenido: 19 archivos, 813 inserciones/51 eliminaciones — modelo de datos del Registry en
  `packages/shared/src/registry/` (identity, fingerprint, tool); store + resolución de identidad
  en `packages/core/src/registry/` (store, file-store, resolve) con 15 tests; `DEVELOPMENT.md`,
  `ROADMAP.md`, `STATE.md`, `architecture/ARCHITECTURE.md`/`.en.md`, `decisions/DECISIONS.md`
  (actualizados con DEC-013 a DEC-017).
- Commits anteriores: `4e01064` (Fase 2), `2922629` (Fase 1), `d83da17` (Fase 0.7), `c671bef`
  (Fase 0 + Fase 0.5).

## Estado del push

- **Realizado** (2026-09-16, con autorización explícita del usuario). `master` sincronizado con
  `origin/master` (`1399053`), working tree limpio (verificado: `HEAD` y `origin/master` apuntan
  al mismo hash).

## Próxima acción recomendada

1. Pedir autorización explícita para el commit+push de los cambios de la Fase 4 (DEC-018 a
   DEC-022, implementación del Tool Discovery, documentación sincronizada).
2. Tras el commit/push, presentar únicamente el resumen de objetivos y decisiones a analizar de la
   Fase 5 (Policy Engine) — sin implementar nada de esa fase todavía.
3. Decisiones pendientes que siguen abiertas, no bloqueantes: licencia del proyecto, visibilidad
   del repositorio, inconsistencia de idioma Fase 0, traducción al inglés de
   `TECH-STACK-ANALYSIS.md` y `CORE-STRUCTURE-ANALYSIS.md`.

## Cómo reprender este trabajo

1. Lee este archivo (`STATE.md`) primero.
2. Lee `decisions/DECISIONS.md` — si contiene algún `DEC-XXX`, esa decisión ya está aprobada y
   debe respetarse.
3. Lee `README.md` para la visión general actual del proyecto.
4. Para el detalle técnico completo de la investigación, ver `docs/research/RESEARCH-REPORT.md` y
   `architecture/ARCHITECTURE-DRAFT.md` (en catalán).
5. No asumas que ha habido commits, push, o configuración de GitHub entre sesiones salvo que este
   archivo lo indique explícitamente.
