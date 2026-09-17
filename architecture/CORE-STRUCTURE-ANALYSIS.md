# Análisis de estructura núcleo — AgentForge (Fase 2)

**Estado: las 5 decisiones de este documento están APROBADAS — ver DEC-008 a DEC-012 en
`decisions/DECISIONS.md` (2026-09-16), incluyendo la aclaración multiplataforma de la Decisión 3.
Este documento se conserva como el análisis y justificación detrás de esas decisiones. Todavía NO
se ha creado ninguna carpeta, fichero de configuración ni código — ver DEC-012.**

Complementa `architecture/ARCHITECTURE.md` (Fase 1) y `architecture/TECH-STACK-ANALYSIS.md`
(DEC-007: TypeScript/Node.js). Traducción al inglés disponible en
`architecture/CORE-STRUCTURE-ANALYSIS.en.md` (DEC-079, Fase 15).

**Fecha:** 2026-09-16.

**Restricciones de partida** (no negociables, ya aprobadas):
- DEC-003 — extensión in-place vía hooks/MCP propios.
- DEC-004 — Secrets Broker como **proceso separado, usuario de SO propio**.
- DEC-005 — MCP Modern-only.
- DEC-006 — SSH con claves dedicadas por host.
- DEC-007 — TypeScript/Node.js como stack único.
- Un solo desarrollador, evitar complejidad prematura, pero sin crear algo que haya que rehacer
  cuando crezca (más servidores MCP, execution backends, Policy Engine, Audit Log, posible
  multiusuario futuro).

---

## Decisión 1 — Estructura de repositorio

### Alternativas
- **A. Monorepo con workspaces** (npm/pnpm/yarn workspaces): paquetes separados —
  `packages/shared`, `packages/core`, `packages/secrets-broker`, y espacio para
  `packages/mcp-<nombre>` / `packages/execution-<nombre>` a medida que se añadan.
- **B. Paquete único con carpetas internas** (`src/core`, `src/secrets-broker`, `src/shared`),
  un solo `package.json`, múltiples puntos de entrada/bundles de salida.
- **C. Multi-repo** (un repositorio Git por componente).

### Ventajas / desventajas para AgentForge
- **A (monorepo+workspaces):** cada paquete declara sus propias dependencias — el Secrets Broker
  puede tener una huella de dependencias mínima y auditable, distinta de la de Core, lo cual
  refuerza a nivel de *empaquetado* (no solo en tiempo de ejecución) la frontera de confianza que
  ya exige DEC-004. Crecer con más servidores MCP o execution backends es literalmente añadir un
  paquete nuevo, sin tocar los existentes — encaja directamente con el requisito de crecimiento
  futuro. Coste: algo más de configuración inicial (un `package.json` por paquete, una config base
  compartida) — modesto con las herramientas actuales, no requiere un orquestador de monorepo
  adicional (Nx/Turborepo) a esta escala.
- **B (paquete único):** más simple para arrancar (un `node_modules`, un lockfile), pero todos los
  componentes comparten las mismas dependencias — el Secrets Broker heredaría dependencias de
  Core/MCP aunque no las necesite, lo cual amplía innecesariamente su superficie de ataque
  (justo el componente que DEC-004 quiere más aislado). La separación de procesos sigue siendo
  posible (scripts de entrada distintos), pero sin ninguna barrera que impida que el código del
  Broker importe por accidente algo de Core. Crecer añadiendo más servidores/backends acumula
  subcarpetas en un único árbol `src/`, sin límites reforzados — más probable que haga falta
  reestructurar más adelante.
- **C (multi-repo):** coordinación entre repos (versionar tipos compartidos, commits cruzados) es
  complejidad real sin beneficio para un solo desarrollador — descartada directamente, contraria
  al principio explícito de evitar complejidad innecesaria.

### Dependencias con otras decisiones
- Determina si el gestor de paquetes necesita soporte de workspaces (los tres candidatos de la
  Decisión 2 lo soportan).
- Facilita reforzar la Decisión 3 (IPC): con paquetes separados es más fácil garantizar que el
  Secrets Broker nunca importe directamente las librerías HTTP/MCP de Core.
