// AgentForge — asistente interactivo de configuración (setup.mjs).
//
// Ejecútalo con: node setup.mjs
//
// Hace preguntas por consola para dar de alta un host SSH o una cuenta de GitHub sin tener que
// editar JSON a mano: registra el secreto real en el Secrets Broker y añade la entrada
// correspondiente a host-config.json/account-config.json. Requiere `pnpm run build` antes (lee
// el `dist/` compilado de @agentforge/secrets-broker, igual que el script de ejemplo de
// docs/USER-GUIDE.md).
//
// No genera claves SSH ni tokens de GitHub — ambos deben existir ya (ver docs/USER-GUIDE.md,
// sección 1). No arranca ningún proceso ni sustituye el resto del manual: es un atajo para la
// parte más repetitiva (secciones 4-6), no un reemplazo del recorrido completo.
//
// Diseñado para crecer: cada conector es una entrada en CONNECTORS más abajo. Añadir un
// conector futuro es añadir una entrada a ese array, no reescribir el flujo.

import { createInterface } from "node:readline";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { MasterKeyStore, SecretStore } from "./packages/secrets-broker/dist/index.js";

function dataDir() {
  return process.env.AGENTFORGE_DATA_DIR ?? join(homedir(), ".agentforge");
}

/**
 * Cola manual de líneas sobre el evento `'line'` de `readline`, en vez de `rl.question()`.
 * `rl.question()` (tanto la API clásica como `node:readline/promises`) se cuelga de forma fiable
 * en la segunda pregunta cuando stdin no es un TTY interactivo y ya se cerró tras entregar todo
 * su contenido (verificado con Node 24, reproducido igual en Git Bash y en PowerShell nativo) —
 * el evento `'end'` de stdin llega antes de que `readline` reanude la lectura para la siguiente
 * pregunta, dejando el asistente colgado sin ningún error visible. Escuchar `'line'` directamente
 * no tiene ese problema: cada línea que `readline` ya recibió del stream se entrega igual.
 */
function createPrompter(rl) {
  const queue = [];
  let resolveNext;
  rl.on("line", (line) => {
    if (resolveNext !== undefined) {
      const resolve = resolveNext;
      resolveNext = undefined;
      resolve(line);
    } else {
      queue.push(line);
    }
  });

  function question(prompt) {
    process.stdout.write(prompt);
    if (queue.length > 0) return Promise.resolve(queue.shift());
    return new Promise((resolve) => {
      resolveNext = resolve;
    });
  }

  /** Igual que `question`, pero sin eco en pantalla — para no dejar un secreto (el PAT) visible
   * en la terminal ni en su historial de scroll mientras se teclea. */
  async function questionHidden(prompt) {
    const output = rl.output;
    const originalWrite = output.write.bind(output);
    output.write = (chunk, ...args) =>
      chunk.includes("\n") ? originalWrite(chunk, ...args) : true;
    try {
      return await question(prompt);
    } finally {
      output.write = originalWrite;
      process.stdout.write("\n");
    }
  }

  return { question, questionHidden };
}

async function readJsonOrDefault(path, fallback) {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf-8");
}

async function openSecretStore() {
  const dir = dataDir();
  const masterKeyStore = new MasterKeyStore(join(dir, "secrets-broker", "master.key"));
  const masterKey = await masterKeyStore.loadOrCreate();
  return new SecretStore(join(dir, "secrets-broker", "secrets.enc.json"), masterKey);
}

/**
 * Cada conector define: `id` (coincide con `origin.id` del Tool Registry, DEC-058/059), `label`
 * (texto del menú), y `setup(prompter)` (el diálogo concreto, con acceso a `prompter.question`/
 * `prompter.questionHidden`).
 */
