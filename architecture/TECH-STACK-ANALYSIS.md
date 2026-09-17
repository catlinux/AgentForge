# Análisis de stack tecnológico — AgentForge (Fase 1)

> **DECIDIDO (DEC-007, 2026-09-16):** TypeScript/Node.js, siguiendo la recomendación de la
> sección 4. Ver `decisions/DECISIONS.md` para el registro formal de la decisión. Este documento
> se conserva íntegro como registro del análisis que la fundamenta.

Complementa `architecture/ARCHITECTURE.md` §17, que dejó el stack tecnológico como la pregunta
abierta más importante de la Fase 1. Traducción al inglés disponible en
`architecture/TECH-STACK-ANALYSIS.en.md` (DEC-079, Fase 15).

**Fecha:** 2026-09-16.

---

## 1. Restricciones que vienen de la arquitectura ya aprobada

Estas no son preferencias, son consecuencias directas de DEC-003 a DEC-006
(`decisions/DECISIONS.md`) y por tanto **condicionan** cualquier elección de stack:

1. **DEC-003 (extensión in-place):** el mecanismo de transporte principal hacia Claude Code es
   MCP (servidores propios) — el SDK MCP disponible en el lenguaje elegido debe ser sólido, no
   experimental.
2. **DEC-005 (MCP Modern-only):** se necesita soporte confirmado para la especificación
   `2026-07-28`. La investigación de la Fase 0 (`docs/research/MCP-ANALYSIS.md` §8) solo
   **verificó directamente** como Tier 1 maduro los SDKs oficiales de **TypeScript** y
   **Python**. Los SDKs de Go, C# y Rust se citan como "Tier 1" en el blog de release de MCP, pero
   la investigación los marcó explícitamente `NOT VERIFIED` en cuanto a madurez real,
   documentación y estabilidad — no se ha comprobado directamente su repositorio.
3. **DEC-004 (Secrets Broker como proceso separado, usuario de SO propio):** el stack debe
   permitir con razonable sencillez ejecutar dos procesos independientes en Windows bajo
   identidades de usuario distintas, y que uno de ellos pueda acceder a Windows Credential Manager
   para custodiar la clave SSH/passphrase (`architecture/ARCHITECTURE.md` §8).
4. **DEC-006 (SSH con claves dedicadas por host):** se necesita una librería cliente SSH madura,
   con buen soporte de captura separada de stdout/stderr/exit code y timeouts diferenciados
   (conexión vs. ejecución) — la investigación de Fase 0 (`research/SSH-SECURITY-NOTES.md` §3)
   documentó específicamente que Paramiko (Python) tiene limitaciones conocidas y reportadas en
   esta combinación exacta (timeout + exit code fiable simultáneamente).
5. **Entorno de desarrollo:** Windows 11 + VS Code, un solo desarrollador, local-first, sin
   infraestructura de servidor adicional (`DEVELOPMENT.md`).
6. **Principio explícito del usuario para esta fase:** evitar complejidad innecesaria.

---

## 2. Candidatos evaluados

### TypeScript / Node.js

- **MCP:** SDK oficial Tier 1, confirmado maduro (`docs/research/MCP-ANALYSIS.md` §8) — licencia
  Apache 2.0 (código nuevo) / MIT (código existente), con guía de migración a v2 documentada.
- **SSH:** paquete `ssh2` — maduro, ampliamente usado en producción, sin las limitaciones de
  timeout/exit-code documentadas para Paramiko.
- **Windows Credential Manager:** varias librerías (`keytar` y sucesores, wrappers nativos vía
  N-API) permiten acceso directo; alternativa: invocar `cmdkey`/PowerShell desde el proceso.
- **Separación de procesos/usuario (DEC-004):** un ejecutable Node por componente, lanzado bajo
  una cuenta de Windows distinta (Programador de tareas / `runas` / servicio de Windows vía
  `node-windows`). Requiere que Node esté disponible en el `PATH` de esa cuenta — pequeño coste de
  configuración, no bloqueante.
- **Modelo de concurrencia:** E/S asíncrona nativa, encaja bien con un servidor MCP que atiende
  llamadas de herramientas y, potencialmente, hooks HTTP en paralelo.
- **Tipado:** TypeScript da tipado estático — relevante para un gateway centrado en validar
  schemas de herramientas y aplicar política, donde los errores de tipos tienen coste de
  seguridad, no solo de corrección.
- **Ecosistema:** el más amplio de los candidatos para servidores HTTP pequeños (hooks) y
  herramientas de línea de comandos.
