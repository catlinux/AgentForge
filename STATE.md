# STATE.md — AgentForge

**Última actualización:** 2026-09-17 (Fase 12 — Dashboard Web, INSPECT+PLAN+EXECUTE+VERIFY
completados, pendiente de autorización de commit y push)

## Proyecto

AgentForge: infraestructura modular propia para que agentes de IA (inicialmente Claude Code)
puedan usar herramientas, MCP, conectores, sistemas remotos, APIs, autenticación, permisos,
descubrimiento de herramientas, sesiones y automatizaciones de forma controlada, extensible y sin
dependencia obligatoria de un proveedor externo. Toma Composio como referencia (no como modelo a
copiar).

## Fase actual

**Fase 12 — Dashboard Web**

**Estado:** INSPECT + PLAN + EXECUTE + VERIFY completados (2026-09-17) — 6 decisiones aprobadas
(DEC-064 a DEC-069: acceso a datos por lectura directa de fichero, sin API externa nueva ni
reabrir §14; bootstrap mínimo para que `startStdioServer`/`startExecutionServer`/
`startConnectorServer` construyan un `AuditWriter` real por defecto; Fastify como framework HTTP;
frontend HTML servido + JavaScript mínimo sin toolchain de build; sin autenticación, bind exclusivo
a `127.0.0.1`; convención `AGENTFORGE_DATA_DIR` extendida a las rutas de configuración de
Registry/Discovery/Policy). Durante EXECUTE se verificó, y se consultó explícitamente al usuario
antes de resolver, que ningún paquete tenía un `main`/CLI real que instanciara `AuditWriter` con
una ruta de fichero real, ni convención de ruta real para Registry/Discovery/Policy — solo se
usaban rutas de test en ambos casos, sin excepción. Ver `decisions/DECISIONS.md` para el registro
formal.

**Implementación:** paquete nuevo `packages/dashboard/` completo (servidor Fastify, 3 rutas GET de
solo lectura — `/api/audit`, `/api/tools/registry`, `/api/tools/discovery`, `/api/policy` —,
lectores que reutilizan `FileToolRegistryStore`/`discoverTools`/`loadPolicyConfig` ya existentes de
`packages/core`, frontend estático HTML/CSS/JS sin build); `packages/shared/src/paths/` nuevo
(`resolveAuditLogPath` movido desde `audit/`, más `resolveRegistryCachePath`/
`resolveDiscoveryConfigPath`/`resolvePolicyConfigPath`); `startStdioServer` (mcp-server),
`startExecutionServer` (execution-ssh), `startConnectorServer` (connector-github) ahora construyen
un `AuditWriter` por defecto si no se les inyecta uno explícitamente. **Ningún sistema remoto real
tocado** — el Dashboard se verificó con fixtures generadas a mano (no existe ninguna ejecución de
proceso real todavía en el proyecto, ver limitación abajo). Fases 3 a 11 siguen vigentes sin
cambios estructurales — solo el hueco de wiring de `AuditWriter` cerrado con un valor por defecto.

**Limitación heredada, documentada explícitamente (no introducida por esta fase):** ningún paquete
tiene todavía un `main`/CLI/`bin` real que arranque `mcp-server`/`execution-ssh`/
`connector-github` como proceso de producción — son funciones de librería (`createMcpServer`/
`startStdioServer`, `startExecutionServer`, `startConnectorServer`) con dependencias completamente
inyectadas. El Dashboard de esta fase, por tanto, no tiene hoy ningún dato real de una ejecución en
curso que mostrar — se verificó funcionalmente con ficheros de fixture generados a mano. Construir
ese bootstrap de producción es candidato a una fase futura, no de esta.

**Investigación:** Fases 0, 0.7 completadas. Fase 0.5 (gobernanza) completada.

**Arquitectura:** BASE ARQUITECTÓNICA APROBADA (Fase 1: DEC-003 a DEC-007) + ESTRUCTURA NÚCLEO
APROBADA (Fase 2: DEC-008 a DEC-012) + TOOL REGISTRY APROBADO E IMPLEMENTADO (Fase 3: DEC-013 a
DEC-017) + TOOL DISCOVERY APROBADO E IMPLEMENTADO (Fase 4: DEC-018 a DEC-022) + POLICY ENGINE
APROBADO E IMPLEMENTADO (Fase 5: DEC-023 a DEC-029) + SECRETS BROKER APROBADO E IMPLEMENTADO
(Fase 6: DEC-030 a DEC-036) + EJECUCIÓN REMOTA/SSH APROBADA E IMPLEMENTADA (Fase 7: DEC-037 a
DEC-042) + INTEGRACIÓN MCP APROBADA E IMPLEMENTADA (Fase 8: DEC-043 a DEC-047) + SESSIONS
APROBADAS E IMPLEMENTADAS (Fase 9: DEC-048 a DEC-051) + AUDIT LOG APROBADO E IMPLEMENTADO
(Fase 10: DEC-052 a DEC-057) + CONNECTORS APROBADO E IMPLEMENTADO (Fase 11: DEC-058 a DEC-063) +
DASHBOARD WEB APROBADO E IMPLEMENTADO (Fase 12: DEC-064 a DEC-069). Resto documentado como
PROPOSAL/OPEN QUESTION en `architecture/ARCHITECTURE.md` §20.

## Microtarea actual

Fase 12 con EXECUTE y VERIFY completos, pendiente de presentar el resultado de VERIFY al usuario
y de autorización explícita y separada de `git commit` y `git push` (todavía no solicitadas ni
concedidas para esta fase).

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

### Fase 5 — Permission / Policy Engine (completada, 2026-09-16)
- [x] Análisis completo de la fase presentado en una única respuesta agrupada (objetivo/alcance,
      relación con Registry/Discovery, flujo de evaluación, 7 decisiones con
      alternativas/ventajas/desventajas/impacto, límites explícitos, riesgos, cambios de
      documentación/tests) — sin preguntas individuales, según lo pedido.
- [x] Aclaración adicional a petición del usuario antes de aprobar: de dónde procede exactamente
      la clasificación de riesgo (4 alternativas analizadas: configuración propia del Policy
      Engine, variante de fichero único, inferencia automática —descartada—, autodeclaración del
      servidor MCP —descartada—) y cómo se determina el riesgo cuando una misma tool tiene
      distinto impacto según argumentos (nueva decisión DEC-023b: constante por `identity`, peor
      caso razonable, sin modular por argumento).
- [x] **DEC-023** — Origen del riesgo: 3 niveles (`read-only`/`reversible-write`/`destructive`),
      declarados explícitamente por el usuario en configuración propia del Policy Engine, por
      `identity` — nunca en `ToolEntry`, nunca inferido ni autodeclarado. Sin clasificar →
      `requires-confirmation` por defecto.
- [x] **DEC-023b** — Granularidad constante por `identity`, peor caso razonable; modulación por
      argumento fuera de esta fase (documentado explícitamente como limitación conocida).
- [x] **DEC-024** — Motor de reglas: derivado del riesgo, con overrides simples `allow`/`deny` por
      `identity` — sin lenguaje de reglas expresivo.
- [x] **DEC-025** — Resultado ternario (`allow`/`deny`/`requires-confirmation`) con razón
      estructurada (regla aplicada, riesgo base, `identity`, `schemaFingerprint`).
- [x] **DEC-026** — Invalidación automática de aprobación ante cualquier cambio de
      `schemaFingerprint`, sin heurística de compatibilidad.
- [x] **DEC-027** — Sin persistencia ni eventos de auditoría propios del Policy Engine.
- [x] **DEC-028** — Configuración declarativa en fichero JSON propio, separado de Registry y
      Discovery.
- [x] **DEC-029** — Ubicación: `packages/core/src/policy/`, sin paquete propio.
- [x] Detalle de implementación resuelto con el usuario antes de escribir código (no decidido
      silenciosamente): el registro mínimo de "último `schemaFingerprint` aprobado por `identity`"
      necesario para DEC-026 vive **solo en memoria** (`InMemoryPolicyApprovalStore`), no persiste
      entre reinicios — coherente al pie de la letra con DEC-027; tras un reinicio del proceso
      Core, toda `identity` vuelve a requerir confirmación la primera vez (fricción aceptada, no
      inseguridad).
