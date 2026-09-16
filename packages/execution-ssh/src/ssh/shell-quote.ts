/**
 * Safely quotes a single argv element for POSIX shell (DEC-037). ssh2's `exec` sends a single
 * command string to the remote SSH server, which typically runs it via the remote shell
 * (`/bin/sh -c "<string>"`) — there is no protocol-level "literal argv, no shell" mode for SSH
 * `exec`. Joining already-resolved argv elements with plain spaces would let any shell
 * metacharacter in a parameter value (`;`, `&&`, backticks, `$()`) be reinterpreted by the
 * remote shell, defeating the guarantee `resolveCommandTemplate` establishes in memory. Each
 * element must therefore be quoted as a single-quoted POSIX shell literal before joining.
 */
export function quoteShellArg(value: string): string {
  // Wrap in single quotes; any literal single quote inside the value must end the quoted
  // string, emit an escaped quote, and reopen quoting — the standard POSIX technique.
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildShellCommand(argv: readonly string[]): string {
  return argv.map(quoteShellArg).join(" ");
}