- Determina dónde viven las configuraciones compartidas de la Decisión 4 (una base de
  `tsconfig`/ESLint en la raíz, extendida por paquete).

### Consecuencias de cambiarlo después
- Migrar de B (paquete único) a A (workspaces) más adelante es un refactor mecánico pero real:
  mover carpetas a paquetes, añadir `package.json` por paquete, ajustar imports — no catastrófico,
  pero es exactamente el tipo de "reescritura después" que el usuario pidió evitar si es evitable
  desde el principio.
- Migrar de A a C (multi-repo) sería más disruptivo (separar historial de Git) — no se prevé
  necesario a esta escala.

### Recomendación
**A — Monorepo con workspaces**, con paquetes iniciales `packages/shared`, `packages/core`,
`packages/secrets-broker`. Es la opción que mejor sirve simultáneamente al requisito 3 (Core y
Secrets Broker genuinamente separados, reforzado también a nivel de empaquetado) y al requisito 5
(crecimiento futuro por adición de paquetes, no por reestructuración).

---

## Decisión 2 — Gestor de paquetes

### Alternativas
- **npm** (incluido en Node, sin instalación adicional).
- **pnpm** (instalación trivial vía Corepack en Node moderno; almacén de contenido direccionable,
  instalación más rápida y con menos disco).
- **yarn** (Classic v1, esencialmente en mantenimiento/legado; o Berry/v2+ con PnP).

### Ventajas / desventajas para AgentForge
- **npm:** maduro, sin fricción de instalación, soporte de workspaces suficiente. Desventaja
  relevante aquí: el "hoisting" de dependencias es más laxo — un paquete puede llegar a resolver
  una dependencia que no declaró explícitamente porque quedó disponible en el `node_modules` raíz
  compartido ("dependencia fantasma"). Para un proyecto donde la huella de dependencias del
  Secrets Broker importa por seguridad, esta laxitud es una desventaja concreta, no solo teórica.
- **pnpm:** estructura de `node_modules` estricta — un paquete **no puede** resolver un módulo que
  no haya declarado como dependencia propia, incluso si otro paquete del monorepo sí lo tiene
  instalado. Esto **refuerza automáticamente**, sin depender de la disciplina del desarrollador,
  exactamente la frontera que la Decisión 1 busca a nivel de empaquetado. Instalación más rápida y
  con menos uso de disco (beneficio menor para un solo desarrollador, pero gratuito). Instalación
  vía Corepack (incluido en Node moderno) — sin coste real de fricción.
- **yarn Berry/PnP:** el más agresivo eliminando `node_modules` por completo, pero con fricción
  documentada con cierto tooling/extensiones de VS Code que esperan un `node_modules` tradicional
  — coste añadido sin beneficio claro aquí. Yarn Classic (v1) no se recomienda para proyectos
  nuevos.

### Dependencias con otras decisiones
- Acoplado directamente a la Decisión 1 (workspaces) — el soporte de workspaces de pnpm es maduro
  y bien documentado.
- Neutral respecto a la Decisión 3 y la Decisión 4.

### Consecuencias de cambiarlo después
- Cambiar de gestor de paquetes más adelante es de bajo riesgo para un proyecto pequeño (borrar
  lockfile + `node_modules`, reinstalar), pero provoca un cambio de lockfile puntual — mejor
  elegir bien ahora que cambiar luego sin necesidad.

### Recomendación
**pnpm**, precisamente porque su aislamiento estricto de dependencias es un refuerzo concreto —no
hipotético— de la frontera de confianza que ya es central en este proyecto (DEC-004), sin coste de
fricción real gracias a Corepack.

---

## Decisión 3 — Mecanismo de IPC entre Core y Secrets Broker

Esta es la decisión más consecuente de las cinco: define el contrato real entre los dos procesos
que DEC-004 exige mantener separados.

### Alternativas
- **A. Named pipe de Windows** (`\\.\pipe\agentforge-secrets`), accesible desde Node vía el módulo
  `net` (la misma API que sockets Unix, con una ruta de pipe específica de Windows), con control de
  acceso mediante ACLs de Windows sobre el propio pipe.