- [x] `decisions/DECISIONS.md`, `STATE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
      `architecture/ARCHITECTURE.md`/`.en.md` (§7 y §20) sincronizados con DEC-023 a DEC-029,
      incluyendo la corrección explícita de que la clasificación de riesgo NO vive en el Tool
      Registry (contradiciendo una PROPOSAL heredada de Fase 1 que sí lo sugería).
- [x] Implementación: `packages/shared/src/policy/` — `risk.ts` (`RiskLevel`), `decision.ts`
      (`PolicyVerdict`, `PolicyRuleApplied`, `PolicyDecision`). `packages/core/src/policy/` —
      `config.ts` (`PolicyConfig`, `loadPolicyConfig`), `approval-store.ts`
      (`PolicyApprovalStore`, `InMemoryPolicyApprovalStore`), `evaluate.ts` (`evaluate`: aplica
      invalidación por fingerprint → overrides → riesgo por defecto, en ese orden).
- [x] Tests (Vitest): 17 nuevos — 11 de `evaluate` (DEC-023 no clasificado, DEC-024 los 3 niveles
      de riesgo y ambos overrides, DEC-023b constancia por `identity`, DEC-026 invalidación por
      cambio de fingerprint y no-invalidación en primera evaluación, DEC-025 forma del resultado,
      no-mutación de `ToolEntry`); 2 de `loadPolicyConfig`; 3 de `InMemoryPolicyApprovalStore`
      (incluye no-persistencia entre instancias, confirmando DEC-027); 1 test explícito de
      independencia del Policy Engine respecto a Discovery (una `identity` ausente de la lista
      activa de Discovery se evalúa igual).
- [x] Alcance respetado: no se ejecutan tools, no se implementa mecanismo de confirmación humana,
      Secrets Broker funcional, Audit Log persistente, Sessions, ni adaptador MCP real. `ToolEntry`,
      `identity`, `schemaFingerprint` (DEC-013/DEC-016) y los módulos de Registry/Discovery quedan
      intactos (verificado por `git diff` vacío sobre esos ficheros).
- [x] **Verificado:** `pnpm run typecheck` correcto en los 3 paquetes (tras corregir un error de
      indexación por branded type `ToolIdentity` en un test, tipado, no lógica); `pnpm run lint`
      sin errores; `pnpm run format` correcto (tras `--write` sobre 1 fichero de test); `pnpm run
      test` — 39/39 tests correctos (17 nuevos + 22 previos); `pnpm run build` correcto; `pnpm
      install --frozen-lockfile` correcto (sin dependencias nuevas); grep de secretos sin
      coincidencias; `dist/`/`node_modules/`/`*.tsbuildinfo` correctamente ignorados; `git diff`
      confirma que Registry y Discovery no fueron tocados.

### Fase 6 — Secrets Broker (completada, 2026-09-16)
- [x] Análisis completo de la fase presentado en una única respuesta agrupada (13 puntos:
      objetivo/responsabilidad, modelo de secretos, almacenamiento, clave maestra/bootstrap, IPC y
      autenticación del cliente, API, identidad, least privilege, relación con Policy Engine,
      relación con MCP/conectores futuros, threat model, backups/recuperación, decisiones
      propuestas) — sin preguntas individuales, según lo pedido.
- [x] Profundización adicional a petición del usuario, en dos puntos concretos, antes de aprobar:
      (1) `allowedOrigins` autodeclarado por Core no protege frente a un Core comprometido (mismo
      modelo de amenaza de DEC-004) — es falsa sensación de least privilege, se retira; (2)
      evidencia de autorización entre Policy Engine y Secrets Broker: como Policy Engine vive en
      el mismo proceso que Core (DEC-029), ningún mecanismo criptográfico generado por Policy
      Engine puede protegerse de un Core comprometido que invoque `evaluate()` legítimamente — no
      se implementa, con la limitación de seguridad documentada explícitamente en DECISIONS.md,
      ARCHITECTURE.md §8 y DEVELOPMENT.md.
- [x] **DEC-030** — Almacenamiento: fichero cifrado propio (AES-256-GCM), no OS credential store
      — Linux Secret Service inviable en despliegue headless (Debian casa, VPS Contabo).
- [x] **DEC-031** — Modelo: `SecretRecord { id, kind, payload, metadata }`, 5 kinds.
- [x] **DEC-032** — Clave maestra: fichero separado, permisos de SO, arranque desatendido, pérdida
      irrecuperable por diseño.
- [x] **DEC-033** — API: `get`/`create`/`update`/`delete`/`exists`/`listMetadata`, sin rotación
      automática ni versionado histórico.
- [x] **DEC-034 (revisada)** — `SecretId` propio (no reutiliza `ToolIdentity`); sin binding
      `allowedOrigins` autodeclarado por Core.
- [x] **DEC-035** — Ubicación: `packages/secrets-broker/src/` (confirmación de DEC-008/DEC-004,
      no decisión nueva de fondo).
- [x] **DEC-036** — Sin evidencia criptográfica de autorización Policy Engine↔Secrets Broker en
      esta fase; limitación de seguridad documentada.
- [x] `decisions/DECISIONS.md`, `STATE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
      `architecture/ARCHITECTURE.md`/`.en.md` (§8 y §20) sincronizados con DEC-030 a DEC-036,
      incluyendo la corrección explícita de que el almacenamiento NO depende de Windows Credential
      Manager (contradiciendo una PROPOSAL heredada de Fase 1 que sí lo asumía).
- [x] Decisión de alcance resuelta con el usuario antes de escribir código de transporte (no
      decidida silenciosamente): el transporte IPC real (named pipe/Unix socket, DEC-010) queda
      **fuera del alcance de esta fase** — se implementa el store/API del Broker; el placeholder
      de `packages/secrets-broker/src/transport/` permanece sin cambios, a implementar cuando
      Core↔Broker se conecten de verdad.
- [x] Implementación: `packages/shared/src/secrets/` — `identity.ts` (`SecretId`), `record.ts`
      (`SecretKind`, `SecretRecord`, `SecretMetadata`, `SecretMetadataView`), `api.ts`
      (`SecretsBrokerOperation`, `SecretsBrokerResult`). `packages/secrets-broker/src/storage/` —
      `crypto.ts` (AES-256-GCM, IV fresco por operación, tag separado del ciphertext),
      `master-key.ts` (`MasterKeyStore`, permisos 0o600, `assertRestrictivePermissions`),
      `secret-store.ts` (`SecretStore`, fichero cifrado, manejo explícito de corrupción).
      `packages/secrets-broker/src/ipc/` — `handle-operation.ts` (`handleOperation`: valida
      entradas, nunca filtra detalle en errores, sin binding, sin evidencia — desacoplado de
      cualquier transporte concreto).
- [x] Tests (Vitest): 29 nuevos — 6 de `crypto` (round-trip, IV nunca reutilizado, tag separado,
      detección de manipulación, error sin fuga de plaintext, rechazo de clave de longitud
      incorrecta); 5 de `MasterKeyStore` (creación/persistencia, reutilización, fichero corrupto,
      2 de permisos POSIX con `skipIf` en Windows); 10 de `SecretStore` (CRUD completo, el fichero
      en disco nunca contiene el valor en claro, `listMetadata` nunca incluye `payload`, fichero
      corrupto, clave incorrecta falla explícitamente); 10 de `handleOperation` (validación de
      entradas, ronda completa create→get, `exists`, `list-metadata` sin fuga, error interno
      degradado a mensaje genérico sin detalles internos, test explícito de que no existe ningún
      campo tipo `allowedOrigins` en el contrato — DEC-034).
- [x] Alcance respetado: no se ejecutan tools, no hay adaptador MCP real, no hay Sessions, no hay
      Audit Log persistente, no hay Policy Engine nuevo/separado, no se implementó el transporte
      IPC real (por decisión explícita del usuario). `ToolEntry`/Registry/Discovery/Policy Engine
      quedan intactos (verificado por `git diff` vacío sobre esos ficheros).
- [x] **Verificado:** `pnpm run typecheck` correcto en los 3 paquetes; `pnpm run lint` sin
      errores; `pnpm run format` correcto (tras `--write` sobre 2 ficheros, más una corrección de
      una aserción de test incorrecta, no de la lógica); `pnpm run test` — 68/68 tests correctos
      (2 tests de permisos POSIX omitidos correctamente en Windows) (29 nuevos + 39 previos);
      `pnpm run build` correcto; `pnpm install --frozen-lockfile` correcto (sin dependencias
      nuevas — solo `node:crypto`/`node:fs`/`node:path`/`node:os`); grep de secretos hardcodeados
      sin coincidencias; grep de `console.*` en todo el módulo del Broker sin coincidencias
      (cero logging, coherente con DEC-027/§1); `dist/`/`node_modules/`/`*.tsbuildinfo`
      correctamente ignorados; `git diff` confirma que Registry, Discovery, Policy Engine y el
      placeholder de transporte no fueron tocados.

### Fase 7 — Ejecución remota / SSH (completada, 2026-09-17)
- [x] Análisis completo de la fase presentado en una única respuesta agrupada (objetivo/alcance,
      relación con fases anteriores, arquitectura/flujo, 6 decisiones con
      alternativas/ventajas/desventajas/impacto, límites explícitos, riesgos, tests previstos) —
      sin preguntas individuales, según lo pedido, siguiendo protocolo INSPECT→PLAN→EXECUTE→
      VERIFY→DOCUMENT.
- [x] Verificación técnica explícita de los hooks de Claude Code (`PreToolUse`) contra
      documentación oficial (`hooks-guide.md`, `hooks.md`, `permissions.md`) antes de aprobar
      DEC-038: confirmado que son síncronos de un solo disparo, sin pausa-y-reanudación con estado
      externo, y sin señal verificable de aprobación humana hacia procesos externos — B2 (hooks)
      descartada, reemplazada por B3 (interfaz propia de Execution).
- [x] Profundización adicional a petición del usuario sobre las garantías concretas de B3 antes de
      aprobar: vinculación por hash determinista, no-reutilización, qué puede/no puede confiarse
      de un Core comprometido, timeout/cancelación/rechazo por defecto, problemas prácticos con
      modos no interactivos de Claude Code, y si posponer `requires-confirmation` sería preferible
      (se concluyó que no, con la limitación de "operador presente" documentada explícitamente).
