import { describe, expect, it } from "vitest";
import { buildShellCommand, quoteShellArg } from "./shell-quote.js";

describe("quoteShellArg / buildShellCommand (DEC-037 — real remote-shell injection prevention)", () => {
  it("wraps a plain value in single quotes", () => {
    expect(quoteShellArg("nginx")).toBe("'nginx'");
  });

  it("escapes an embedded single quote correctly", () => {
    expect(quoteShellArg("it's")).toBe("'it'\\''s'");
  });

  it("a command-separator injection attempt is neutralized as a literal argument", () => {
    const malicious = "/a; rm -rf / #";
    const quoted = quoteShellArg(malicious);
    // The quoted value, if actually interpreted by a POSIX shell, must produce exactly the
    // original string as ONE argument — never split at `;`.
    expect(quoted).toBe("'/a; rm -rf / #'");
    expect(quoted.startsWith("'")).toBe(true);
    expect(quoted.endsWith("'")).toBe(true);
  });

  it("a command-substitution injection attempt (backticks) stays inside single quotes, inert", () => {
    const malicious = "`whoami`";
    expect(quoteShellArg(malicious)).toBe("'`whoami`'");
  });

  it("a $() command-substitution attempt stays inside single quotes, inert", () => {
    const malicious = "$(cat /etc/passwd)";
    expect(quoteShellArg(malicious)).toBe("'$(cat /etc/passwd)'");
  });

  it("buildShellCommand quotes every argv element independently", () => {
    const result = buildShellCommand(["systemctl", "restart", "nginx; rm -rf /"]);
    expect(result).toBe("'systemctl' 'restart' 'nginx; rm -rf /'");
  });

  it("the resulting string, if fed to a real POSIX shell, executes as a single literal argument", () => {
    // Simulate what a POSIX shell does with single-quoted content: everything between the
    // outermost quotes (with the escape technique for embedded quotes) is literal, no
    // metacharacter expansion. We verify this by re-deriving the original value from the quoted
    // form using the same unquoting rule a shell would apply, rather than trusting our own
    // quoting logic circularly.
    function posixUnquoteSingle(shellArg: string): string {
      // shellArg is a sequence of 'literal' and \' segments per POSIX single-quote escaping.
      return shellArg
        .split("'\\''")
        .map((segment) => segment.replace(/^'/, "").replace(/'$/, ""))
        .join("'");
    }
    const original = "/a; rm -rf / #`whoami`$(id)";
    const quoted = quoteShellArg(original);
    expect(posixUnquoteSingle(quoted)).toBe(original);
  });
});