- **B. TCP local (loopback 127.0.0.1) con autenticación por token**, generado/rotado por el
  Secrets Broker y compartido con Core vía un fichero con permisos restringidos.
- **C. Socket de dominio Unix** — soportado en compilaciones recientes de Windows 10+, pero mucho
  menos estándar/probado en Windows que los named pipes.
- **D. Pipe stdio** (Core lanza al Secrets Broker como proceso hijo y se comunican por
  stdin/stdout) — **incompatible en la práctica con DEC-004**: lanzar un proceso hijo bajo un
  usuario de Windows distinto requiere mecanismos de elevación (`runas`, tarea programada), no un
  simple `spawn()`; y si Core tuviera capacidad de lanzar procesos como otro usuario, esa misma
  capacidad sería en sí misma un riesgo de escalada de privilegios si Core quedara comprometido.
  Se descarta por esta razón, no solo por preferencia técnica.

### Ventajas / desventajas para AgentForge
- **A (named pipe):** mecanismo de IPC nativo de Windows, sin ningún puerto de red abierto — nada
  escucha en TCP, lo que reduce la superficie de ataque (ningún otro proceso de la red, ni
  siquiera local, puede intentar conectar por un puerto). Las ACLs del propio pipe permiten
  restringir la conexión a un usuario/SID concreto — es decir, la frontera "solo Core puede hablar
  con el Broker" se aplica **a nivel de sistema operativo**, no solo mediante un token a nivel de
  aplicación. Encaja de forma natural y directa con el espíritu de DEC-004.
- **B (TCP+token):** más simple conceptualmente y 100% multiplataforma (relevante solo si en el
  futuro Core necesitara correr en Linux/macOS, lo cual no está previsto ahora). Un puerto de
  loopback, aunque limitado a 127.0.0.1, es agnóstico al proceso que se conecta — la protección
  depende de que el token se mantenga secreto y el fichero del token tenga permisos correctos, no
  de una ACL aplicada por el sistema operativo al canal mismo. Frontera algo más débil que A,
  aunque razonable con buena higiene de tokens. Más fácil de depurar (se puede probar con `curl`).
- **C (Unix socket en Windows):** soporte más reciente y menos probado en el ecosistema Windows
  que los named pipes — sin ventaja clara sobre A para este caso de uso.
- **D (stdio):** descartada, ver arriba.

### Dependencias con otras decisiones
- Se apoya en la Decisión 1: el código cliente/servidor de IPC y el esquema de mensajes
  compartido (p. ej. "solicita la credencial X para la ejecución Y ya aprobada") viven de forma
  natural en `packages/shared`.
- Independiente de la Decisión 2 y la Decisión 4.

### Consecuencias de cambiarlo después
Esta es la decisión más cara de cambiar sin mitigación, porque tanto Core como el Secrets Broker
tendrían implementaciones concretas contra el transporte elegido. **Mitigación propuesta,
independiente de cuál se elija ahora:** definir una interfaz pequeña y agnóstica del transporte en
`packages/shared` (p. ej. algo conceptualmente equivalente a
`SecretsBrokerClient.request(mensaje): Promise<respuesta>`), de modo que ambos procesos programen
contra esa interfaz y no directamente contra `net.connect(...)` o `fetch(...)`. Esto no elimina el
coste de cambiar de transporte más adelante, pero lo acota a la implementación de esa interfaz, no
a todo el código que la usa.

### Recomendación (preliminar, ampliada más abajo)
**A — Named pipe de Windows con ACL restringida al usuario del Secrets Broker y al usuario de
Core**, envuelto desde el principio detrás de una interfaz agnóstica del transporte en
`packages/shared` (mitigación de la consecuencia señalada arriba). Es la opción que mejor cumple
el requisito 3 (separación real, reforzada por el sistema operativo, no solo por convención) sin
comprometer la posibilidad de cambiar de transporte más adelante sin reescritura generalizada.

### Ampliación solicitada — multiplataforma (Windows / Linux / futuro macOS)

