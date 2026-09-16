import { describe, expect, it } from "vitest";
import { resolveCommandTemplate, type CommandTemplate } from "./command-template.js";

describe("resolveCommandTemplate (DEC-037)", () => {
  it("substitutes typed placeholders with parameter values", () => {
    const template: CommandTemplate = { argv: ["systemctl", "restart", "{{service}}"] };
    const result = resolveCommandTemplate(template, { service: "nginx" });
    expect(result).toEqual(["systemctl", "restart", "nginx"]);
  });

  it("throws when a required parameter is missing", () => {
    const template: CommandTemplate = { argv: ["cat", "{{path}}"] };
    expect(() => resolveCommandTemplate(template, {})).toThrow(/Missing required parameter/);
  });

  it("throws when an unexpected parameter is supplied (never silently ignored)", () => {
    const template: CommandTemplate = { argv: ["disk_usage"] };
    expect(() => resolveCommandTemplate(template, { extra: "x" })).toThrow(/Unexpected parameters/);
  });

  it("a parameter value with shell metacharacters is substituted as a literal argv element, never interpreted as shell syntax", () => {
    const template: CommandTemplate = { argv: ["cat", "{{path}}"] };
    const injectionAttempt = "/a; rm -rf / #";
    const result = resolveCommandTemplate(template, { path: injectionAttempt });

    // The malicious string appears as exactly one argv element, unmodified — resolveCommandTemplate
    // never builds a shell string, so there is no injection point for `;`, `&&`, backticks, `$()`.
    expect(result).toEqual(["cat", injectionAttempt]);
    expect(result).toHaveLength(2);
  });

  it("a parameter value with backticks/command substitution syntax stays a single literal element", () => {
    const template: CommandTemplate = { argv: ["echo", "{{value}}"] };
    const result = resolveCommandTemplate(template, { value: "`whoami`" });
    expect(result).toEqual(["echo", "`whoami`"]);
  });
});
