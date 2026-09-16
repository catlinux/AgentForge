/**
 * Secret identity (DEC-034). Deliberately NOT `ToolIdentity` (DEC-016) — a secret is a
 * conceptually distinct entity: it may not be bound to any single tool, and several tools could
 * share one. `SecretId` is opaque, internal, and generated exclusively by the Secrets Broker,
 * never derived from or supplied by a caller.
 */
export type SecretId = string & { readonly __brand: "SecretId" };