**Contexto que cambia el análisis:** el análisis original de la Decisión 3 se escribió pensando
implícitamente en Windows como único SO de ejecución (es el entorno de desarrollo actual — ver
`STATE.md`, Platform: win32). El proyecto, sin embargo, tiene como objetivo declarado (ver
`README.md`) ejecutar/ejecutarse también sobre sistemas remotos como el **Debian de casa** (Fase 7
del roadmap prevé SSH hacia esa máquina). Esto no significa automáticamente que Core y el Secrets
Broker vayan a correr *en* Linux — hay que distinguir dos cosas distintas:

- **Dónde corren Core y Secrets Broker** (la máquina que aloja AgentForge): hoy, con certeza,
  Windows. No hay ninguna DECISIÓN aprobada de que vaya a correr también en Linux — es una
  posibilidad razonable a futuro, no un hecho.
- **Qué sistemas gestiona AgentForge como destino remoto** (Debian, VPS Contabo): esto es
  ejecución SSH *hacia* esas máquinas (Fase 7), no significa que Core/Secrets Broker se
  desplieguen allí. El IPC Core↔Secrets Broker es local a la máquina donde corre AgentForge, sea
  cual sea.

Dicho esto, es razonable que a medio plazo el propio desarrollador quiera correr AgentForge en el
Debian de casa (no solo usarlo como destino SSH) — por eso vale la pena diseñar la abstracción
ahora, aunque la implementación concreta que se active hoy sea solo la de Windows.

**1. Cómo funcionaría en Windows:**
Named pipe (`\\.\pipe\agentforge-secrets`) creado por el Secrets Broker con una ACL (Windows
`SECURITY_ATTRIBUTES`/DACL) que solo concede acceso de conexión al SID del usuario de Windows bajo
el que corre Core (y al propio SID del Broker). Node lo expone vía el módulo `net` (`net.connect()`
a una ruta de pipe en vez de a un host:puerto — misma API que un socket). No hay puerto TCP
abierto en ningún momento. La aplicación de la frontera ("solo Core puede hablar con el Broker") la
hace el kernel de Windows al aceptar o rechazar la conexión, no código de aplicación.

**2. Cómo funcionaría en Linux (Core y Secrets Broker):**
El equivalente directo y estándar en Linux es un **Unix domain socket** (p. ej.
`/run/agentforge/secrets.sock`, o `$XDG_RUNTIME_DIR/agentforge/secrets.sock` para un socket por
usuario sin requerir privilegios de root), con permisos de fichero (`chmod`/propietario:grupo) que
restringen qué usuario del sistema puede conectar — el mismo principio que la ACL del named pipe en
Windows, aplicado con el mecanismo nativo de Linux. Node soporta Unix domain sockets de forma
nativa con el mismo módulo `net`, con la misma forma de API que en Windows (`net.connect({path})`).
Es decir: **no es una alternativa exótica** — es el mecanismo estándar de facto para IPC local con
control de acceso a nivel de SO en Linux, con el mismo nivel de garantía que el named pipe en
Windows (aplicación de la frontera por el kernel/sistema de ficheros, no por token de aplicación).

**3. ¿Diseñar ya una abstracción multiplataforma? ¿Qué implementación por SO?**
Sí, tiene sentido diseñar la interfaz agnóstica de transporte (ya propuesta en el análisis original,
en `packages/shared`) teniendo en cuenta desde ahora que tendrá **dos implementaciones nativas**, no
una:
- `packages/shared`: interfaz `SecretsBrokerTransport` (o equivalente) con métodos como
  `connect()`/`request(mensaje)`, sin ninguna referencia a rutas de pipe ni de socket.
- Implementación Windows: named pipe + ACL (como ya se describió).
- Implementación Linux: Unix domain socket + permisos de fichero/directorio.
- Selección de implementación en tiempo de ejecución mediante `process.platform` (patrón estándar
  en Node para este tipo de diferencia de SO) — sin lógica condicional dispersa por el código de
  Core o del Broker, solo en el punto donde se instancia el transporte.