- **Riesgo/complejidad:** el ecosistema npm es grande y heterogéneo — requiere disciplina para no
  acumular dependencias innecesarias (contrario al principio de "evitar dependencias
  innecesarias" de `README.md`), pero esto es una cuestión de disciplina de proyecto, no una
  limitación del lenguaje.

### Python

- **MCP:** SDK oficial Tier 1, confirmado maduro (`docs/research/MCP-ANALYSIS.md` §8) — licencia
  MIT, con guía de migración a v2 documentada. Paquete `mcp[cli]` bien documentado.
- **SSH:** Paramiko es la opción estándar, pero la investigación de Fase 0
  (`research/SSH-SECURITY-NOTES.md` §3) documentó específicamente limitaciones conocidas
  (combinar timeout fiable + captura de exit code requiere lógica adicional de buffering/polling,
  con issues reales reportados). Existen wrappers de terceros (`exec-helpers`) que mitigan esto,
  añadiendo una dependencia más.
- **Windows Credential Manager:** la librería `keyring` da acceso directo y portable (funciona
  igual en Windows/macOS/Linux si en el futuro hiciera falta), de forma más simple que la mayoría
  de alternativas en otros lenguajes.
- **Separación de procesos/usuario (DEC-004):** igual de viable que Node — un script/ejecutable
  Python por componente, bajo cuenta de Windows distinta. Empaquetar como ejecutable único (si se
  quisiera evitar depender de que Python esté instalado en la otra cuenta) es algo más laborioso
  que en Node (herramientas tipo PyInstaller existen pero añaden un paso de build adicional).
- **Modelo de concurrencia:** soporte async disponible (`asyncio`, y el SDK MCP lo usa), aunque el
  ecosistema es algo menos uniforme que el de Node en este aspecto.
- **Tipado:** tipado gradual (type hints + mypy opcional) — menos estricto por defecto que
  TypeScript, aunque totalmente viable si se adopta con disciplina.
- **Legibilidad/curva de entrada:** sintaxis generalmente considerada más simple para scripts
  cortos y lógica de automatización — relevante si se prioriza velocidad de iteración sobre
  garantías de tipado en fases tempranas.

### Go

- **MCP:** SDK citado como Tier 1 en el blog de release, mantenido "en colaboración con Google"
  según fuentes secundarias — pero **no verificado directamente** en la Fase 0
  (`docs/research/MCP-ANALYSIS.md` §8, marcado `NOT VERIFIED`). Introduce riesgo real: apostar el
  mecanismo de transporte principal (MCP, por DEC-003) a un SDK cuya madurez no se ha comprobado.
- **SSH:** `golang.org/x/crypto/ssh` es una librería sólida y muy usada, sin los problemas
  documentados de Paramiko.
- **Despliegue:** compila a un único binario estático — encaja muy bien con el requisito de DEC-004
  (proceso separado bajo otro usuario: solo hay que copiar un `.exe`, sin runtime que instalar en
  la otra cuenta de Windows). Esta es la ventaja más clara de Go para este proyecto concreto.
- **Windows Credential Manager:** librerías de terceros existen (p. ej. `go-keyring`), pero con
  menos uso/mantenimiento verificado que sus equivalentes en Node/Python.
- **Complejidad añadida:** un segundo lenguaje si se combina con TS/Python para otras partes (ver
  §3) — el usuario pidió explícitamente evitar complejidad innecesaria, y esto es una razón para
  no elegir Go como stack único salvo que el SDK MCP de Go se verifique primero directamente.

### Rust

- **MCP:** SDK descrito como "Beta" por una fuente secundaria (`docs/research/MCP-ANALYSIS.md`
  §8, `NOT VERIFIED`) — el candidato menos maduro de los cinco en este aspecto concreto.
- **SSH:** existen crates maduras (`ssh2`, que envuelve libssh2; `russh`, pura en Rust).
- **Seguridad de memoria:** el más fuerte de los cinco candidatos en garantías de seguridad a nivel
  de lenguaje — relevante en teoría para el Secrets Broker, que es el componente más sensible.
- **Despliegue:** binario único estático, igual de bien posicionado que Go para DEC-004.
- **Curva de aprendizaje:** la más alta de los cinco candidatos — coste real de velocidad de
  iteración para un proyecto de un solo desarrollador en fase de diseño activo.
- **Valoración:** buen candidato **futuro** para un componente aislado y crítico (p. ej. reescribir
  solo el Secrets Broker en Rust más adelante, gracias a que la arquitectura ya aprobada lo trata
  como proceso independiente) — prematuro como stack de partida para todo el proyecto en la Fase 1,
  precisamente por el principio de evitar complejidad innecesaria.

### C# / .NET

- **MCP:** SDK citado como Tier 1, mantenido "en colaboración con Microsoft" según fuentes
  secundarias — igual que Go, **no verificado directamente** en la Fase 0 (`NOT VERIFIED`).
- **SSH:** `SSH.NET` es una librería madura y ampliamente usada en el ecosistema .NET.
- **Integración nativa con Windows:** la más fuerte de los cinco candidatos — acceso directo a
  Windows Credential Manager vía APIs nativas, soporte de primera clase para Windows Services y
  cuentas de servicio (encaja muy bien con DEC-004), tooling de VS Code para C#/.NET maduro.
- **Despliegue:** puede compilar a ejecutable único (`dotnet publish` con
  `PublishSingleFile`/AOT), similar a Go/Rust en ese aspecto.
- **Complejidad añadida:** igual que Go, sería un segundo lenguaje si se combina con TS/Python
  para el resto — mismo argumento en contra como stack único mientras el SDK MCP no se verifique.
- **Contexto:** técnicamente muy sólido para este proyecto concreto (Windows-first), pero el
  riesgo de MCP no verificado pesa más que la ventaja de integración nativa en esta fase.

---

## 3. Consideración explícita: ¿stack único o políglota?

El usuario pidió evitar complejidad innecesaria. Un stack políglota (p. ej. Go para el Secrets
Broker + TypeScript para los servidores MCP) tiene una ventaja real — aprovechar el punto fuerte
de cada lenguaje para cada componente — pero un coste también real para un proyecto de un solo
desarrollador: dos toolchains, dos ecosistemas de dependencias, y un contrato de IPC entre
lenguajes que mantener (`architecture/ARCHITECTURE.md` §3, §8, §18 ya señalan el mecanismo de IPC
como pregunta abierta).

**PROPOSAL de este análisis:** empezar con **un único lenguaje** para todo (AgentForge Core,
servidores MCP, y el propio Secrets Broker como proceso separado pero en el mismo lenguaje), y
reconsiderar un componente políglota **solo si** en el futuro se justifica concretamente (p. ej.
si el Secrets Broker necesita garantías de seguridad que el lenguaje elegido no puede dar con
razonable esfuerzo). La arquitectura ya aprobada (procesos separados, comunicación por IPC/mensaje,
sin acoplamiento de código entre componentes) hace que este cambio futuro sea posible sin
rediseñar nada si llegara a hacer falta — no es una decisión irreversible.

---

## 4. Recomendación razonada

Dadas las restricciones de la sección 1 y el principio explícito de evitar complejidad
innecesaria:

**Recomendación: TypeScript/Node.js como stack único para la Fase 1**, con **Python como
alternativa igualmente válida** si el usuario tiene preferencia o experiencia previa relevante.

Razones para la recomendación (no una decisión, solo la justificación):
1. Es uno de los dos únicos SDKs MCP verificados como maduros en la investigación de Fase 0 —
   igual que Python, pero con la ventaja adicional de que el modelo de E/S asíncrona nativa de
   Node encaja de forma más directa con un servidor MCP/HTTP que debe atender múltiples llamadas
   concurrentes.
2. La librería SSH (`ssh2`) no tiene las limitaciones de timeout/exit-code documentadas para
   Paramiko en la propia investigación de este proyecto — evita un problema ya identificado, no
   hipotético.
3. El tipado estático de TypeScript reduce una clase de errores relevante para un componente cuya
   función central es validar y aplicar política sobre llamadas a herramientas.
4. Go, Rust y C# tienen ventajas reales para DEC-004 (binario único, mejor story de "proceso bajo
   otro usuario sin runtime que instalar"), pero **su SDK MCP no está verificado** — dado que MCP
   es el transporte principal por DEC-003, este es un riesgo que no compensa la ventaja de
   despliegue en la fase 1. Ese riesgo desaparecería si se decide verificar directamente uno de
   esos SDKs antes de comprometerse (ver §5).

**Si el usuario prefiere Python** (por ejemplo, por familiaridad previa o por preferencia
personal), la recomendación cambiaría a: Python + librería `keyring` para credenciales +
`exec-helpers` (o una capa propia fina) para mitigar las limitaciones conocidas de Paramiko. Es una
alternativa igualmente sólida, no una segunda opción — la elección entre TypeScript y Python en
este proyecto concreto depende más de preferencia/familiaridad del único desarrollador que de una
diferencia técnica decisiva.

---

## 5. Qué NO decide este documento

- No elige un framework HTTP concreto dentro del lenguaje ganador (p. ej. Express/Fastify en
  Node, FastAPI/Flask en Python) — se propone posponer esa elección de detalle hasta que empiece
  la implementación real (Fase 2), evitando decidir de más en esta fase.
- No verifica directamente los SDKs MCP de Go/Rust/C# — si el usuario tiene interés particular en
  alguno de ellos pese al riesgo señalado, se propone como siguiente paso una verificación directa
  (no una re-investigación completa) antes de descartarlos definitivamente.
- No decide el mecanismo exacto de IPC entre AgentForge Core y el Secrets Broker
  (`architecture/ARCHITECTURE.md` §3/§8/§18 lo deja como pregunta abierta) — aunque el stack
  elegido influye en qué opciones son más naturales (named pipes de Windows son razonablemente
  accesibles tanto desde Node como desde Python).
