/**
 * Session correlation identifier (DEC-049): opaque, lightweight — never an entity with owned
 * state. Sessions never fuses or coordinates the Policy Engine's approval store (DEC-026/027) or
 * Execution's operation-hash registry (DEC-045); those remain exactly as they are. `SessionId`
 * exists purely so downstream consumers (notably a future Audit Log, Fase 10) can correlate
 * events that belong to the same session, per DEC-049/DEC-051.
 */
export type SessionId = string & { readonly __brand: "SessionId" };
