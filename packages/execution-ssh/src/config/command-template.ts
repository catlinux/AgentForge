/**
 * Fixed command templates per tool (DEC-037). Execution never concatenates free-form text from
 * Core/the agent — it only substitutes already-typed parameter values into placeholders of a
 * template Execution itself owns. `{{name}}` placeholders are substituted verbatim as a single
 * shell argument (never interpolated into a shell string), so a parameter value containing
 * shell metacharacters (`;`, `&&`, backticks, `$()`, etc.) can never change what command runs.
 */
export interface CommandTemplate {
  /** The executable and fixed arguments, e.g. ["systemctl", "restart", "{{service}}"]. */
  readonly argv: readonly string[];
}

const PLACEHOLDER_PATTERN = /^\{\{(\w+)\}\}$/;

/**
 * Resolves a template against validated parameters, producing a literal argv array — never a
 * shell string. Throws if a placeholder has no matching parameter, or if a parameter is supplied
 * that the template does not reference (both are treated as a template/parameter mismatch, not
 * silently ignored).
 */
export function resolveCommandTemplate(
  template: CommandTemplate,
  parameters: Readonly<Record<string, string>>,
): readonly string[] {
  const usedKeys = new Set<string>();
  const resolved = template.argv.map((part) => {
    const match = PLACEHOLDER_PATTERN.exec(part);
    if (match === null) {
      return part;
    }
    const key = match[1] as string;
    const value = parameters[key];
    if (value === undefined) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    usedKeys.add(key);
    return value;
  });

  const unusedKeys = Object.keys(parameters).filter((key) => !usedKeys.has(key));
  if (unusedKeys.length > 0) {
    throw new Error(
      `Unexpected parameters not referenced by the template: ${unusedKeys.join(", ")}`,
    );
  }

  return resolved;
}
