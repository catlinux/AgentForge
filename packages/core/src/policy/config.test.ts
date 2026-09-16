import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolIdentity } from "@agentforge/shared";
import { loadPolicyConfig } from "./config.js";

describe("loadPolicyConfig", () => {
  it("loads risk classification and overrides from a JSON file (DEC-028)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-policy-config-test-"));
    const path = join(dir, "policy.json");
    const identity = "id-1" as ToolIdentity;
    await writeFile(
      path,
      JSON.stringify({
        riskByIdentity: { [identity]: "destructive" },
        overrides: { [identity]: "allow" },
      }),
      "utf-8",
    );

    const config = await loadPolicyConfig(path);
    expect(config.riskByIdentity[identity]).toBe("destructive");
    expect(config.overrides[identity]).toBe("allow");
  });

  it("defaults to empty maps when fields are missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentforge-policy-config-test-"));
    const path = join(dir, "policy.json");
    await writeFile(path, JSON.stringify({}), "utf-8");

    const config = await loadPolicyConfig(path);
    expect(config.riskByIdentity).toEqual({});
    expect(config.overrides).toEqual({});
  });
});