- [x] Ajuste de diseño acordado antes de EXECUTE (no nueva decisión arquitectónica): separación de
      la lógica de seguridad de DEC-038 (hash, un solo uso, timeout, rechazo por defecto) del
      mecanismo concreto de interacción, mediante la interfaz `ConfirmationChannel` con
      `ReadlineConfirmationChannel` como única implementación de esta fase — mismo patrón ya
      aplicado en DEC-010 y DEC-013.
- [x] **DEC-037** — Comandos: plantilla fija por tool con parámetros tipados, nunca shell
      arbitraria ni argumentos libres.
- [x] **DEC-038** — Confirmación humana síncrona propia de Execution: hash determinista
      (identity+parámetros+host+schemaFingerprint), un solo uso, timeout, rechazo por defecto,
      comando/host reales mostrados desde la configuración propia de Execution.
- [x] **DEC-039** — Configuración de hosts remotos en fichero JSON propio.
- [x] **DEC-040** — Límites de tamaño en stdout/stderr, nunca logueados en claro.
- [x] **DEC-041** — Timeout de conexión SSH configurable, cierre forzado al expirar.
- [x] **DEC-042** — Ubicación: `packages/execution-ssh`, paquete propio (patrón ya reservado por
      DEC-008).
- [x] `decisions/DECISIONS.md`, `STATE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
      `architecture/ARCHITECTURE.md`/`.en.md` (§9 y §20) sincronizados con DEC-037 a DEC-042,
      incluyendo la resolución explícita de la pregunta abierta de Fase 1 sobre el mecanismo de
      confirmación humana.
- [x] Implementación: `packages/shared/src/execution/` — `request.ts` (`ExecutionRequest`),
      `result.ts` (`ExecutionOutcome`). `packages/execution-ssh/src/` — `config/` (plantillas de
      comando, configuración de hosts), `confirmation/` (hash de operación, interfaz
      `ConfirmationChannel`, implementación `readline`, lógica de confirmación con las 5
      garantías), `ssh/` (cliente `ssh2` con timeout, truncado de salida), `execute.ts`
      (orquestador: deny→rechaza, requires-confirmation→confirma primero, allow→ejecuta).
- [x] Nueva dependencia de producción: `ssh2` (primera dependencia externa de producción del
      proyecto), ya identificada como candidata verificada en `TECH-STACK-ANALYSIS.md` (Fase 1) —
      no es una decisión nueva, aplicación de investigación ya hecha. El binding nativo de cifrado
      opcional de `ssh2` no compiló en esta máquina Windows (falta de toolchain ClangCL) — `ssh2`
      lo trata como opcional y cae a implementación JS pura; verificado que el paquete carga y
      funciona correctamente.
- [x] Tests (Vitest): 28 nuevos — 5 de `computeOperationHash` (determinismo, diferencia ante
      cambio de cualquier elemento de la tupla); 6 de `confirmOperation` (aprobación, un solo uso,
      operación distinta no bloqueada por aprobación previa, rechazo, timeout, comando/host reales
      mostrados al canal); 5 de `resolveCommandTemplate` (sustitución tipada, parámetro faltante,
      parámetro inesperado, **2 tests explícitos de no-inyección** con metacaracteres de shell y
      backticks/sustitución de comandos, verificando que nunca se interpretan como sintaxis de
      shell); 8 de `execute` (los 3 verdicts de Policy Engine, host desconocido, plantilla
      faltante, parámetros no válidos — todos con SSH mockeado, nunca contra host real); 4 de
      `truncateOutput`.
- [x] Alcance respetado: **ningún sistema remoto real (Debian de casa, VPS Contabo) fue tocado en
      ningún momento** — verificado explícitamente por grep (sin referencias a hosts reales del
      proyecto) y porque todos los tests de SSH usan mocks. No se implementó Audit Log
      persistente, Sessions, ni adaptador MCP real. No se reabrió DEC-003, DEC-006, DEC-029,
      DEC-031 ni DEC-036.
- [x] **Verificado:** `pnpm run typecheck` correcto en los 4 paquetes (tras corregir un error de
      `exactOptionalPropertyTypes` en la construcción del objeto de conexión SSH — tipado, no
      lógica); `pnpm run lint` sin errores; `pnpm run format` correcto (tras `--write` sobre 7
      ficheros nuevos); `pnpm run test` — 96/98 tests correctos (2 tests de permisos POSIX
      omitidos correctamente en Windows, mismos ya existentes de Fase 6) (28 nuevos + 68 previos),
      tras corregir un fallo de aislamiento entre tests (mock no reseteado entre casos, no un
      fallo de la lógica de negocio); `pnpm run build` correcto en los 4 paquetes; `pnpm install
      --frozen-lockfile` correcto; grep de secretos hardcodeados sin coincidencias (salvo una
      clave SSH ficticia explícitamente marcada como dato de test); grep de `console.*` en todo
      `packages/execution-ssh` sin coincidencias reales (cero logging, coherente con DEC-040);
      `dist/`/`node_modules/`/`*.tsbuildinfo` correctamente ignorados; `git diff` confirma que
      Registry, Discovery, Policy Engine y Secrets Broker no fueron tocados.
- [x] **Revisión de seguridad final** (2026-09-17, a petición explícita del usuario, antes de
      autorizar commit): encontrado y corregido un fallo real de implementación — `client.ts`
      construía el comando SSH remoto con `argv.join(" ")`, reconstruyendo una cadena de shell a
      partir del array ya resuelto por `resolveCommandTemplate`; como `ssh2.exec()` envía esa
      cadena al shell del servidor remoto (no hay modo "argv literal" en el protocolo SSH
      `exec`), un valor de parámetro con metacaracteres de shell (`;`, `&&`, backticks, `$()`)
      habría vuelto a interpretarse en el host remoto, violando DEC-037 pese a que
      `resolveCommandTemplate` funcionaba correctamente en memoria. No detectado antes porque
      `execute.test.ts` mockea `executeOverSsh` por completo. **Corrección** (dentro de DEC-037,
      sin modificar ninguna decisión aprobada): nuevo módulo
      `packages/execution-ssh/src/ssh/shell-quote.ts` (`quoteShellArg`/`buildShellCommand`, citado
      POSIX de cada elemento argv antes de unir), usado en `client.ts` en vez de `argv.join(" ")`.
      7 tests nuevos en `shell-quote.test.ts`, incluyendo verificación contra un
      "unquoter" POSIX independiente que confirma que el valor original se recupera exacto tras
      citar y des-citar, sin fuga de metacarácter. Además, se envolvió la llamada a
      `confirmOperation` en `execute.ts` en un `try/catch` fail-closed (un fallo del propio
      `ConfirmationChannel` ahora produce `confirmation-required-but-missing`, nunca una excepción
      no estructurada que pudiera dejar el resultado en estado ambiguo). Resto de los 10 puntos
      solicitados verificados correctos sin cambios: validación de parámetros antes del hash de
      confirmación; host/comando siempre derivados de la configuración propia de Execution; hash
      vinculado exactamente a identity+parámetros+host+schemaFingerprint; un solo uso; deny→ni
      Secrets Broker ni SSH; requires-confirmation→confirma antes de tocar SSH; timeout de SSH
      cierra la conexión con `conn.destroy()`; credenciales nunca aparecen en ningún `reason` de
      `ExecutionOutcome` ni en mensajes de error propagados. Re-verificado tras la corrección:
      typecheck/lint/format/test (103/105, 2 skip POSIX)/build/`--frozen-lockfile`, todos
      correctos. `git diff`/`git status` revisados de nuevo: sin referencias a hosts reales del
      proyecto, ningún test abre conexión SSH real.

### Fase 8 — Integración MCP (completada, 2026-09-17)
- [x] Análisis completo presentado en una única respuesta (objetivo, arquitectura/flujo, la
      pregunta central MCP vs. hooks vs. combinación analizada en detalle como propuesta —no como
      decisión de antemano—, decisiones con alternativas/impacto, límites, riesgos, tests
      previstos, lista final de aprobación).
- [x] Dos rondas de verificación técnica y concreción adicional a petición del usuario antes de
      aprobar 8-C/8-E: (1) verificado con el SDK MCP real y documentación oficial que bloquear
      `tools/call` sin más no es sólido frente a los timeouts reales de Claude Code — requiere
      `notifications/progress` periódico; (2) verificado que `ReadlineConfirmationChannel` sobre
      stdin/stdout del servidor MCP es un conflicto técnico real y duro con el transporte stdio
      (DEC-046) — motivó la separación de procesos de DEC-047; (3) concreción de la topología E1b
      (Execution arrancado independientemente por el operador, canal IPC del patrón de DEC-010
      con contrato de dominio propio) y sus casos de fallo (Execution caído, socket ocupado,
      conexión perdida, reinicio) — todos fail-closed; (4) concreción exacta del guard de estado
      atómico sobre `OperationHash` para resolver la carrera cancelación/aprobación, y del límite
      preciso entre "cancelar antes de confirmar" (deniega) y "cancelar después de confirmar"
      (no aborta la ejecución SSH ya comprometida, solo afecta a la entrega del resultado).
- [x] **DEC-043** — Un único servidor MCP, agnóstico del backend de ejecución vía Discovery.
- [x] **DEC-044** — Ubicación: `packages/mcp-server`, paquete propio (patrón de DEC-008).
- [x] **DEC-045** — Confirmación durante `tools/call`: progreso periódico + gestión explícita de
      `notifications/cancelled`, guard de estado atómico sobre `OperationHash`, cancelación antes
      de confirmación = denegación, cancelación después de confirmación aprobada no aborta la
      ejecución SSH en curso (solo afecta a la entrega del resultado MCP) — amplía DEC-038 sin
      modificarla.
- [x] **DEC-046** — Transporte stdio; ningún contenido no-MCP se escribe jamás en stdout del
      servidor.
- [x] **DEC-047** — Servidor MCP y Execution como procesos separados (variante E1b: Execution
      arrancado independientemente por el operador); canal IPC del mismo patrón de transporte de
      DEC-010 con contrato de dominio propio (nunca reutilizando `SecretsBrokerTransport`);
      fail-closed uniforme ante cualquier fallo/ambigüedad del canal; una única instancia de cada
      en esta fase, sin discovery multi-instancia (límite documentado explícitamente).
- [x] `decisions/DECISIONS.md`, `STATE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
      `architecture/ARCHITECTURE.md`/`.en.md` (§1, §10, §20) sincronizados con DEC-043 a DEC-047,
      resolviendo la pregunta abierta de secuenciación MCP/hooks heredada de Fase 1.
