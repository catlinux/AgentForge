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

---

## PENDIENTE — decisiones abiertas que requieren autorización explícita del usuario

Estas no son decisiones — son la lista de puntos que necesitan decisión antes o durante la Fase 1.
Se listan aquí para que sean visibles y no se pierdan entre sesiones. Cuando una de ellas se
apruebe, debe moverse arriba como `DEC-XXX` con el formato correspondiente.

~~6. Uso de GitHub~~ → **resuelto, ver DEC-001**.
~~7. Identidad Git~~ → **resuelto, ver DEC-002**.

1. **Relación con Claude Code** — ¿(a) wrap de la CLI como subproceso, (b) Agent SDK como producto
   separado, o (c) extensión in-place vía hooks/MCP propios? (Ver
   `architecture/ARCHITECTURE-DRAFT.md` §0 y §9.1.)
2. **Modelo de amenaza del Secrets Broker** — ¿es necesario que corra como proceso separado con su
   propio usuario/permisos del SO, dado que el propio proceso del agente LLM podría ser el actor de
   amenaza? (Ver `SECURITY.md` y `architecture/ARCHITECTURE-DRAFT.md` §5, §9.2.)
3. **Estrategia MCP** — ¿objetivo "Modern-only" (espec 2026-07-28) o soporte "Dual-era" para
   interoperar con el ecosistema existente? (Ver `docs/research/MCP-ANALYSIS.md` y
   `architecture/ARCHITECTURE-DRAFT.md` §7, §9.3.)
4. **Arquitectura de ejecución remota** — ¿claves SSH dedicadas por host (Debian casa, Contabo) o
   una CA SSH desde el principio? (Ver `research/SSH-SECURITY-NOTES.md` y
   `architecture/ARCHITECTURE-DRAFT.md` §4, §9.4.)
5. **Licencia del proyecto** — todavía no elegida. Ver `DEVELOPMENT.md`.
6. **Uso de GitHub** — ¿se usará GitHub para AgentForge? ¿Con qué cuenta/organización? ¿Nombre del
   repositorio? ¿Público o privado? Ninguna de estas preguntas debe asumirse.
7. **Identidad Git** — la identidad global de la máquina (`warcrafted-server`) no parece
   corresponder a este proyecto. Pendiente decidir si se configura una identidad local específica
   para el repositorio de AgentForge.
8. **Inconsistencia de idioma entre fases** — la documentación de la Fase 0 está en catalán; desde
   la Fase 0.5 el proyecto usa español/inglés. Pendiente decidir si en algún momento se traduce la
   investigación de la Fase 0, o si se mantiene como está permanentemente (ver `README.md`).
