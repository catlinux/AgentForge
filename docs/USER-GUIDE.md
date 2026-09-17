# Manual de usuario — AgentForge

Este manual explica, paso a paso y desde cero, cómo instalar, configurar, arrancar y usar
AgentForge en un equipo Windows real, conectado a Claude Code vía MCP. Corresponde al estado real
del código tras la Fase 16 (release `0.1.0` + entrypoints reales). Si algo aquí no coincide con el
código, el código manda — ver `STATE.md`/`decisions/DECISIONS.md` para el estado autorizado.

**Alcance de este manual:** uso real en un único equipo, un único operador, contra un host SSH y
una cuenta de GitHub controlados por ti. No cubre despliegue multiusuario, multiservidor, ni
ningún escenario no soportado por la arquitectura actual (ver la sección "Limitaciones" al final).

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Instalación del proyecto](#2-instalación-del-proyecto)
3. [Configuración inicial: `AGENTFORGE_DATA_DIR`](#3-configuración-inicial-agentforge_data_dir)
4. [Secrets Broker: dar de alta tus credenciales](#4-secrets-broker-dar-de-alta-tus-credenciales)
5. [Configurar hosts SSH](#5-configurar-hosts-ssh)
6. [Configurar el conector de GitHub](#6-configurar-el-conector-de-github)
7. [Registro de tools (Tool Registry)](#7-registro-de-tools-tool-registry)
8. [Discovery: qué tools se exponen al agente](#8-discovery-qué-tools-se-exponen-al-agente)
9. [Policy Engine: clasificar el riesgo](#9-policy-engine-clasificar-el-riesgo)
10. [Arrancar los procesos, en orden](#10-arrancar-los-procesos-en-orden)
11. [Conectar AgentForge con Claude Code (MCP)](#11-conectar-agentforge-con-claude-code-mcp)
12. [Comprobar que todo funciona](#12-comprobar-que-todo-funciona)
13. [Usar las tools desde Claude Code](#13-usar-las-tools-desde-claude-code)
14. [El Dashboard](#14-el-dashboard)
15. [Confirmación humana](#15-confirmación-humana)
16. [Audit Log](#16-audit-log)
17. [Detener y reiniciar](#17-detener-y-reiniciar)
18. [Troubleshooting](#18-troubleshooting)
19. [Limitaciones actuales y partes Windows-only](#19-limitaciones-actuales-y-partes-windows-only)

---

## 1. Requisitos previos

- **Windows** (la única plataforma verificada realmente hoy — ver sección 19).
- **Node.js** y **pnpm** (gestor de paquetes del monorepo, DEC-009, vía Corepack).
- **Claude Code** instalado, si quieres conectar AgentForge como servidor MCP.
- Para usar `execution-ssh` de verdad: un host remoto accesible por SSH con una clave `ed25519`
  **dedicada a AgentForge** (DEC-006) — nunca reutilices una clave personal. Genérala ahora, antes
  de seguir, si todavía no la tienes:

  ```powershell
  ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\agentforge_ed25519" -C "agentforge"
  ```

  Esto crea `agentforge_ed25519` (clave privada) y `agentforge_ed25519.pub` (clave pública) en tu
  carpeta `.ssh`. Añade el contenido de `agentforge_ed25519.pub` a
  `~/.ssh/authorized_keys` del usuario remoto en tu host SSH (fuera del alcance de este manual —
  es configuración del host remoto, no de AgentForge). Guardas la ruta de la clave **privada**
  para usarla en la sección 4, donde das de alta su contenido en el Secrets Broker.
- Para usar `connector-github` de verdad: un **Personal Access Token** de GitHub con los permisos
  mínimos necesarios para las operaciones que quieras usar (`create_issue`, `list_issues`,
  `comment_on_issue`). Créalo ahora, antes de seguir, desde GitHub → Settings → Developer settings
  → Personal access tokens, si todavía no lo tienes — lo necesitas también en la sección 4.

## 2. Instalación del proyecto

Desde la raíz del repositorio:

```
pnpm install
pnpm run build
```

`pnpm run build` compila los 8 paquetes (`packages/*`), necesario porque cada entrypoint real se
ejecuta desde `dist/`, no desde `src/`.

## 3. Configuración inicial: `AGENTFORGE_DATA_DIR`

Todos los procesos leen y escriben bajo un único directorio de datos, configurable con la
variable de entorno `AGENTFORGE_DATA_DIR`. Si no la defines, el valor por defecto es
`%USERPROFILE%\.agentforge` (`~/.agentforge`).

Define esa variable **en cada terminal donde arranques un proceso de AgentForge**, con el mismo
valor en todas — si arrancas procesos distintos con `AGENTFORGE_DATA_DIR` distinto, no se
encontrarán entre sí (Secrets Broker, configuración de hosts, Registry, etc. son específicos de
ese directorio).

En PowerShell:

```powershell
$env:AGENTFORGE_DATA_DIR = "C:\Users\<tu-usuario>\.agentforge"
```

Estructura real que se va creando dentro de ese directorio a medida que arrancas procesos y creas
configuración (ningún fichero se crea hasta que hace falta):

```
<AGENTFORGE_DATA_DIR>/
├── secrets-broker/
│   ├── master.key            (creado automáticamente al primer arranque del Broker)
│   └── secrets.enc.json      (creado al dar de alta el primer secreto)
├── execution-ssh/
│   └── host-config.json      (lo creas tú — sección 5)
├── connector-github/
│   └── account-config.json   (lo creas tú — sección 6)
├── registry-cache.json       (lo creas tú — sección 7)
├── discovery-config.json     (lo creas tú — sección 8)
├── policy-config.json        (lo creas tú — sección 9)
└── audit/
    ├── mcp-server.jsonl      (creado automáticamente al escribir el primer evento)
    ├── execution-ssh.jsonl
    └── connector-github.jsonl
```

Ningún proceso falla si un fichero de configuración todavía no existe — arranca con una
configuración vacía (cero hosts, cero cuentas, cero tools) en vez de dar error. Esto te permite
arrancar todo primero y configurar después.

## 4. Secrets Broker: dar de alta tus credenciales

El Secrets Broker (`packages/secrets-broker`) es el único componente que guarda credenciales
reales (clave SSH privada, Personal Access Token de GitHub), cifradas en disco (DEC-030,
AES-256-GCM). Ningún otro proceso ve el valor en claro salvo en el momento de usarlo.

**No existe todavía ninguna CLI de administración de secretos** — el Broker expone su API
(`get`/`create`/`update`/`delete`/`exists`/`listMetadata`, DEC-033) como código TypeScript
(`@agentforge/secrets-broker`), pensada para ser usada por el proceso Broker mismo o por un script
corto que tú ejecutes una sola vez. Esto es intencional (DEC-033: sin sobrearquitectura para un
caso de uso de un solo operador) — no es una limitación oculta.

Necesitas ya creados: la clave SSH privada `ed25519` dedicada y el Personal Access Token de GitHub
(ambos de la sección 1) — este paso solo los registra en el Broker, no los genera.

Para dar de alta un secreto, crea un script así (ajusta los valores) y ejecútalo **una vez**,
apuntando al mismo `AGENTFORGE_DATA_DIR` que usarán los procesos reales:

Guarda el script como `seed-secret.mjs` **en la raíz del repositorio** (el import relativo de
abajo depende de esa ubicación — no funciona si lo mueves a otra carpeta o fuera del repo):

```javascript
// seed-secret.mjs — ejecútalo con: node seed-secret.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MasterKeyStore, SecretStore } from "./packages/secrets-broker/dist/index.js";

const dataDir = process.env.AGENTFORGE_DATA_DIR ?? join(process.env.USERPROFILE, ".agentforge");
const masterKeyStore = new MasterKeyStore(join(dataDir, "secrets-broker", "master.key"));
const masterKey = await masterKeyStore.loadOrCreate();
const store = new SecretStore(join(dataDir, "secrets-broker", "secrets.enc.json"), masterKey);

// Ejemplo: clave SSH privada (kind "ssh-key") — la generada en la sección 1
const sshKeyId = await store.create(
  "ssh-key",
  {
    privateKey: readFileSync(
      join(process.env.USERPROFILE, ".ssh", "agentforge_ed25519"),
      "utf-8",
    ),
  },
  undefined,
  "clave SSH para mi-host",
);
console.log("SecretId de la clave SSH:", sshKeyId);

// Ejemplo: Personal Access Token de GitHub (kind "token")
const tokenId = await store.create(
  "token",
  { value: "ghp_xxx..." },
  "github",
  "PAT de GitHub para mi cuenta",
);
console.log("SecretId del token de GitHub:", tokenId);
```

Ejecuta este script desde la raíz del repo tras `pnpm run build` (necesario porque el import
apunta directamente al `dist/` compilado del paquete, no a un nombre de paquete resuelto por
workspace), con `AGENTFORGE_DATA_DIR` ya definida:

```
node seed-secret.mjs
```

Guarda los `SecretId` que imprime — los necesitas en las secciones 5 y 6 (`sshKeySecretId` y
`tokenSecretId`). Borra el script (o al menos el token/clave en texto plano que contenga) después
de usarlo — nunca lo dejes en el repositorio.

`SecretKind` disponibles: `"api-key"`, `"token"`, `"credential"`, `"ssh-key"`, `"generic"`.

## 5. Configurar hosts SSH

Crea `<AGENTFORGE_DATA_DIR>/execution-ssh/host-config.json`:

```json
{
  "hosts": [
    {
      "hostId": "mi-host",
      "hostname": "192.0.2.10",
      "port": 22,
      "username": "agentforge",
      "sshKeySecretId": "<el SecretId de la clave SSH de la sección 4>"
    }
  ],
  "commandTemplates": {
    "mi-tool-identity": {
      "argv": ["systemctl", "restart", "{{service}}"]
    }
  }
}
```

- `hostId` es el identificador que usarás al invocar una tool (parámetro `hostId`).
- `commandTemplates` está indexado por `identity` de la tool (el mismo `identity` que uses en el
  Registry, sección 7) — nunca acepta texto libre del agente (DEC-037): solo sustituye
  `{{parametro}}` por un valor ya tipado, nunca interpreta metacaracteres de shell.
- Usa siempre una clave SSH `ed25519` dedicada a AgentForge, nunca tu clave personal (DEC-006).

## 6. Configurar el conector de GitHub

Crea `<AGENTFORGE_DATA_DIR>/connector-github/account-config.json`:

```json
{
  "accounts": [
    {
      "accountId": "mi-cuenta-github",
      "apiBaseUrl": "https://api.github.com",
      "tokenSecretId": "<el SecretId del token de la sección 4>"
    }
  ],
  "operationTemplates": {
    "mi-tool-crear-issue": {
      "method": "POST",
      "path": "/repos/{{owner}}/{{repo}}/issues",
      "bodyFields": ["title", "body"]
    },
    "mi-tool-listar-issues": {
      "method": "GET",
      "path": "/repos/{{owner}}/{{repo}}/issues",
      "bodyFields": []
    }
  }
}
```

`operationTemplates` está indexado por `identity`, igual que `commandTemplates` en SSH (DEC-062).
Operaciones soportadas hoy: `create_issue`, `list_issues`, `comment_on_issue` (plantilla fija,
nunca método/path/body libre del agente).

## 7. Registro de tools (Tool Registry)

Cada tool que quieras exponer al agente necesita una entrada en
`<AGENTFORGE_DATA_DIR>/registry-cache.json` — es un array de `ToolEntry` (DEC-016). Hoy no existe
ningún descubrimiento automático contra un servidor MCP externo: como AgentForge solo tiene tools
propias (Execution SSH, Connector GitHub), este fichero lo escribes tú directamente.

Ejemplo, para las tools configuradas en las secciones 5 y 6:

```json
[
  {
    "identity": "mi-tool-identity",
    "origin": { "id": "execution-ssh", "kind": "agentforge" },
    "qualifiedName": "execution-ssh:reiniciar-servicio",
    "contract": {
      "description": "Reinicia un servicio systemd en el host remoto configurado.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "hostId": { "type": "string" },
          "service": { "type": "string" }
        },
        "required": ["hostId", "service"]
      }
    },
    "schemaFingerprint": "manual-v1",
    "previousSchemaFingerprint": null,
    "stale": false
  },
  {
    "identity": "mi-tool-crear-issue",
    "origin": { "id": "connector-github", "kind": "agentforge" },
    "qualifiedName": "connector-github:crear-issue",
    "contract": {
      "description": "Crea un issue en un repositorio de GitHub.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "owner": { "type": "string" },
          "repo": { "type": "string" },
          "title": { "type": "string" },
          "body": { "type": "string" }
        },
        "required": ["owner", "repo", "title"]
      }
    },
    "schemaFingerprint": "manual-v1",
    "previousSchemaFingerprint": null,
    "stale": false
  }
]
```

Puntos clave (DEC-016, ver `architecture/ARCHITECTURE.md` §5):

- `identity` es el identificador estable que usan Execution/Policy — **debe coincidir exactamente**
  con la clave usada en `commandTemplates`/`operationTemplates` y en `riskByIdentity` (sección 9).
- `origin.id` **debe ser** `"execution-ssh"` o `"connector-github"` — el servidor MCP enruta la
  ejecución por este campo (DEC-058/059); cualquier otro valor no tiene backend real detrás.
- `qualifiedName` es el nombre que verá el agente en `tools/list` — usa el formato `origen:nombre`
  por convención, aunque el código no lo valida estrictamente.
- `schemaFingerprint` es un hash observado del contrato — como este fichero es manual (no hay
  discovery automático), puedes usar cualquier string estable; solo importa si cambia entre
  ediciones (invalida aprobaciones previas de Policy Engine, DEC-026).

## 8. Discovery: qué tools se exponen al agente

Crea `<AGENTFORGE_DATA_DIR>/discovery-config.json` — solo las tools listadas aquí (por
`qualifiedName`) llegan al agente vía `tools/list`, aunque existan en el Registry (DEC-018/DEC-021):

```json
{
  "activeQualifiedNames": [
    "execution-ssh:reiniciar-servicio",
    "connector-github:crear-issue"
  ]
}
```

## 9. Policy Engine: clasificar el riesgo

Crea `<AGENTFORGE_DATA_DIR>/policy-config.json`. **Toda `identity` no clasificada aquí requiere
confirmación humana por defecto** (DEC-023) — no hay forma de saltarse esto sin clasificarla
explícitamente:

```json
{
  "riskByIdentity": {
    "mi-tool-identity": "destructive",
    "mi-tool-crear-issue": "reversible-write"
  },
  "overrides": {}
}
```

- `"read-only"` → se permite automáticamente.
- `"reversible-write"` → se permite automáticamente (salvo `override: "deny"`).
- `"destructive"` → requiere confirmación humana síncrona (sección 15) cada vez que cambie el
  `schemaFingerprint`, o la primera vez tras arrancar el proceso Execution (DEC-026 — la
  aprobación vive solo en memoria, no persiste entre reinicios).
- `overrides` acepta `"allow"`/`"deny"` por `identity`, sin condiciones de argumentos (DEC-024).

## 10. Arrancar los procesos, en orden

Cada proceso se arranca en su propia terminal, con `AGENTFORGE_DATA_DIR` ya definida en esa
terminal (repite el `$env:AGENTFORGE_DATA_DIR = "..."` de la sección 3 en cada una). Desde la raíz
del repo, tras `pnpm run build`:

**1. Secrets Broker** (siempre primero — los demás lo necesitan):

```
pnpm --filter @agentforge/secrets-broker run start
```

**2. Execution Backends** (los que vayas a usar; pueden arrancar en paralelo entre sí, pero
después del Broker):

```
pnpm --filter @agentforge/execution-ssh run start
pnpm --filter @agentforge/connector-github run start
```

Estos dos piden confirmación por consola cuando una tool `destructive` lo requiere (sección 15) —
mantén su terminal visible y con foco disponible mientras el agente pueda invocar tools.

**3. MCP Server** — normalmente **no lo arrancas tú directamente**: es Claude Code quien lo lanza
como subproceso (sección 11). Si quieres probarlo manualmente antes, se arranca igual:

```
pnpm --filter @agentforge/mcp-server run start
```

habla exclusivamente por stdin/stdout con el protocolo MCP (DEC-046) — no es una herramienta
interactiva para un humano en una terminal.

**Opcional — Dashboard** (sección 14), en cualquier momento, independiente del resto:

```
pnpm --filter @agentforge/dashboard run start
```

Por defecto en `http://127.0.0.1:4173` — cambia el puerto con `AGENTFORGE_DASHBOARD_PORT`.

## 11. Conectar AgentForge con Claude Code (MCP)

Registra el servidor MCP en Claude Code con el comando `claude mcp add`, apuntando al `main.js`
compilado y propagando `AGENTFORGE_DATA_DIR`:

```
claude mcp add agentforge -- node "C:\ruta\a\AgentForge\packages\mcp-server\dist\main.js"
```

Si tu shell no hereda `AGENTFORGE_DATA_DIR` en el proceso que lanza Claude Code, defínela de forma
persistente en el entorno de usuario de Windows (Variables de entorno del sistema), para que el
subproceso que Claude Code arranca la vea también.

Antes de que Claude Code pueda usar tools que requieren confirmación, asegúrate de que
`execution-ssh`/`connector-github` (sección 10, paso 2) ya están arrancados de forma independiente
— el servidor MCP nunca los lanza por ti (DEC-047): si no están arrancados, cualquier tool que
dependa de ellos falla en `resolveExecutionClient` con un error explícito, nunca en silencio.

## 12. Comprobar que todo funciona

Con el Secrets Broker y los Execution Backends que vayas a usar ya arrancados:

1. Dentro de Claude Code, comprueba que el servidor `agentforge` aparece conectado (según la
   interfaz de gestión de servidores MCP de Claude Code).
2. Pide a Claude que liste las herramientas disponibles — deberías ver las `qualifiedName` que
   pusiste en `discovery-config.json` (sección 8).
3. Prueba primero una tool clasificada `"read-only"` o `"reversible-write"` (sección 9) para
   verificar el camino sin confirmación.
4. Prueba una tool `"destructive"` y confirma que aparece el prompt en la terminal del Execution
   Backend correspondiente (sección 15).

## 13. Usar las tools desde Claude Code

Cuando invocas una tool, sus parámetros son los que declaraste en `inputSchema` (sección 7), más
un parámetro especial `hostId` (usado solo por `execution-ssh`, para elegir qué host de
`host-config.json` usar — no es un parámetro de tu `inputSchema`, el servidor MCP lo extrae aparte,
ver `resolveHostId`). El resultado que ve el agente es JSON con el resultado de la ejecución
(`ExecutionOutcome`): para SSH incluye `exitCode`/`stdout`/`stderr` (truncados, DEC-040); para
GitHub incluye `statusCode` y el tamaño de la respuesta (nunca el cuerpo completo, DEC-055/060). Si
la tool fue denegada, cancelada, o falló, el agente recibe un mensaje de error explícito en vez de
un resultado — nunca una ejecución silenciosa a medias.

## 14. El Dashboard

Interfaz web de **solo lectura** (DEC-064, sin autenticación, bind exclusivo a `127.0.0.1` —
DEC-068, nunca la expongas fuera de tu propio equipo). Muestra:

- `/` — página principal.
- `/api/audit` — eventos del Audit Log (sección 16).
- El catálogo de tools del Registry y la configuración de Policy (lectura directa de los mismos
  ficheros de las secciones 7 y 9 — DEC-064).

No permite ejecutar tools, gestionar secretos, ni editar configuración — solo consultar.

## 15. Confirmación humana

Cuando una tool está clasificada `"destructive"` (o no clasificada — conservador por defecto,
sección 9) y Policy Engine exige confirmación, el proceso Execution correspondiente
(`execution-ssh` o `connector-github`) muestra en **su propia consola** (no en Claude Code, no en
el Dashboard) un mensaje así:

```
Confirmation required (operation <hash>):
  host: <hostname real, de tu host-config.json>
  command: <argv real resuelto, de tu commandTemplate>
Approve? [y/N]
```

- Responde `y` para aprobar; cualquier otra cosa (o nada) deniega.
- Hay un timeout (60 segundos por defecto en los entrypoints de Fase 16) — si no respondes a
  tiempo, se deniega automáticamente (DEC-038, rechazo por defecto).
- Cada confirmación es de un solo uso, vinculada exactamente a esa tool + esos parámetros + ese
  host + esa versión del schema (DEC-038) — no sirve para una invocación distinta, ni siquiera de
  la misma tool con otro parámetro.
- Necesitas tener esa terminal con foco y visible mientras el agente pueda invocar tools
  destructivas — es una limitación de diseño conocida y documentada (DEC-038), no un error.

## 16. Audit Log

Cada proceso escribe sus propios eventos en JSON Lines, append-only, bajo
`<AGENTFORGE_DATA_DIR>/audit/`:

- `mcp-server.jsonl` — invocaciones recibidas, decisiones de política, cancelaciones.
- `execution-ssh.jsonl` — confirmaciones resueltas, resultados de ejecución SSH.
- `connector-github.jsonl` — igual, para las operaciones de GitHub.

Nunca contienen secretos, claves, ni el contenido de `stdout`/`stderr`/respuesta HTTP —solo
metadatos (tamaño en bytes, si hubo truncado, código de salida/estado) — DEC-055. Puedes
inspeccionarlos con cualquier herramienta de línea de comandos (`jq`, `grep`) o verlos formateados
en el Dashboard (sección 14). La escritura es best-effort — un fallo al escribir un evento nunca
bloquea ni revierte la operación real (DEC-057). No hay rotación ni purga automática todavía
(sección 19).

## 17. Detener y reiniciar

Cada proceso es un proceso normal de Node.js — deténlo con `Ctrl+C` en su terminal. No hay
servicio de sistema operativo ni gestor de procesos integrado (sección 19).

Al reiniciar `execution-ssh`/`connector-github`, el registro de confirmaciones en memoria se
pierde — cualquier tool `destructive` volverá a pedir confirmación aunque ya la hubieras aprobado
antes del reinicio (comportamiento esperado, DEC-038 guarantee 2). Al reiniciar el Secrets Broker,
tus secretos siguen ahí (persistidos en disco, cifrados) — solo se pierde el estado en memoria del
resto de procesos.

## 18. Troubleshooting

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Claude Code no ve ninguna tool | `discovery-config.json` vacío o `qualifiedName` no coincide con el Registry | Revisa secciones 7 y 8 — los nombres deben ser idénticos, carácter a carácter |
| La tool falla con "No Execution Backend configured for origin ..." | `execution-ssh`/`connector-github` no está arrancado, o `origin.id` en el Registry no es exactamente `"execution-ssh"`/`"connector-github"` | Arranca el proceso que falta (sección 10); revisa `origin.id` en `registry-cache.json` |
| La tool falla con un error de política / se deniega siempre | `identity` sin clasificar en `policy-config.json`, o `override: "deny"` | Revisa sección 9; recuerda que sin clasificación el resultado por defecto es `requires-confirmation`, no `deny` — si ves `deny` puro, hay un override explícito |
| Nunca aparece el prompt de confirmación | La terminal de `execution-ssh`/`connector-github` no tiene foco, o el proceso no está arrancado | Verifica que el proceso está corriendo y su consola visible; comprueba también que no cambiaste `AGENTFORGE_DATA_DIR` entre terminales |
| El Secrets Broker no encuentra un secreto (`Secret not found`) | El `SecretId` en `host-config.json`/`account-config.json` no coincide con el creado en la sección 4, o apunta a un `AGENTFORGE_DATA_DIR` distinto | Reimprime el `SecretId` real con el script de la sección 4 y compáralo |
| `ENOENT` al conectar a un pipe (`\\.\pipe\agentforge-...`) | El proceso correspondiente no está arrancado todavía | Arranca el proceso en el orden de la sección 10 |
| El servidor MCP no responde o Claude Code lo marca como caído | Algo escribió en stdout antes de los frames MCP, o el proceso no se lanzó con el `AGENTFORGE_DATA_DIR` correcto | Revisa que uses exactamente `node dist/main.js` (nunca `pnpm run start` desde dentro de Claude Code, que sí puede imprimir texto extra); revisa variables de entorno heredadas |
| Cambié un `inputSchema` en el Registry y ahora una tool que antes se permitía pide confirmación | Cambio de `schemaFingerprint` invalida automáticamente cualquier aprobación previa (DEC-026) | Comportamiento esperado, no un fallo — vuelve a confirmar |

## 19. Limitaciones actuales y partes Windows-only

- **Solo verificado en Windows.** La rama Linux/macOS del transporte IPC (named pipe en Windows /
  Unix domain socket en Linux-macOS, DEC-010) nunca se ha implementado ni probado en ningún
  sistema operativo real — ver `decisions/DECISIONS.md`, DEC-080.
- **Sin instalador ni gestión de servicio del sistema operativo.** Cada proceso se arranca a mano
  en su propia terminal (sección 10) — no hay integración con el Programador de tareas de Windows
  ni con ningún gestor de servicios.
- **Sin CLI de administración de secretos.** Dar de alta un secreto requiere un script corto
  (sección 4), no un comando dedicado.
- **Sin descubrimiento automático de tools.** El Registry (sección 7) se edita a mano — no existe
  hoy ningún proceso que consulte un servidor MCP externo y rellene `registry-cache.json`
  automáticamente.
- **Sin rotación ni purga de Audit Log.** Los ficheros `.jsonl` (sección 16) crecen
  indefinidamente — gestiónalos manualmente si el tamaño te preocupa.
- **Sin autenticación en el Dashboard.** Solo accesible desde el propio equipo (`127.0.0.1`) — no
  lo expongas a la red.
- **Sin multiusuario ni multiagente.** Una sola sesión de servidor MCP a la vez (DEC-048); no hay
  discovery de múltiples instancias de Execution Backend (DEC-047).
- **El canal IPC Core↔Secrets Broker (DEC-010) sigue sin implementar** — no afecta al uso real
  descrito en este manual, porque cada Execution Backend habla directamente con el Secrets Broker
  por un canal distinto y sí real (DEC-070).
- **El conector de GitHub soporta solo 3 operaciones** (`create_issue`, `list_issues`,
  `comment_on_issue`) — cualquier otra operación de la API de GitHub no está implementada.
- **Ningún sistema remoto real fue tocado durante el desarrollo de AgentForge** — la primera vez
  que ejecutes una tool SSH/GitHub contra tu host/cuenta reales es responsabilidad tuya, incluida
  la verificación de que la clave/token que diste de alta tienen el alcance mínimo necesario.