- [x] Implementación: `packages/shared/src/mcp/` — `execution-channel.ts` (contrato de dominio
      `ExecutionChannelRequest`/`ExecutionChannelResponse`/`ExecutionChannelClient`, distinto de
      `SecretsBrokerTransport`). `packages/execution-ssh/src/confirmation/` — `hash-registry.ts`
      (`OperationHashRegistry`, 3 estados: pendiente/usado/cancelado, guard atómico sin `await`
      entre comprobación y transición), `cancel.ts` (`cancelOperation`, mismo hash determinista
      que `confirmOperation`); `confirm.ts`/`execute.ts` ampliados para usar el registro de 3
      estados (sin cambiar sus garantías ya aprobadas de DEC-038). `packages/execution-ssh/src/ipc/`
      — `pipe-path.ts` (canal de nombre fijo, named pipe/Unix socket según plataforma),
      `execution-server.ts` (servidor IPC: enruta `execute`/`cancel`, nunca bypassea Policy
      Engine, fail-closed en cualquier error). `packages/mcp-server/` (paquete nuevo) —
      `tools-list.ts` (traduce Discovery→MCP), `tools-call.ts` (`handleToolCall`: progreso,
      cancelación con comprobación previa a la petición para evitar una carrera de
      `Promise.race`, nunca reenvía texto libre), `execution-client.ts`
      (`NetExecutionChannelClient`, fail-closed en toda ambigüedad de conexión), `server.ts`
      (ensamblaje con `@modelcontextprotocol/sdk` oficial, `Server` de bajo nivel para exponer
      JSON Schema de Discovery directamente sin capa Zod).
- [x] Nueva dependencia de producción: `@modelcontextprotocol/sdk` (oficial, Tier 1, ya
      identificado en `TECH-STACK-ANALYSIS.md`) — no es una decisión nueva, aplicación de
      investigación ya hecha.
- [x] Tests (Vitest): 31 nuevos — 6 de `OperationHashRegistry` (transiciones de estado, no
      persistencia); 4 nuevos en `confirm.test.ts` cubriendo explícitamente cancelación antes de
      confirmación, aprobación después de cancelación, la carrera cancelación/aprobación
      simulada, y cancelación después de aprobación (no invalida retroactivamente); 3 de
      `execution-server.ts` (mensaje malformado, `deny` nunca toca Secrets Broker, cancelación
      propagada); 6 de `NetExecutionChannelClient` (Execution no disponible, request antes de
      connect, ronda completa, conexión perdida a media operación, respuesta malformada,
      reinicio de Execution simulado con reconexión); 8 de `handleToolCall` (tool desconocida,
      éxito, progreso periódico emitido y detenido correctamente, cancelación antes de respuesta
      con propagación de `cancel()`, señal ya abortada corta sin llamar a `request()`, fallo de
      IPC surge como error, parámetros nunca reescritos); 2 de verificación estática de que
      ningún fichero de `mcp-server` usa `console.*`/`process.stdout`/`process.stdin`
      directamente (DEC-046).
- [x] Alcance respetado: no se implementaron hooks de Claude Code (documentados como extensión
      futura posible); ningún sistema remoto real tocado, ningún despliegue externo; no se
      reabrió DEC-003, DEC-005, DEC-006, DEC-010, DEC-029, DEC-031, DEC-036, ni ninguna decisión
      de Fases 1-7; `confirm.ts`/`execute.ts` se ampliaron, no se rediseñaron.
- [x] **Verificado:** `pnpm run typecheck` correcto en los 5 paquetes (tras 3 correcciones de
      tipado — anotaciones de retorno en mocks de test); `pnpm run lint` sin errores (tras
      eliminar un import no usado); `pnpm run format` correcto (tras `--write` sobre 3 ficheros);
      `pnpm run test` — 132/134 correctos (2 tests de permisos POSIX omitidos en Windows,
      heredados de Fase 6) (31 nuevos + 103 previos), tras corregir una condición de carrera real
      en `handleToolCall` (`Promise.race` no garantizaba que una señal ya abortada ganara frente
      a una petición mockeada resuelta en el mismo tick — corregido comprobando `cancelled.aborted`
      explícitamente antes de emitir la petición, no solo como parte de la carrera); `pnpm run
      build` correcto en los 5 paquetes; `pnpm install --frozen-lockfile` correcto; grep de
      secretos hardcodeados, hosts reales del proyecto, y `console.*` fuera de lo ya permitido —
      sin coincidencias; `dist/`/`node_modules/`/`*.tsbuildinfo` correctamente ignorados; `git
      diff` confirma que Registry, Discovery, Policy Engine, Secrets Broker, y las plantillas de
      comando/cliente SSH de Fase 7 no fueron tocados — solo `confirm.ts`/`execute.ts` ampliados.

### Fase 9 — Sessions (completada, 2026-09-17)
- [x] Análisis en dos rondas: primero objetivo/alcance/modelo/ciclo de vida/persistencia/procesos/
      relación con Audit Log, con énfasis explícito en no asumir que Sessions deba fusionar los
      registros ya existentes de Policy Engine/Execution — concluyó que un identificador ligero de
      correlación es suficiente, sin entidad `Session` con estado propio; después, verificación
      técnica explícita del SDK MCP real (`1.30.0`) antes de aprobar DEC-050: confirmado que
      `RequestHandlerExtra.sessionId` existe pero es un concepto de **transporte** (solo lo asignan
      transportes HTTP/Streamable con reconexión) y que `StdioServerTransport` (DEC-046) nunca lo
      asigna; confirmado también que `prompt_id` no existe en el protocolo MCP (pertenece al
      formato de hooks de Claude Code, verificado en Fase 7, una superficie distinta).
- [x] **DEC-048** — Alcance: single-user/single-agent en esta fase, sin reabrir DEC-047.
- [x] **DEC-049** — Modelo: `SessionId` como identificador ligero de correlación — Policy
      Engine (`InMemoryPolicyApprovalStore`) y Execution (`OperationHashRegistry`) permanecen
      exactamente como estaban, sin fusión ni coordinación por parte de Sessions.
- [x] **DEC-050** — Origen: generado por el propio servidor MCP al arrancar (UUID), no derivado
      del `sessionId` del SDK — inviable con el transporte stdio ya decidido.
