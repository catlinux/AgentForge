// AgentForge Secrets Broker — runs as a separate OS process/user from Core (DEC-004).
// Storage, master key, and operation handling (Fase 6) are implemented in ./storage and ./ipc.
// The Core<->Broker IPC transport (DEC-010) remains a placeholder in ./transport — no `main`/CLI
// wires Core to this Broker yet (Fase 12 finding). The distinct Execution Backend<->Broker
// channel (Fase 13, DEC-F) IS implemented in ./ipc/execution-secrets-server.ts, on the same
// transport pattern but its own minimal, get-only domain contract.
export * from "./storage/index.js";
export * from "./ipc/index.js";
