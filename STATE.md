# STATE.md — AgentForge

**Última actualización:** 2026-09-16 (fin de la Fase 0.5)

## Proyecto

AgentForge: infraestructura modular propia para que agentes de IA (inicialmente Claude Code)
puedan usar herramientas, MCP, conectores, sistemas remotos, APIs, autenticación, permisos,
descubrimiento de herramientas, sesiones y automatizaciones de forma controlada, extensible y sin
dependencia obligatoria de un proveedor externo. Toma Composio como referencia (no como modelo a
copiar).

## Fase actual

**Fase 0.7 — Exploración de proyectos y funcionalidades relacionadas**

**Estado:** COMPLETADA

**Implementación:** NO INICIADA

**Investigación:** Fases 0 y 0.7 completadas (además de la Fase 0.5, de gobernanza, también
completada)

**Arquitectura:** BORRADOR / PENDIENTE DE APROBACIÓN

## Microtarea actual

Ninguna en curso — la Fase 0.7 se ha completado y el trabajo se detiene aquí a la espera de
instrucciones del usuario, tal como especifica el encargo de esta fase. No se ha hecho commit de
los cambios de esta fase (instrucción explícita del encargo: ninguna autorización de investigación
implica autorización de commit).

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

Ver `decisions/DECISIONS.md` para el detalle completo.

## Propuestas (no decisiones)

Toda la arquitectura de `architecture/ARCHITECTURE-DRAFT.md` sigue siendo propuesta. Ver ese
documento, sección 9, para las 4 preguntas arquitectónicas abiertas.

## Decisiones pendientes

Lista completa y actualizada en `decisions/DECISIONS.md` (sección "PENDIENTE"). Resumen:
1. Relación con Claude Code (wrap CLI / Agent SDK / extensión in-place).
2. Modelo de amenaza del Secrets Broker.
3. Estrategia MCP (Modern-only vs. Dual-era).
4. Arquitectura de ejecución remota (claves por host vs. CA SSH).
5. Licencia del proyecto.
6. ~~Uso de GitHub~~ — **resuelto, ver DEC-001**.
7. ~~Identidad Git~~ — **resuelto, ver DEC-002**.
8. Qué hacer con la inconsistencia de idioma Fase 0 (catalán) vs. resto del proyecto
   (español/inglés).
9. Visibilidad del repositorio `catlinux/AgentForge` (público/privado) — no confirmada
   explícitamente por el usuario, no asumida.

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

- Hash: `c671bef`
- Autor: `catlinux <marc.catlinux@gmail.com>`
- Mensaje: `docs: establece la base y gobernanza inicial de AgentForge`
- Contenido: 18 archivos, 2.768 inserciones — toda la documentación de Fase 0 (investigación,
  catalán) y Fase 0.5 (gobernanza, español/inglés). Ningún archivo de código.

## Estado del push

- **Realizado** (2026-09-16, con autorización explícita del usuario). `master` → `origin/master`,
  rama nueva creada en el remoto, tracking configurado.

## Próxima acción recomendada

1. Confirmar visibilidad del repositorio `catlinux/AgentForge` (pública/privada) si es relevante.
2. Resolver las decisiones pendientes restantes (relación con Claude Code, modelo de amenaza del
   Secrets Broker, estrategia MCP, arquitectura de ejecución remota, licencia del proyecto,
   inconsistencia de idioma Fase 0) antes o durante la Fase 1.
3. **Siguiente fase propuesta: Fase 1 — Arquitectura y decisiones tecnológicas.** No se inicia
   sin autorización explícita del usuario.

## Cómo reprender este trabajo

1. Lee este archivo (`STATE.md`) primero.
2. Lee `decisions/DECISIONS.md` — si contiene algún `DEC-XXX`, esa decisión ya está aprobada y
   debe respetarse.
3. Lee `README.md` para la visión general actual del proyecto.
4. Para el detalle técnico completo de la investigación, ver `docs/research/RESEARCH-REPORT.md` y
   `architecture/ARCHITECTURE-DRAFT.md` (en catalán).
5. No asumas que ha habido commits, push, o configuración de GitHub entre sesiones salvo que este
   archivo lo indique explícitamente.
