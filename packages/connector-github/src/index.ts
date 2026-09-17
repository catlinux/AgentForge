// AgentForge Connector: GitHub — calls the GitHub REST API for a fixed set of operations
// (Fase 11), consuming an already-issued PolicyDecision (Fase 5) and Secrets Broker records
// (Fase 6). Never re-evaluates policy, never accepts free-form HTTP method/path/body from Core
// (DEC-062) — same discipline as execution-ssh's DEC-037.
export * from "./config/operation-template.js";
export * from "./config/account-config.js";
export * from "./confirmation/operation-hash.js";
export * from "./confirmation/hash-registry.js";
export * from "./confirmation/cancel.js";
export * from "./confirmation/confirmation-channel.js";
export * from "./confirmation/readline-channel.js";
export * from "./confirmation/confirm.js";
export * from "./confirmation/pending-confirmations.js";
export * from "./github/client.js";
export * from "./execute.js";
export * from "./ipc/index.js";