const CONNECTORS = [
  {
    id: "execution-ssh",
    label: "Host SSH (execution-ssh)",
    async setup(prompter) {
      console.log("\n— Host SSH —");
      console.log(
        "Necesitas ya generada tu clave SSH ed25519 dedicada a AgentForge (docs/USER-GUIDE.md, sección 1).",
      );

      const hostId = await prompter.question("Identificador del host (hostId), p.ej. mi-host: ");
      const hostname = await prompter.question("Hostname o IP del servidor remoto: ");
      const portRaw = await prompter.question("Puerto SSH [22]: ");
      const port = portRaw.trim() === "" ? 22 : Number(portRaw);
      const username = await prompter.question("Usuario SSH remoto: ");
      const keyPath = await prompter.question(
        "Ruta completa a tu clave SSH privada (la que generaste con ssh-keygen): ",
      );

      const privateKey = await readFile(keyPath.trim(), "utf-8");
      const store = await openSecretStore();
      const sshKeySecretId = await store.create(
        "ssh-key",
        { privateKey },
        undefined,
        `clave SSH para ${hostId}`,
      );
      console.log(`Secreto registrado en el Broker (SecretId: ${sshKeySecretId}).`);

      const configPath = join(dataDir(), "execution-ssh", "host-config.json");
      const config = await readJsonOrDefault(configPath, { hosts: [], commandTemplates: {} });
      const nextHosts = config.hosts.filter((h) => h.hostId !== hostId);
      nextHosts.push({ hostId, hostname, port, username, sshKeySecretId });
      await writeJson(configPath, { ...config, hosts: nextHosts });
      console.log(`Host "${hostId}" añadido a ${configPath}.`);
      console.log(
        'Recuerda: para que una tool use este host, su plantilla debe ir en "commandTemplates" (ver sección 5 del manual) y su identity en registry-cache.json/policy-config.json (secciones 7 y 9).',
      );
    },
  },
  {
    id: "connector-github",
    label: "Cuenta de GitHub (connector-github)",
    async setup(prompter) {
      console.log("\n— Cuenta de GitHub —");
      console.log(
        "Necesitas ya creado tu Personal Access Token (docs/USER-GUIDE.md, sección 1, pasos 1-7).",
      );

      const accountId = await prompter.question(
        "Identificador de la cuenta (accountId), p.ej. mi-cuenta-github: ",
      );
      const apiBaseUrlRaw = await prompter.question(
        "URL base de la API de GitHub [https://api.github.com]: ",
      );
      const apiBaseUrl =
        apiBaseUrlRaw.trim() === "" ? "https://api.github.com" : apiBaseUrlRaw.trim();
      const token = await prompter.questionHidden(
        "Pega aquí tu Personal Access Token (github_pat_...), no se mostrará en pantalla: ",
      );

      const store = await openSecretStore();
      const tokenSecretId = await store.create(
        "token",
        { value: token.trim() },
        "github",
        `PAT de GitHub para ${accountId}`,
      );
      console.log(`Secreto registrado en el Broker (SecretId: ${tokenSecretId}).`);

      const configPath = join(dataDir(), "connector-github", "account-config.json");
      const config = await readJsonOrDefault(configPath, { accounts: [], operationTemplates: {} });
      const nextAccounts = config.accounts.filter((a) => a.accountId !== accountId);
      nextAccounts.push({ accountId, apiBaseUrl, tokenSecretId });
      await writeJson(configPath, { ...config, accounts: nextAccounts });
      console.log(`Cuenta "${accountId}" añadida a ${configPath}.`);
      console.log(
        'Recuerda: las operaciones disponibles (create_issue/list_issues/comment_on_issue) van en "operationTemplates" (ver sección 6 del manual) y su identity en registry-cache.json/policy-config.json (secciones 7 y 9).',
      );
    },
  },
];

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompter = createPrompter(rl);
  try {
    console.log("AgentForge — asistente de configuración");
    console.log(`AGENTFORGE_DATA_DIR actual: ${dataDir()}`);

    let keepGoing = true;
    while (keepGoing) {
      console.log("");
      CONNECTORS.forEach((c, i) => console.log(`  ${i + 1}) ${c.label}`));
      console.log(`  ${CONNECTORS.length + 1}) Salir`);

      const choice = await prompter.question("\n¿Qué quieres configurar? Número: ");
      const index = Number(choice.trim()) - 1;
      const connector = CONNECTORS[index];
      if (connector === undefined) {
        keepGoing = false;
        continue;
      }

      await connector.setup(prompter);

      const again = await prompter.question("\n¿Configurar otro conector ahora? [y/N] ");
      keepGoing = again.trim().toLowerCase() === "y";
    }

    console.log(
      "\nListo. Revisa docs/USER-GUIDE.md secciones 7-10 para exponer la tool y arrancar los procesos.",
    );
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("El asistente falló:", error.message ?? error);
  process.exitCode = 1;
});