Esto es coherente con el principio de "evitar complejidad prematura sin generar rehacer trabajo":
no hace falta *implementar* la variante Linux ahora (Windows es el único SO real hoy, y no hay
decisión de ejecutar AgentForge en Linux), pero sí conviene que la interfaz no dé por hecho
implícitamente conceptos exclusivos de Windows (p. ej. no debe filtrar "ACL de Windows" como
concepto de la interfaz — debe hablar de "control de acceso al canal", con cada implementación
resolviéndolo a su manera nativa).

**4. ¿Mantiene intacta la frontera de seguridad de DEC-004?**
Sí, en ambos sistemas operativos, con el mismo nivel de garantía — y esto es clave: ni la ACL de
Windows ni los permisos de Unix socket son "casi tan buenos", son **el mecanismo nativo
equivalente** en cada SO para lo mismo (control de acceso al canal de IPC aplicado por el sistema
operativo, no por la aplicación). DEC-004 exige que el Secrets Broker sea un proceso separado bajo
un usuario de SO propio — ambas implementaciones cumplen ese requisito de la misma forma: solo el
usuario de SO de Core puede conectar al canal del Broker, verificado por el kernel antes de que
llegue una sola línea de código de aplicación. Un matiz a documentar como PENDIENTE (no bloqueante
para esta decisión): en Linux, si Core y Secrets Broker corrieran dentro de contenedores o
namespaces distintos en vez de como usuarios Linux distintos en el mismo host, el modelo de
aislamiento cambiaría (namespaces de filesystem, no solo permisos de usuario) — esto no está
decidido ni es relevante hoy (no hay containerización prevista en ninguna fase del roadmap actual),
se menciona solo para no dar por hecho que "Linux" implica un único modelo de despliegue.

**5. Impacto de añadir macOS en el futuro:**
Bajo. macOS es, a efectos de este mecanismo, un Unix — soporta Unix domain sockets de forma nativa
con la misma semántica de permisos de fichero que Linux. La implementación "Linux" del transporte
(Unix domain socket + permisos) funcionaría en macOS sin cambios de diseño, probablemente sin
cambios de código (Node abstrae la diferencia). El único matiz es la ruta convencional del socket
(macOS no tiene `/run` ni `$XDG_RUNTIME_DIR` estándar — se usaría algo como
`~/Library/Application Support/AgentForge/` o `/tmp` con permisos restrictivos, a decidir cuando/si
se aborde macOS realmente). No supone rediseñar la interfaz de `packages/shared`, solo añadir una
tercera rama de configuración de ruta si hiciera falta. No es una decisión a tomar ahora — es
simplemente la constatación de que la abstracción elegida no genera coste adicional relevante si
macOS entra en el futuro.

**6. ¿Alternativa más simple con seguridad equivalente?**
Se revisó explícitamente si existe algo más simple que "dos implementaciones nativas detrás de una
interfaz" con el mismo nivel de seguridad:
- **TCP loopback + token (opción B del análisis original)** sí sería más simple de implementar
  (una sola implementación, 100% multiplataforma sin ramas por SO) — pero, como ya se documentó,
  la frontera de seguridad que ofrece es estrictamente más débil: la protección depende de que el
  token se mantenga secreto y de los permisos del fichero que lo contiene, no de una aplicación de
  la frontera por el sistema operativo sobre el canal mismo. No es "seguridad equivalente" — es un
  nivel de seguridad distinto (y menor) a cambio de simplicidad de implementación. No cumple la
  pregunta tal como está planteada (misma seguridad, más simple), así que se descarta como
  respuesta a este punto.
- No se ha identificado ninguna alternativa que iguale la garantía de "aplicación de la frontera
  por el SO sobre el canal" con menos código que "socket/pipe nativo + control de acceso nativo del
  SO". La aparente complejidad añadida (dos implementaciones) es, en la práctica, pequeña: ambas
  usan el mismo módulo `net` de Node con una API casi idéntica (`net.connect({path: ...})` en
  ambos casos) — la diferencia real de código es la ruta del canal y la forma de fijar permisos, no
  dos mecanismos de IPC conceptualmente distintos.

