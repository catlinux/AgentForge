import { describe, expect, it } from "vitest";
import type { SchemaFingerprint, ToolIdentity } from "@agentforge/shared";
import { computeOperationHash } from "./operation-hash.js";

const identity = "tool-1" as ToolIdentity;
const fingerprint = "fp-1" as SchemaFingerprint;

describe("computeOperationHash (DEC-038 guarantee 1: binding)", () => {
  it("is deterministic for the same tuple, regardless of parameter key order", () => {
    const a = computeOperationHash(identity, { path: "/a", mode: "r" }, "host-1", fingerprint);
    const b = computeOperationHash(identity, { mode: "r", path: "/a" }, "host-1", fingerprint);
    expect(a).toBe(b);
  });

  it("differs when a parameter value changes", () => {
    const a = computeOperationHash(identity, { path: "/a" }, "host-1", fingerprint);
    const b = computeOperationHash(identity, { path: "/b" }, "host-1", fingerprint);
    expect(a).not.toBe(b);
  });

  it("differs when the host changes (same tool, same parameters)", () => {
    const a = computeOperationHash(identity, { path: "/a" }, "host-1", fingerprint);
    const b = computeOperationHash(identity, { path: "/a" }, "host-2", fingerprint);
    expect(a).not.toBe(b);
  });

  it("differs when the identity changes", () => {
    const a = computeOperationHash(identity, { path: "/a" }, "host-1", fingerprint);
    const b = computeOperationHash("tool-2" as ToolIdentity, { path: "/a" }, "host-1", fingerprint);
    expect(a).not.toBe(b);
  });

  it("differs when the schemaFingerprint changes", () => {
    const a = computeOperationHash(identity, { path: "/a" }, "host-1", fingerprint);
    const b = computeOperationHash(identity, { path: "/a" }, "host-1", "fp-2" as SchemaFingerprint);
    expect(a).not.toBe(b);
  });
});
