import { describe, expect, it } from "vitest";
import type { ToolContract, ToolEntry, ToolOrigin } from "@agentforge/shared";
import { computeSchemaFingerprint, toQualifiedName } from "@agentforge/shared";
import { randomUUID } from "node:crypto";
import { InMemoryPolicyApprovalStore } from "./approval-store.js";
import { evaluate } from "./evaluate.js";
import type { PolicyConfig } from "./config.js";

const contract: ToolContract = {
  description: "test",
  inputSchema: { type: "object", properties: { path: { type: "string" } } },
};
const origin: ToolOrigin = { id: "mcp-fs", kind: "mcp-server" };

function makeEntry(name: string, overrides: Partial<ToolEntry> = {}): ToolEntry {
  return {
    identity: randomUUID() as ToolEntry["identity"],
    origin,
    qualifiedName: toQualifiedName(origin.id, name),
    contract,
    schemaFingerprint: computeSchemaFingerprint(contract),
    previousSchemaFingerprint: undefined,
    stale: false,
    ...overrides,
  };
}

function emptyConfig(): PolicyConfig {
  return { riskByIdentity: {}, overrides: {} };
}

describe("evaluate (Policy Engine, DEC-023 to DEC-026)", () => {
  it("DEC-023: an unclassified identity defaults to requires-confirmation, never allow", async () => {
    const entry = makeEntry("read_file");
    const result = await evaluate(entry, emptyConfig(), new InMemoryPolicyApprovalStore());

    expect(result.verdict).toBe("requires-confirmation");
    expect(result.ruleApplied).toBe("unclassified-default");
    expect(result.baseRisk).toBeUndefined();
    expect(result.identity).toBe(entry.identity);
    expect(result.schemaFingerprint).toBe(entry.schemaFingerprint);
  });

  it("DEC-024: read-only risk resolves to allow", async () => {
    const entry = makeEntry("list_files");
    const config: PolicyConfig = {
      riskByIdentity: { [entry.identity]: "read-only" },
      overrides: {},
    };
    const result = await evaluate(entry, config, new InMemoryPolicyApprovalStore());

    expect(result.verdict).toBe("allow");
    expect(result.ruleApplied).toBe("risk-default");
    expect(result.baseRisk).toBe("read-only");
  });

  it("DEC-024: reversible-write risk resolves to allow by default", async () => {
    const entry = makeEntry("write_file");
    const config: PolicyConfig = {
      riskByIdentity: { [entry.identity]: "reversible-write" },
      overrides: {},
    };
    const result = await evaluate(entry, config, new InMemoryPolicyApprovalStore());

    expect(result.verdict).toBe("allow");
    expect(result.baseRisk).toBe("reversible-write");
  });

  it("DEC-024: destructive risk resolves to requires-confirmation by default", async () => {
    const entry = makeEntry("delete_file");
    const config: PolicyConfig = {
      riskByIdentity: { [entry.identity]: "destructive" },
      overrides: {},
    };
    const result = await evaluate(entry, config, new InMemoryPolicyApprovalStore());

    expect(result.verdict).toBe("requires-confirmation");
    expect(result.baseRisk).toBe("destructive");
  });

  it("DEC-024: a deny override takes precedence over risk, even for read-only", async () => {
    const entry = makeEntry("list_files");
    const config: PolicyConfig = {
      riskByIdentity: { [entry.identity]: "read-only" },
      overrides: { [entry.identity]: "deny" },
    };
    const result = await evaluate(entry, config, new InMemoryPolicyApprovalStore());

    expect(result.verdict).toBe("deny");
    expect(result.ruleApplied).toBe("override-deny");
  });

  it("DEC-024: an allow override takes precedence over risk, even for destructive", async () => {
    const entry = makeEntry("delete_file");
    const config: PolicyConfig = {
      riskByIdentity: { [entry.identity]: "destructive" },
      overrides: { [entry.identity]: "allow" },
    };
    const result = await evaluate(entry, config, new InMemoryPolicyApprovalStore());

    expect(result.verdict).toBe("allow");
    expect(result.ruleApplied).toBe("override-allow");
  });

  it("DEC-023b: risk is constant per identity, regardless of contract details passed in", async () => {
    // Same identity, evaluated twice with entries differing only in a field unrelated to
    // schemaFingerprint (contract identical) — risk classification must not vary.
    const entry = makeEntry("delete_file");
    const config: PolicyConfig = {
      riskByIdentity: { [entry.identity]: "destructive" },
      overrides: {},
    };
    const store = new InMemoryPolicyApprovalStore();
    const first = await evaluate(entry, config, store);
    const second = await evaluate(entry, config, store);
    expect(first.baseRisk).toBe(second.baseRisk);
  });

  it("DEC-026: a schemaFingerprint change since the last approval forces requires-confirmation", async () => {
    const store = new InMemoryPolicyApprovalStore();
    const entryV1 = makeEntry("write_file");
    const config: PolicyConfig = {
      riskByIdentity: { [entryV1.identity]: "reversible-write" },
      overrides: {},
    };

    const first = await evaluate(entryV1, config, store);
    expect(first.verdict).toBe("allow");

    const changedContract: ToolContract = {
      description: "test",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" }, mode: { type: "string" } },
      },
    };
    const entryV2: ToolEntry = {
      ...entryV1,
      contract: changedContract,
      schemaFingerprint: computeSchemaFingerprint(changedContract),
    };

    const second = await evaluate(entryV2, config, store);
    expect(second.verdict).toBe("requires-confirmation");
    expect(second.ruleApplied).toBe("schema-fingerprint-changed");
  });

  it("DEC-026: no prior approval means no fingerprint-change invalidation on first evaluation", async () => {
    const entry = makeEntry("read_file");
    const config: PolicyConfig = {
      riskByIdentity: { [entry.identity]: "read-only" },
      overrides: {},
    };
    const result = await evaluate(entry, config, new InMemoryPolicyApprovalStore());
    expect(result.ruleApplied).not.toBe("schema-fingerprint-changed");
  });

  it("DEC-025: the decision never omits identity or schemaFingerprint", async () => {
    const entry = makeEntry("read_file");
    const result = await evaluate(entry, emptyConfig(), new InMemoryPolicyApprovalStore());
    expect(result.identity).toBeDefined();
    expect(result.schemaFingerprint).toBeDefined();
  });

  it("does not mutate the ToolEntry passed in (read-only over the Registry model)", async () => {
    const entry = makeEntry("read_file");
    const snapshot = JSON.stringify(entry);
    await evaluate(entry, emptyConfig(), new InMemoryPolicyApprovalStore());
    expect(JSON.stringify(entry)).toBe(snapshot);
  });
});
