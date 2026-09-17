// AgentForge Execution SSH — runs remote commands over SSH (Fase 7), consuming an already-issued
// PolicyDecision (Fase 5) and Secrets Broker records (Fase 6). Never re-evaluates policy, never
// accepts free-form shell text from Core (DEC-037).
export * from "./config/command-template.js";
export * from "./config/host-config.js";
export * from "./confirmation/operation-hash.js";
export * from "./confirmation/hash-registry.js";
export * from "./confirmation/cancel.js";
export * from "./confirmation/confirmation-channel.js";
export * from "./confirmation/readline-channel.js";
export * from "./confirmation/confirm.js";
export * from "./ssh/output-limits.js";
export * from "./ssh/shell-quote.js";
export * from "./ssh/client.js";
export * from "./execute.js";
export * from "./ipc/index.js";
