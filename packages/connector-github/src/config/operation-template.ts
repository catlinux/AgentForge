/**
 * Fixed HTTP operation templates per tool (DEC-062, mirrors DEC-037's command-template model for
 * SSH). This connector never builds a request method/path/body from free-form agent text — it
 * only substitutes already-typed parameter values into placeholders of a template this connector
 * itself owns. `{{name}}` placeholders are substituted verbatim into the path segment or body
 * field they occupy — never concatenated into an arbitrary URL or interpreted as anything but a
 * literal value.
 */
export interface GithubOperationTemplate {
  readonly method: "GET" | "POST";
  /** e.g. "/repos/{{owner}}/{{repo}}/issues" — placeholders substituted from parameters. */
  readonly path: string;
  /** Parameter names to send as the JSON request body (POST only); omitted for GET. Each must
   * also appear as a placeholder consumed by `path`, or be listed here to be sent as a body field
   * — never both silently ignored nor free-form. */
  readonly bodyFields: readonly string[];
}

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

export interface ResolvedOperation {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly body: Readonly<Record<string, string>> | undefined;
}

/**
 * Resolves a template against validated parameters, producing a literal path and body — never a
 * free-form URL. Throws if a path placeholder has no matching parameter, if a declared body field
 * is missing, or if a parameter is supplied that neither the path nor `bodyFields` reference
 * (treated as a template/parameter mismatch, never silently ignored — same discipline as
 * `execution-ssh`'s `resolveCommandTemplate`, DEC-037).
 */
export function resolveOperationTemplate(
  template: GithubOperationTemplate,
  parameters: Readonly<Record<string, string>>,
): ResolvedOperation {
  const usedKeys = new Set<string>();

  const path = template.path.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const value = parameters[key];
    if (value === undefined) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    usedKeys.add(key);
    return encodeURIComponent(value);
  });

  let body: Record<string, string> | undefined;
  if (template.bodyFields.length > 0) {
    body = {};
    for (const key of template.bodyFields) {
      const value = parameters[key];
      if (value === undefined) {
        throw new Error(`Missing required parameter: ${key}`);
      }
      usedKeys.add(key);
      body[key] = value;
    }
  }

  const unusedKeys = Object.keys(parameters).filter((key) => !usedKeys.has(key));
  if (unusedKeys.length > 0) {
    throw new Error(
      `Unexpected parameters not referenced by the template: ${unusedKeys.join(", ")}`,
    );
  }

  return { method: template.method, path, body };
}
