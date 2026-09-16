// AgentForge Secrets Broker — runs as a separate OS process/user from Core (DEC-004).
// Storage, master key, and operation handling (Fase 6) are implemented in ./storage and ./ipc.
// The real IPC transport (named pipe / Unix domain socket, DEC-010) remains a placeholder in
// ./transport — out of scope for this phase, to be implemented when Core<->Broker is wired end
// to end.
export * from "./storage/index.js";
export * from "./ipc/index.js";
