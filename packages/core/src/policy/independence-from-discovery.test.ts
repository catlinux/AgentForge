import { describe, expect, it } from "vitest";
import type { ToolContract, ToolEntry, ToolOrigin } from "@agentforge/shared";
import { computeSchemaFingerprint, toQualifiedName } from "@agentforge/shared";
import { randomUUID } from "node:crypto";
import { InMemoryPolicyApprovalStore } from "./approval-store.js";
import { evaluate } from "./evaluate.js";
import type { PolicyConfig } from "./config.js";
import { StaticConfigDiscoveryStrategy } from "../discovery/static-strategy.js";
import type { DiscoveryConfig } from "../discovery/config.js";

const contract: ToolContract = { description: "test", inputSchema: { type: "object" } };
const origin: ToolOrigin = { id: "mcp-fs", kind: "mcp-server" };

/**
 * DEC-015 / Fase 5 §2: authorization must never depend on whether Discovery would expose a tool
 * to the agent. Discovery is a context-reduction convenience layer, not a security layer — an
 * identity absent from Discovery's active list must still be evaluated normally by the Policy
 * Engine.
 */
describe("Policy Engine independence from Tool Discovery", () => {
  it("evaluates an identity the same way regardless of Discovery's active list", async () => {
    const entry: ToolEntry = {
      identity: randomUUID() as ToolEntry["identity"],
      origin,
      qualifiedName: toQualifiedName(origin.id, "delete_file"),
      contract,
      schemaFingerprint: computeSchemaFingerprint(contract),
      previousSchemaFingerprint: undefined,
      stale: false,
    };

    // Discovery explicitly does NOT include this tool.
    const discoveryConfig: DiscoveryConfig = { activeQualifiedNames: [] };
    const strategy = new StaticConfigDiscoveryStrategy(discoveryConfig);
    const discovered = strategy.select([entry]);
    expect(discovered).toHaveLength(0);

    // Policy Engine still evaluates it, with the same outcome as if it had been discovered.
    const policyConfig: PolicyConfig = {
      riskByIdentity: { [entry.identity]: "destructive" },
      overrides: {},
    };
    const result = await evaluate(entry, policyConfig, new InMemoryPolicyApprovalStore());
    expect(result.verdict).toBe("requires-confirmation");
    expect(result.ruleApplied).toBe("risk-default");
  });
});