- [x] **DEC-051** — Ubicación: `packages/shared`, sin paquete ni proceso propio.
- [x] `decisions/DECISIONS.md`, `STATE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
      `architecture/ARCHITECTURE.md`/`.en.md` (§11) sincronizados con DEC-048 a DEC-051,
      resolviendo la pregunta abierta de multi-usuario/multi-agente heredada de Fase 1.
- [x] Implementación: `packages/shared/src/session/` — `session-id.ts` (`SessionId`, tipo
      opaco), `generate.ts` (`generateSessionId`, UUID). `ExecutionChannelRequest`
      (`packages/shared/src/mcp/execution-channel.ts`) ampliado con el campo `sessionId`
      (correlación pura, documentado explícitamente que Execution nunca lo usa para autorización).
      `packages/mcp-server/src/server.ts` genera un único `SessionId` en `createMcpServer` (una
      sesión por ciclo de vida del proceso, coherente con DEC-048) y lo propaga a
      `handleToolCall`/`tools-call.ts`, que lo incluye en cada `ExecutionChannelRequest` sin
      usarlo en ninguna decisión.
- [x] Tests (Vitest): 6 nuevos — 2 de `generateSessionId` (no vacío, nunca repetido entre
      generaciones); 1 de propagación explícita de `sessionId` en `tools-call.test.ts`; 3 de
      `server.test.ts` usando `InMemoryTransport.createLinkedPair()` del SDK real (cliente y
      servidor MCP conectados en memoria, sin procesos ni red) — cubre explícitamente: el mismo
      `SessionId` se propaga a través de múltiples `tools/call` en una misma instancia de
      servidor; una instancia nueva del servidor (simulando un reinicio del proceso) genera un
      `SessionId` distinto, sin reutilización entre reinicios; `sessionId` nunca afecta al
      veredicto de Policy Engine ni al resultado de ejecución.
- [x] Alcance respetado: no se introdujo persistencia, multi-agent, multi-user, ni discovery de
      múltiples instancias; no se reabrió DEC-047 ni ninguna otra decisión de Fases 1-8; ningún
      registro de Policy Engine o Execution fue modificado (verificado por `git diff` vacío sobre
      esos ficheros).
- [x] **Verificado:** `pnpm run typecheck` correcto en los 5 paquetes; `pnpm run lint` sin
      errores; `pnpm run format` correcto (tras `--write` sobre 2 ficheros de test); `pnpm run
      test` — 138/140 correctos (2 tests de permisos POSIX omitidos en Windows, heredados de Fase
      6) (6 nuevos + 132 previos); `pnpm run build` correcto en los 5 paquetes; `pnpm install
      --frozen-lockfile` correcto (sin dependencias nuevas); grep de secretos/logging sin
      coincidencias; `dist/`/`node_modules/`/`*.tsbuildinfo` correctamente ignorados; `git diff`
      confirma que Policy Engine, Execution (salvo el contrato ya ampliado en Fase 8) y Secrets
      Broker no fueron tocados.

### Fase 10 — Audit Log (EXECUTE + VERIFY completados, 2026-09-17)
- [x] INSPECT (12 secciones) → PLAN (arquitectura, persistencia, modelo de eventos, propagación
      de `sessionId`/flujo completo/atomicidad/rotación/impacto en código) → ronda de corrección
      crítica del PLAN por el usuario (4 puntos: inconsistencia `operationId`↔Execution;
      cancelación y `operationId`; campos reales disponibles en `tool-invoked`; correlación en
      todos los casos incluida cancelación en sus 3 fases) → DEC-052 a DEC-057 aprobadas como
      conjunto → EXECUTE.
- [x] **DEC-052** — Cada proceso (MCP server, Execution) escribe sus propios eventos de forma
      autónoma; sin proceso/componente dedicado nuevo (mismo criterio aplicado en DEC-017/022/
      029/044/051).
- [x] **DEC-053** — Persistencia JSON Lines append-only, un fichero por proceso escritor,
      permisos `0o600`; SQLite descartado por riesgo de dependencia nativa (ya materializado con
      `ssh2`/`cpu-features` en Fase 7 en esta máquina Windows).
- [x] **DEC-054** — `operationId` nuevo, distinto de `SessionId` y de `OperationHash`: único por
      invocación de `tools/call` (no por argumentos), generado una vez por el servidor MCP,
      independiente del resultado. `tool-invoked` corregido para incluir solo lo verificado como
      disponible antes de `resolveToolEntry()`: `mcpToolName`, `hostId`, `parameterNames` (nunca
      `ToolIdentity`, que todavía no existe en ese punto, ni valores de parámetros).
- [x] **DEC-055** — Minimización estricta: nunca secretos/claves SSH/passphrases/errores internos
      de librerías; stdout/stderr y comando resuelto nunca como contenido; parámetros solo como
      nombres de clave; hostname/username excluidos en favor de `hostId` opaco.
- [x] **DEC-056** — `sessionId` **y** `operationId` propagados juntos a través de
      `ExecutionRequest`, `ExecutionChannelRequest` y el contrato de cancelación — corrección
      respecto al PLAN inicial (que solo proponía `sessionId`), verificada contra el código real
      del cliente/servidor de Execution antes de aprobarse; Policy Engine, `OperationHashRegistry`
      y la lógica de ejecución no se tocan.
- [x] **DEC-057** — Audit Log best-effort y no bloqueante: un fallo de escritura nunca aborta,
      revierte ni condiciona la operación real — es evidencia, no mecanismo de control.
- [x] Implementación: `packages/shared/src/audit/` (`operation-id.ts`, `event.ts` con el tipo
      distributivo `AuditEventInput` sobre la unión discriminada `AuditEvent`, `writer.ts` con
      `AuditWriter`, `index.ts`); `ExecutionRequest`/`ExecutionChannelRequest` ampliados con
      `sessionId`+`operationId`; `ExecutionChannelClient.cancel()` ampliado a 6 parámetros;
      `tools-call.ts` genera `operationId` y escribe `tool-invoked`/`policy-decided`/
      `operation-cancelled` (fases `before-execution`/`during-confirmation`/
      `after-authorization`)/`execution-completed` (caso `execution-unavailable`);
      `execution-server.ts` ahora usa `sessionId`/`operationId` recibidos (antes `sessionId` se
      descartaba silenciosamente al llamar a `execute()` — corregido como parte de esta fase) y
      escribe `confirmation-resolved` (razón `cancelled`) y `execution-completed`.
- [x] **Decisión de diseño no contemplada, consultada durante EXECUTE (según lo pactado):**
      detectado heurístico frágil (`stdout.includes("[truncated]")`) para poblar
      `outputTruncated`, en tensión con DEC-055 y propenso a falsos positivos. Presentado al
      usuario antes de implementar; **autorizado** añadir un campo estructural mínimo
      `truncated: boolean` a los tipos ya cerrados de Fase 7 (`TruncatedOutput` en
      `output-limits.ts`, `ExecutionOutcome`, `SshExecResult`), sin cambiar límites ni
      comportamiento de truncamiento SSH, documentado explícitamente como ampliación estructural
      del contrato de Fase 7, no como cambio de política — tests de Fase 7 y Fase 10 actualizados
      en consecuencia.
- [x] Tests (Vitest) nuevos: `operation-id.test.ts` (2), `writer.test.ts` (3: escritura JSON
      Lines válida con `eventId`/`timestamp` generados, permisos `0o600` en POSIX, no-throw ante
      ruta no escribible — DEC-057); `output-limits.test.ts` reescrito para el nuevo shape
      `{text, truncated}` con un test explícito de que `truncated` se deriva de longitud en bytes,
      nunca de búsqueda de texto; actualizados `execute.test.ts`,
      `execution-client.test.ts`/`server.test.ts`/`tools-call.test.ts` del servidor MCP para los
      nuevos campos obligatorios (`operationId`, `stdoutTruncated`/`stderrTruncated`) y la nueva
      firma de `cancel()`.
- [x] Alcance respetado: no se reabrió ninguna decisión previa salvo la ampliación estructural de
      Fase 7 explícitamente autorizada; `OperationHash`/`OperationHashRegistry`/Policy Engine sin
      tocar; `operationId` no participa en autorización, confirmación ni ejecución; sin
      dependencias nuevas.
- [x] **Verificado:** `pnpm run typecheck` correcto en los 5 paquetes; `pnpm run lint` sin
      errores; `pnpm run format` correcto (tras `--write` sobre 2 ficheros); `pnpm run test` —
      144/146 correctos (2 tests de permisos POSIX omitidos en Windows, heredados de Fase 6),
      incluidos 5 tests nuevos de auditoría; `pnpm run build` correcto en los 5 paquetes; `pnpm
      install --frozen-lockfile` correcto (sin dependencias nuevas); grep de secretos/`console.*`
      sobre el diff y sobre `packages/shared/src/audit/` sin coincidencias; `git status` revisado
      en su totalidad. Commit `30ee62a` (2026-09-17), push a `origin/master` autorizado y
      realizado.

### Fase 10 — segunda ronda: correcciones tras revisión de código real en GitHub (2026-09-17)
- [x] El usuario revisó el código publicado (no solo el resultado textual de VERIFY) y detectó 4
      discrepancias entre DEC-052 a DEC-057 y la implementación real. Analizadas una por una contra
      el código antes de corregir, sin reabrir ninguna DEC:
  1. **Eventos de confirmación en el flujo normal ausentes.** `confirmOperation()`
     (`confirm.ts`) no escribía `confirmation-requested`/`confirmation-resolved` en ningún caso
     real (aprobado/rechazado/timeout/ya-usado) — solo `execution-server.ts` los escribía, y
     únicamente para el mensaje `"cancel"`. Corregido: `confirmOperation()` recibe un
     `AuditWriter` opcional y escribe ambos eventos en los 5 puntos de salida reales, sin tocar
     la lógica de `OperationHashRegistry`/DEC-038/045.
  2. **Cancelación antes de Execution generaba un evento falso.** `execution-server.ts` escribía
     `confirmation-resolved{reason:"cancelled"}` para **cualquier** mensaje `"cancel"`, incluso
     cuando nunca hubo una confirmación pendiente (p. ej. verdict `allow`, cancelado antes de
     que Execution recibiera el `"execute"`). Se detectó durante el análisis que
     `OperationHashRegistry` (3 estados: absent/used/cancelled) no puede por sí solo distinguir
     "cancelación durante confirmación realmente en vuelo" de "nunca hubo nada que cancelar" —
     ambos casos dejan el hash ausente en el momento de cancelar. Se comparó explícitamente
     añadir un 4º estado `pending` a `OperationHashRegistry` (reabriría DEC-038/045 y su garantía
     documentada de "three states, never surviving a process restart") frente a crear una
     estructura nueva y separada solo para auditoría — **elegida la segunda opción**: nuevo
     componente `PendingConfirmations` (`confirmation/pending-confirmations.ts`), poblado por
     `confirmOperation()` justo antes/después del único `await` a
     `channel.requestConfirmation()` (con `finally` para garantizar limpieza incluso si el canal
     lanza), consultado por `execution-server.ts` antes de decidir si escribe el evento. Nunca
     participa en autorización ni ejecución — aislamiento explícito coherente con DEC-056.
  3. **Longitud de stdout/stderr no registrada (DEC-055 exige longitud + truncado).** Verificado
     contra `ssh/client.ts`/`output-limits.ts` que el total de bytes recibidos antes de truncar
     ya se calcula dentro de `truncateOutput()` (sobre los chunks concatenados, antes del
     recorte) — no hace falta inferirlo del texto ya truncado. Añadido `totalBytes` a
     `TruncatedOutput`, propagado como `stdoutBytes`/`stderrBytes` en `SshExecResult` y
     `ExecutionOutcome` (extensión estructural de Fase 7, sin cambiar límites/comportamiento
     SSH), y expuesto en `ExecutionCompletedEvent`. Nombre elegido tras confirmar con el usuario
     la semántica exacta: bytes recibidos por este proceso antes de truncar, no una garantía
     absoluta de lo producido por el comando remoto en todos los casos límite.
  4. **Caso "unknown-tool" sin evento terminal.** `tools-call.ts` devolvía el error sin escribir
     ningún `execution-completed`, aunque `outcomeKind: "unknown-tool"` ya existía en el tipo
     (DEC-054) sin usarse nunca. Corregido: se escribe `execution-completed{outcomeKind:
     "unknown-tool", identity: undefined}` antes de devolver el error.
- [x] Implementación: `packages/execution-ssh/src/confirmation/pending-confirmations.ts` (nuevo,
      `PendingConfirmations`: `add`/`remove`/`has` sobre un `Set<OperationHash>`, in-memory, no
      persistente); `confirm.ts` (escribe `confirmation-requested`/`confirmation-resolved` en
      los 5 casos, usa `PendingConfirmations` alrededor del único `await`);
      `execution-server.ts` (construye/propaga `PendingConfirmations`, usa `.has()` en vez de
      `registry.get() !== undefined` para decidir si escribe `confirmation-resolved` en
      cancelación, añade `stdoutBytes`/`stderrBytes` a `execution-completed`); `execute.ts`
      (propaga `auditWriter`/`pendingConfirmations` a `confirmOperation()`); `ssh/client.ts` y
      `ssh/output-limits.ts` (`totalBytes`); `packages/shared/src/execution/result.ts` y
      `packages/shared/src/audit/event.ts` (`stdoutBytes`/`stderrBytes`); `tools-call.ts`
      (evento `unknown-tool`).
- [x] Tests nuevos: `pending-confirmations.test.ts` (4, componente aislado); `confirm.test.ts`
      (+3: marca/desmarca pending en flujo normal, limpieza garantizada si el canal lanza, nunca
      marca pending si el hash ya estaba resuelto); `execute.test.ts` (+5: eventos de
      confirmación en los 4 casos reales + verificación de que verdict `allow` no escribe
      ningún evento de confirmación); `execution-server.test.ts` (+3: cancelación sin
      confirmación pendiente no escribe evento falso, cancelación tras confirmación ya resuelta
      tampoco, cancelación durante confirmación genuinamente en vuelo sí lo escribe — este
      último usa un canal que nunca resuelve para simular el caso real).
- [x] Alcance respetado: `OperationHashRegistry`, `hash-registry.ts`, `cancel.ts`,
      `operation-hash.ts` sin modificar; DEC-038/045 no reabiertas; `PendingConfirmations` nunca
      participa en autorización/ejecución; sin dependencias nuevas; comportamiento SSH sin
      cambios; sin contenido de stdout/stderr registrado.
- [x] **Verificado:** `pnpm run typecheck` correcto en los 5 paquetes; `pnpm run lint` sin
      errores; `pnpm run format` correcto (tras `--write` sobre 2 ficheros); `pnpm run test` —
      159/161 correctos (2 omitidos en Windows, heredados de Fase 6), incluidos 15 tests nuevos
      de esta ronda; `pnpm run build` correcto en los 5 paquetes; `pnpm install
      --frozen-lockfile` correcto (sin dependencias nuevas); grep de secretos/`console.*` sobre
      el diff y los ficheros nuevos sin coincidencias; `git status`/`git diff --stat` revisados
      en su totalidad (13 ficheros modificados, 2 nuevos, coincide exactamente con los 4 puntos
      corregidos). **Pendiente:** autorización explícita y separada de `git commit` y de
      `git push` para esta segunda ronda — todavía no concedidas.

### Fase 11 — Connectors (INSPECT + PLAN + EXECUTE + VERIFY completados, 2026-09-17)
- [x] Proceso agrupado a petición del usuario (una sola ronda para INSPECT→PLAN→EXECUTE→VERIFY,
      con parada solo ante decisiones arquitectónicas reales): INSPECT completo del repo (roadmap,
      decisiones previas, estructura de código, dependencias) → identificado el vacío real (sin
      DEC previa, `ToolOriginKind` sin valor de conector, `SecretKind` sin OAuth, sin dependencias
      HTTP) → PLAN completo con 6 decisiones candidatas (DEC-058 a DEC-063) presentado y aprobado
      → verificación explícita solicitada por el usuario antes de EXECUTE: si existe un canal real
      Execution↔Secrets Broker (no existe — descubierto que ni siquiera `execution-ssh` lo tiene en
      producción) → comparación de 2 alternativas arquitectónicas presentada y resuelta a favor de
      mantener el patrón de inyección ya usado por `execution-ssh`, sin abrir una decisión nueva
      sobre el canal real → EXECUTE completo → VERIFY completo.
- [x] **DEC-058** — Modelo general: paquete propio por conector (`packages/connector-github`),
      mismo patrón de proceso Execution separado que `execution-ssh` (DEC-042/047).
- [x] **DEC-059** — Reutilización del contrato `ExecutionRequest`/`ExecutionOutcome`/
      `ExecutionChannelRequest` existente, sin nuevo protocolo; `hostId` reinterpretado como
      identificador de cuenta (ya opaco en su tipo); el servidor MCP enruta entre procesos
      Execution Backend por `ToolEntry.origin.id` vía `resolveExecutionClient`, sigue habiendo un
      único servidor MCP (DEC-043).
- [x] **DEC-060** — Nueva variante aditiva `ExecutionOutcome.kind === "executed-http"`
      (`statusCode`, `responseBytes`) en vez de forzar una respuesta HTTP en los campos SSH de
      `"executed"`; el cuerpo de la respuesta nunca se registra (extiende DEC-055).
- [x] **DEC-061** — Autenticación por Personal Access Token vía `SecretKind "token"` ya existente,
      sin OAuth ni `SecretKind` nuevo en esta fase.
- [x] **DEC-062** — Alcance funcional: 3 operaciones GitHub (`create_issue`, `list_issues`,
      `comment_on_issue`) con plantilla fija de endpoint+método+payload — nunca HTTP libre del
      agente, mismo principio que DEC-037.
- [x] **DEC-063** — `fetch` nativo de Node, sin dependencia HTTP nueva.
- [x] **Hallazgo verificado antes de EXECUTE (a petición explícita del usuario):** ningún proceso
      Execution Backend tiene hoy un canal real hacia el Secrets Broker en producción — DEC-010
      (Fase 2) solo autoriza un canal Core↔Secrets Broker, sin implementación real en ningún
      sistema operativo (`packages/core/src/transport/index.ts` y
      `packages/secrets-broker/src/transport/index.ts` son placeholders vacíos desde la Fase 2);
      `execution-ssh`'s `getSshKeySecret` ya es una función inyectada sin implementación real,
      solo mockeada en tests. Presentadas 2 alternativas (ampliar DEC-010 ahora vs. mantener el
      patrón de inyección como limitación heredada) — **elegida la segunda**: `connector-github`
      usa `getTokenSecret` inyectado, exactamente igual que `execution-ssh`, documentado como
      limitación compartida, sin reabrir DEC-010.
- [x] Implementación: paquete nuevo `packages/connector-github/` — `config/` (`account-config.ts`,
      `operation-template.ts`, análogos a `host-config.ts`/`command-template.ts` de Fase 7);
      `confirmation/` (duplicado del módulo de confirmación de `execution-ssh` con nombres neutros
      — `accountLabel`/`operationSummary` en vez de `hostname`/`resolvedCommand` — deliberadamente
      no compartido entre paquetes, cada Execution Backend con su propia máquina de confirmación);
      `github/client.ts` (`fetch` nativo, `AbortController` para timeout, nunca registra el cuerpo
      de la respuesta); `execute.ts` (orquestador, mismo flujo que `execution-ssh`'s `execute.ts`);
      `ipc/connector-server.ts` (servidor IPC, mismo patrón que `execution-server.ts`, canal propio
      `agentforge-connector-github` distinto del de SSH). `packages/shared`: `ExecutionOutcome`
      gana `"executed-http"` (aditivo); `ExecutionCompletedEvent` gana `"executed-http"` y los
      campos `statusCode`/`responseBytes` (aditivo). `packages/mcp-server`: `tools-call.ts`/
      `server.ts` cambian de un `executionClient` fijo a `resolveExecutionClient(originId)`, con
      fail-closed explícito (`execution-completed{outcomeKind:"execution-unavailable"}`) cuando no
      hay backend configurado para el origen. `packages/execution-ssh/src/ipc/execution-server.ts`:
      único cambio, los dos `execution-completed` que escribe ahora incluyen
      `statusCode`/`responseBytes: undefined` (campos nuevos obligatorios en el tipo).
- [x] Tests nuevos: 54 en `packages/connector-github` (hash-registry, pending-confirmations,
      operation-hash, confirm, operation-template, github/client, execute, ipc/connector-server) +
      3 en `packages/mcp-server/src/tools-call.test.ts` (enrutamiento por `origin.id`, fail-closed
      sin backend configurado, evento de auditoría correspondiente).
- [x] Alcance respetado: `execution-ssh` no modificado salvo el campo aditivo ya descrito; Policy
      Engine, Secrets Broker, Registry, Discovery, `OperationHashRegistry` sin tocar; ningún
      sistema remoto real tocado (sin token de GitHub real, sin llamada HTTP real fuera de tests,
      `fetch` siempre mockeado); sigue habiendo un único servidor MCP (DEC-043 no reabierta);
      `ToolOriginKind` no modificado (el conector reutiliza el valor `"agentforge"` ya reservado
      y sin uso real previo).
- [x] **Verificado:** `pnpm run typecheck` correcto en los 6 paquetes (incluido el nuevo); `pnpm
      run lint` sin errores (tras corregir 2 avisos menores de variables no usadas); `pnpm run
      format` correcto (tras `--write` sobre 8 ficheros); `pnpm run test` — 216/218 correctos (2
      omitidos en Windows, heredados de Fase 6), incluidos 57 tests nuevos; `pnpm run build`
      correcto en los 6 paquetes; `pnpm install --frozen-lockfile` correcto (el nuevo paquete solo
      añade `@agentforge/shared` como dependencia de workspace, sin dependencias de runtime
      externas); grep de secretos/`console.*`/llamadas de red reales sin coincidencias; `git
      status` revisado en su totalidad (10 ficheros modificados, paquete nuevo completo sin
      trackear). **Pendiente:** autorización explícita y separada de `git commit` y de `git push`
      — todavía no concedidas.

### Fase 12 — Dashboard Web (INSPECT + PLAN + EXECUTE + VERIFY completados, 2026-09-17)
- [x] INSPECT completo: roadmap/estado real coinciden; identificado que la Fase 12 es la siguiente
      pendiente; ninguna DEC previa sobre Dashboard; restricción arquitectónica ya fijada en
      `ARCHITECTURE.md` §15 (consumir los mismos componentes que Claude Code, nunca un segundo
      camino de acceso). Hallazgo relevante detectado antes del PLAN: `AuditWriter` (Fase 10) se
      inyecta como parámetro opcional en 4 puntos del código pero nunca se instancia con una ruta
      real en ningún sitio fuera de su propio test unitario — sin esto, el Dashboard no tendría
      ningún dato real que mostrar.
- [x] PLAN presentado y aprobado en una sola ronda (5 decisiones candidatas iniciales, DEC-A a
      DEC-E del PLAN) — alcance: Dashboard de solo lectura sobre Tool Registry/Discovery, Policy
      Engine y Audit Log; fuera de alcance explícito: ejecución, gestión de secretos, edición de
      configuración, autenticación multi-usuario, bootstrap de proceso de producción completo.
- [x] Durante EXECUTE, dos precisiones de alcance consultadas explícitamente con el usuario antes
      de implementar (no asumidas): (1) verificado que `startStdioServer`/`startExecutionServer`/
      `startConnectorServer` son funciones de librería sin ningún `main`/CLI real que las invoque
      — la propuesta inicial de DEC-065 asumía "3 puntos de arranque ya existentes" como procesos,
      que no existen como tales; resuelto con un valor por defecto interno en cada start-function,
      sin crear ningún proceso/CLI nuevo (ampliaría el alcance más allá de lo aprobado); (2)
      verificado el mismo hueco para `loadDiscoveryConfig`/`loadPolicyConfig`/
      `FileToolRegistryStore` (ninguna ruta real convencional, solo rutas de test) — resuelto
      extendiendo la misma convención `AGENTFORGE_DATA_DIR` de DEC-065 en vez de inventar un
      segundo esquema.
- [x] **DEC-064** — Acceso a datos del Dashboard: lectura directa de los mismos ficheros que ya
      consumen Core/MCP server, sin API externa nueva, sin reabrir §14.
- [x] **DEC-065** — Bootstrap mínimo: cada `start*Server` construye un `AuditWriter` real por
      defecto (vía `resolveAuditLogPath`) cuando el llamador no inyecta uno, sin crear ningún
      `main`/CLI/proceso nuevo.
- [x] **DEC-066** — Framework HTTP: Fastify, sin dependencias con riesgo de compilación nativa.
- [x] **DEC-067** — Frontend: HTML servido + JavaScript mínimo, sin framework ni toolchain de
      build.
- [x] **DEC-068** — Sin autenticación, bind exclusivo a `127.0.0.1`.
- [x] **DEC-069** — Convención `AGENTFORGE_DATA_DIR` (DEC-065) extendida con
      `resolveRegistryCachePath`/`resolveDiscoveryConfigPath`/`resolvePolicyConfigPath` en
      `packages/shared`, usadas solo por el Dashboard para leer.
- [x] `decisions/DECISIONS.md`, `STATE.md`, `ROADMAP.md`, `DEVELOPMENT.md`,
      `architecture/ARCHITECTURE.md`/`.en.md` (§15) sincronizados con DEC-064 a DEC-069.
- [x] Implementación: `packages/shared/src/paths/` (nuevo — `resolveAuditLogPath` movido desde
      `audit/`, más `resolveRegistryCachePath`/`resolveDiscoveryConfigPath`/
      `resolvePolicyConfigPath`, todas sobre la misma convención `AGENTFORGE_DATA_DIR`);
      `packages/mcp-server/src/server.ts` (`startStdioServer` con `AuditWriter` por defecto);
      `packages/execution-ssh/src/ipc/execution-server.ts` y
      `packages/connector-github/src/ipc/connector-server.ts` (mismo patrón de valor por defecto);
      paquete nuevo `packages/dashboard/` completo — `src/server.ts` (app Fastify, bind
      `127.0.0.1`), `src/routes/` (`audit.ts`/`tools.ts`/`policy.ts`, todas GET), `src/readers/`
      (`audit-reader.ts` con tolerancia a fichero ausente/línea corrupta,
      `tools-reader.ts`/`discovery-reader.ts` reutilizando `FileToolRegistryStore`/
      `discoverTools`/`StaticConfigDiscoveryStrategy` de `packages/core` sin reimplementar
      parsing, `policy-reader.ts` reutilizando `loadPolicyConfig`), `src/public/` (HTML/CSS/JS
      estático sin build). `eslint.config.js` excluye `packages/dashboard/src/public/**` (código
      de navegador fuera del grafo de proyecto TypeScript, mismo criterio que su exclusión de
      `tsc -b`).
- [x] Tests nuevos: 3 en `packages/shared/src/paths/resolve-path.test.ts`; 1 en
      `execution-server.test.ts` y 1 en `connector-server.test.ts` (arranque sin `auditWriter`
      inyectado no lanza); 7 en `packages/dashboard/src/server.test.ts` (4 rutas de solo lectura
      con datos vacíos cuando no hay ficheros todavía, servido de HTML estático, verificación
      estática de que ninguna ruta usa un método distinto de GET, bind a `127.0.0.1`); 4 en
      `packages/dashboard/src/readers/audit-reader.test.ts` (fichero ausente, parseo válido con
      orden más-reciente-primero, línea corrupta tolerada sin romper el resto, fusión de varios
      procesos escritores).
- [x] **Verificación manual (VERIFY funcional, además de los tests automatizados):** arrancado el
      servidor Dashboard compilado contra un directorio de datos de fixture generado a mano
      (`AGENTFORGE_DATA_DIR` apuntando a un directorio temporal fuera del repositorio, sin tocar
      ningún dato real) — confirmado que las 4 rutas devuelven exactamente los datos de fixture
      esperados, con el orden más-reciente-primero correcto en Audit Log y el filtrado correcto de
      Discovery por `activeQualifiedNames`; confirmado que `GET /` sirve la página HTML; confirmado
      que el servidor solo escucha en `127.0.0.1` (nunca `0.0.0.0`). Fixture eliminado tras la
      verificación.
- [x] Alcance respetado: no se implementó ejecución, gestión de secretos, edición de configuración,
      autenticación multi-usuario, ni un bootstrap de proceso de producción completo (`main`/CLI
      real) — límite explícitamente confirmado con el usuario durante EXECUTE. Registry, Discovery,
      Policy Engine, Secrets Broker, Execution SSH/Connectors, Sessions, Audit Log (lógica de
      escritura) sin modificar salvo el valor por defecto de `AuditWriter` ya descrito. Ningún
      sistema remoto real tocado.
- [x] **Verificado:** `pnpm run typecheck` correcto en los 7 paquetes (incluido el nuevo); `pnpm
      run lint` sin errores (tras excluir `packages/dashboard/src/public/**`, código de navegador
      no destinado a ESLint con configuración Node/TypeScript); `pnpm run format` correcto (tras
      `--write` sobre 4 ficheros); `pnpm run test` — 232/234 correctos (2 omitidos en Windows,
      heredados de Fase 6), incluidos 16 tests nuevos; `pnpm run build` correcto en los 7 paquetes
      (incluida la copia de `src/public` a `dist/public`); `pnpm install` correcto (única
      dependencia de runtime nueva: `fastify`, aislada en `packages/dashboard`); grep de
      secretos/`console.*`/hosts reales del proyecto sin coincidencias; `git status` revisado en su
      totalidad (10 ficheros modificados, paquete nuevo `packages/dashboard/` y
      `packages/shared/src/paths/` sin trackear). **Pendiente:** autorización explícita y separada
      de `git commit` y de `git push` — todavía no concedidas.

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
- **DEC-023** — Origen del riesgo: configuración propia del Policy Engine, por `identity`, nunca
  en `ToolEntry`.
- **DEC-023b** — Granularidad constante por `identity`, peor caso razonable.
- **DEC-024** — Motor de reglas derivado del riesgo, overrides simples `allow`/`deny`.
- **DEC-025** — Resultado ternario con razón estructurada.
- **DEC-026** — Invalidación automática de aprobación ante cambio de `schemaFingerprint`.
- **DEC-027** — Sin persistencia ni auditoría propia del Policy Engine.
- **DEC-028** — Configuración declarativa en JSON propio, separado de Registry y Discovery.
- **DEC-029** — Ubicación: `packages/core/src/policy/`, sin paquete propio.
- **DEC-030** — Almacenamiento: fichero cifrado propio (AES-256-GCM), no OS credential store.
- **DEC-031** — Modelo de secreto: `SecretRecord` con `kind`/`payload`/`metadata`.
- **DEC-032** — Clave maestra: fichero separado, permisos de SO, arranque desatendido.
- **DEC-033** — API del Secrets Broker: `get`/`create`/`update`/`delete`/`exists`/`listMetadata`.
- **DEC-034 (revisada)** — `SecretId` propio, sin binding `allowedOrigins` autodeclarado por Core.
- **DEC-035** — Ubicación: `packages/secrets-broker/src/` (confirmación de DEC-008/DEC-004).
- **DEC-036** — Sin evidencia criptográfica de autorización Policy Engine↔Secrets Broker; límite
  de seguridad documentado explícitamente.
- **DEC-037** — Comandos: plantilla fija por tool, nunca shell arbitraria.
- **DEC-038** — Confirmación humana propia de Execution: hash determinista, un solo uso, timeout,
  rechazo por defecto — hooks de Claude Code descartados tras verificación técnica.
- **DEC-039** — Configuración de hosts remotos en JSON propio.
- **DEC-040** — Límites de stdout/stderr, nunca logueados en claro.
- **DEC-041** — Timeout de conexión SSH, cierre forzado al expirar.
- **DEC-042** — Ubicación: `packages/execution-ssh`, paquete propio.
- **DEC-043** — Un único servidor MCP, agnóstico del backend de ejecución.
- **DEC-044** — Ubicación: `packages/mcp-server`, paquete propio.
- **DEC-045** — Confirmación durante `tools/call`: progreso periódico + cancelación explícita,
  guard de estado atómico sobre `OperationHash` — amplía DEC-038 sin modificarla.
- **DEC-046** — Transporte stdio, ningún contenido no-MCP en stdout del servidor.
- **DEC-047** — Servidor MCP y Execution como procesos separados, canal IPC del patrón de
  DEC-010 con contrato de dominio propio, fail-closed uniforme.
- **DEC-048** — Alcance de Sessions: single-user/single-agent, sin reabrir DEC-047.
- **DEC-049** — Modelo: `SessionId` ligero de correlación, sin fusionar registros de Policy
  Engine/Execution.
- **DEC-050** — Origen: generado por el servidor MCP, no derivado del SDK (verificado técnicamente).
- **DEC-051** — Ubicación: `packages/shared`, sin paquete ni proceso propio.
- **DEC-052** — Escritura de Audit Log: cada proceso escribe sus propios eventos, sin componente
  ni proceso dedicado nuevo.
- **DEC-053** — Persistencia: JSON Lines append-only, un fichero por proceso, permisos `0o600`,
  sin SQLite.
- **DEC-054** — Modelo `operationId`: nuevo, único por invocación, distinto de `SessionId` y de
  `OperationHash`.
- **DEC-055** — Minimización estricta de datos en cada evento de auditoría.
- **DEC-056** — `sessionId` y `operationId` propagados juntos a Execution y al contrato de
  cancelación.
- **DEC-057** — Audit Log best-effort y no bloqueante: nunca condiciona la operación real.
- **DEC-058** — Connectors: paquete propio por conector, mismo patrón que Execution SSH.
- **DEC-059** — Reutilización del contrato Execution existente; enrutamiento por `origin.id`.
- **DEC-060** — Nueva variante aditiva `ExecutionOutcome` para resultados HTTP.
- **DEC-061** — Autenticación por Personal Access Token vía `SecretKind "token"` existente.
- **DEC-062** — Alcance funcional: operaciones GitHub con plantilla fija, nunca HTTP libre.
- **DEC-063** — `fetch` nativo de Node, sin dependencia HTTP nueva.
- **DEC-064** — Dashboard: acceso a datos por lectura directa de fichero, sin API externa nueva.
- **DEC-065** — Dashboard: bootstrap mínimo de `AuditWriter` con ruta real por defecto.
- **DEC-066** — Dashboard: framework HTTP Fastify.
- **DEC-067** — Dashboard: frontend HTML servido + JS mínimo, sin toolchain de build.
- **DEC-068** — Dashboard: sin autenticación, bind exclusivo a localhost.
- **DEC-069** — Dashboard: convención de ruta real para configuración de Registry/Discovery/Policy.

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

- Hash: `b301606a2e4f1215a257516f878022d70dbaab0c` (corto: `b301606`)
- Autor: `catlinux <marc.catlinux@gmail.com>`
- Mensaje: `feat+docs: implementa Connectors (GitHub) — Fase 11 (DEC-058 a DEC-063)`
- Commits anteriores: `8d6670e` (correcciones Fase 10 tras revisión de código real), `30ee62a`
  (Fase 10 — primera implementación), `5c4833d` (Fase 9), `6bdec65` (Fase 8), `86571b7` (Fase 7),
  `b48670d` (Fase 6), `2411dc3` (Fase 5), `624581e` (Fase 4), `1399053` (Fase 3), `4e01064`
  (Fase 2), `2922629` (Fase 1), `d83da17` (Fase 0.7), `c671bef` (Fase 0 + Fase 0.5).
- **Los cambios de la Fase 12 (Dashboard Web, DEC-064 a DEC-069) están en el working tree, sin
  commitear todavía** — pendientes de autorización explícita y separada de `git commit`/`git push`.

## Estado del push

- `master` sincronizado con `origin/master` en `b301606` (Fase 11) al inicio de esta sesión.
  Los cambios de la Fase 12 son locales, todavía sin commitear ni pushear.

## Próxima acción recomendada

1. **Fase 11 (Connectors) está cerrada**: 6 decisiones aprobadas (DEC-058 a DEC-063), implementada,
   verificada, commiteada y pusheada (`b301606`).
2. **Fase 12 (Dashboard Web) completada localmente** — INSPECT + PLAN + EXECUTE + VERIFY
   completados (2026-09-17): 6 decisiones aprobadas (DEC-064 a DEC-069), paquete nuevo
   `packages/dashboard/` implementado y verificado (typecheck/lint/format/test/build limpios,
   verificación manual funcional contra fixtures). Pendiente de presentar el resultado de VERIFY
   al usuario y de autorización explícita y separada de `git commit` y `git push` — todavía no
   solicitadas ni concedidas.
3. Decisiones pendientes que siguen abiertas, no bloqueantes: licencia del proyecto, visibilidad
   del repositorio, inconsistencia de idioma Fase 0, traducción al inglés de
   `TECH-STACK-ANALYSIS.md` y `CORE-STRUCTURE-ANALYSIS.md`; el transporte IPC real Core↔Secrets
   Broker (DEC-010) sigue sin implementar (distinto del canal MCP↔Execution de DEC-047, ya
   implementado); el usuario de sistema dedicado en cada host remoto (`ARCHITECTURE.md` §9 OPEN
   QUESTION) sigue sin resolver — no se puede implementar sin tocar esos sistemas, prohibido hasta
   autorización explícita; ningún paquete tiene todavía un `main`/CLI de producción real (hallazgo
   de la Fase 12, ver DEC-065/069) — candidato a una fase futura dedicada.

## Cómo reprender este trabajo

1. Lee este archivo (`STATE.md`) primero.
2. Lee `decisions/DECISIONS.md` — si contiene algún `DEC-XXX`, esa decisión ya está aprobada y
   debe respetarse.
3. Lee `README.md` para la visión general actual del proyecto.
4. Para el detalle técnico completo de la investigación, ver `docs/research/RESEARCH-REPORT.md` y
   `architecture/ARCHITECTURE-DRAFT.md` (en catalán).
5. No asumas que ha habido commits, push, o configuración de GitHub entre sesiones salvo que este
   archivo lo indique explícitamente.