### Recomendación final (Decisión 3, tras la ampliación)
**Se mantiene la recomendación — Named pipe (Windows) / Unix domain socket (Linux, y macOS sin
cambios adicionales) con control de acceso nativo del SO**, unificados detrás de la misma interfaz
agnóstica de transporte en `packages/shared` ya propuesta. Cambio respecto al análisis original: se
precisa que la interfaz debe diseñarse **desde el principio como multiplataforma en su vocabulario**
(sin filtrar conceptos específicos de Windows), aunque hoy solo se implemente y active la variante
Windows, dado que es el único SO real de ejecución confirmado. No se propone implementar la
variante Linux/macOS todavía — solo que la interfaz no la excluya por diseño, para que añadirla más
adelante sea "una implementación nueva del mismo contrato", no un rediseño.

No se registra ninguna decisión nueva ni se crea ningún fichero — esta ampliación queda como parte
de este mismo documento de análisis, pendiente de tu aprobación junto con el resto.

---

## Decisión 4 — Convenciones de código

### Alternativas
- **Linter/formatter:** ESLint + Prettier (el más establecido, mayor cobertura de plugins,
  incluidos plugins de seguridad como `eslint-plugin-security` o reglas anti-fuga-de-secretos) vs.
  Biome (más rápido, combina lint+format en una herramienta, ecosistema de plugins todavía más
  limitado).
- **Configuración de TypeScript:** `strict: true` desde el principio vs. configuración laxa que se
  endurece más adelante.
- **Framework de testing:** Vitest (moderno, rápido, ESM-first, API compatible con Jest, buen
  soporte de TS/monorepo) vs. Jest (más veterano, algo más de fricción con ESM/TS) vs.
  `node:test` (sin dependencias, pero ecosistema de mocking/cobertura menos maduro).

### Ventajas / desventajas para AgentForge
- **ESLint+Prettier:** algo más lento y con más ficheros de configuración que Biome, pero mucho
  más probado para un monorepo TypeScript+Node, y con plugins de seguridad directamente relevantes
  para un proyecto cuyo `SECURITY.md` insiste en higiene de secretos. A esta escala (un
  desarrollador, código todavía pequeño), la velocidad de lint no es un cuello de botella real —
  la madurez del ecosistema pesa más.
- **TypeScript estricto desde el principio:** coste prácticamente nulo en un proyecto nuevo sin
  código heredado; beneficio real y continuo (una clase de errores de null/undefined
  particularmente relevante en un Policy Engine que valida entradas no confiables). Endurecerlo
  más adelante sobre una base de código ya crecida sería desproporcionadamente más costoso que
  empezar así.
- **Vitest:** mejor encaje — moderno, rápido, soporte nativo de TS/ESM, API compatible con Jest
  (el conocimiento/documentación de Jest sigue siendo útil), buen soporte de monorepo (tests por
  paquete o todos a la vez). `node:test` es tentador por no añadir dependencias, pero su
  ecosistema de mocking/cobertura todavía es menos maduro — no compensa para un proyecto que
  necesitará buena cobertura de pruebas en componentes sensibles a la seguridad.

### Dependencias con otras decisiones
- Necesita la Decisión 1 resuelta primero: las configuraciones base (`tsconfig.base.json`,
  configuración raíz de ESLint) viven en la raíz del monorepo y cada paquete las extiende.
- Independiente de la Decisión 2 y la Decisión 3.

### Consecuencias de cambiarlo después
- Cambiar de linter/formatter más adelante provoca un diff grande de una sola vez (reformatear
  todo el código existente) — molesto pero mecánico, riesgo bajo.
- Cambiar de framework de testing más adelante implica reescribir los ficheros de test existentes
  — coste real pero acotado; mejor elegir bien ahora que no hay tests que migrar.

### Recomendación
**ESLint + Prettier**, **TypeScript en modo estricto desde el principio**, **Vitest** como
framework de testing. Se propone considerar `eslint-plugin-security` como parte del hardening de
una fase posterior (Fase 13 del roadmap), no como requisito de esta fase.

---

## Decisión 5 — ¿Crear ya el esqueleto de carpetas, o esperar?

### Alternativas
- **A. Crear el esqueleto ahora**, en cuanto se aprueben las decisiones 1-4 (estructura de
  carpetas, `package.json` por paquete, configuración base — sin lógica).
- **B. Tratar esta fase como puramente de decisión/documentación**, y crear el esqueleto en un
  paso posterior, explícitamente autorizado y presentado para revisión antes de ejecutarlo (mismo
  patrón que se ha seguido en todas las fases anteriores: proponer → decidir → solo entonces
  actuar, con confirmación explícita en cada paso).

### Ventajas / desventajas
- **A:** avanza más rápido, cierra la Fase 2 en un solo bloque de trabajo.
- **B:** mantiene la coherencia con el ritmo que el propio usuario ha marcado en todas las fases
  anteriores (incluida esta petición explícita: "No crees todavía carpetas, archivos ni código" /
  "todavía NO queremos implementar funcionalidad"), y permite revisar el árbol exacto de carpetas
  y el contenido exacto de cada `package.json` antes de que exista, igual que se revisó el stack
  tecnológico antes de aprobarlo.

### Dependencias con otras decisiones
Ninguna técnica — es puramente de secuenciación. Depende de que las decisiones 1-4 estén
aprobadas para poder presentar un árbol de carpetas concreto que revisar.

### Consecuencias de cambiarlo después
Ninguna relevante — es una cuestión de orden de trabajo, no de arquitectura.

### Recomendación
**B — Esperar.** Coherente con el ritmo ya establecido en todo el proyecto y con la instrucción
explícita del usuario en este mismo mensaje. Una vez aprobadas las decisiones 1-4, se presentará
el árbol de carpetas y el contenido propuesto de cada fichero de configuración para revisión,
antes de crear nada.

---

## Propuesta final coherente (conjunto de las 5 decisiones)

1. **Monorepo con workspaces**: `packages/shared`, `packages/core`, `packages/secrets-broker`,
   con espacio explícito para añadir `packages/mcp-<nombre>` / `packages/execution-<nombre>` según
   crezca el catálogo de herramientas (sin tocar los paquetes existentes al añadir uno nuevo).
2. **pnpm** como gestor de paquetes, por su aislamiento estricto de dependencias — refuerza
   automáticamente, a nivel de empaquetado, la misma frontera de confianza que DEC-004 exige en
   tiempo de ejecución.
3. **Named pipe de Windows con ACL** para la comunicación Core↔Secrets Broker, envuelto desde el
   principio detrás de una interfaz agnóstica del transporte en `packages/shared`, para que un
   cambio de transporte futuro (si hiciera falta) quede acotado a una sola implementación.
4. **ESLint + Prettier, TypeScript estricto desde el principio, Vitest** como convenciones de
   código compartidas, definidas en la raíz del monorepo y extendidas por cada paquete.
5. **No crear todavía ningún fichero ni carpeta.** Presentar el árbol de carpetas y el contenido
   propuesto de configuración para revisión explícita una vez aprobadas las decisiones 1-4, como
   paso separado y autorizado por el usuario.

**Coherencia del conjunto con los requisitos del usuario:**
- *Un solo desarrollador:* ninguna pieza introduce infraestructura de equipo/orquestación
  (sin Nx/Turborepo, sin CI/CD todavía, sin gestor de secretos empresarial).
- *Core y Secrets Broker como procesos separados:* reforzado en tres capas distintas —
  empaquetado (paquetes npm/pnpm separados con dependencias propias), instalación (pnpm impide
  dependencias fantasma entre paquetes), y tiempo de ejecución (named pipe con ACL, no solo un
  token de aplicación).
- *Evitar complejidad prematura sin generar rehacer trabajo:* cada elección tiene una vía de
  cambio futuro acotada y explícita (workspaces → nada que migrar si se añade un paquete;
  IPC → interfaz agnóstica ya prevista; testing/lint → coste de cambio bajo por ser greenfield).
- *Crecimiento futuro (más MCP servers, execution backends, Policy Engine, Audit Log,
  multiusuario):* la estructura de paquetes está diseñada explícitamente para absorber esto por
  adición, no por reestructuración.
- *Sin implementar funcionalidad todavía:* ningún fichero de código, ninguna carpeta creada en
  este documento.
