import { describe, expect, it } from "vitest";
import { resolveOperationTemplate, type GithubOperationTemplate } from "./operation-template.js";

describe("resolveOperationTemplate (DEC-062)", () => {
  it("substitutes typed path placeholders with parameter values", () => {
    const template: GithubOperationTemplate = {
      method: "GET",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: [],
    };
    const result = resolveOperationTemplate(template, { owner: "acme", repo: "widgets" });
    expect(result).toEqual({
      method: "GET",
      path: "/repos/acme/widgets/issues",
      body: undefined,
    });
  });

  it("collects declared body fields into a JSON body for POST", () => {
    const template: GithubOperationTemplate = {
      method: "POST",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: ["title", "body"],
    };
    const result = resolveOperationTemplate(template, {
      owner: "acme",
      repo: "widgets",
      title: "Bug report",
      body: "Steps to reproduce...",
    });
    expect(result).toEqual({
      method: "POST",
      path: "/repos/acme/widgets/issues",
      body: { title: "Bug report", body: "Steps to reproduce..." },
    });
  });

  it("throws when a required path parameter is missing", () => {
    const template: GithubOperationTemplate = {
      method: "GET",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: [],
    };
    expect(() => resolveOperationTemplate(template, { owner: "acme" })).toThrow(
      /Missing required parameter/,
    );
  });

  it("throws when a declared body field is missing", () => {
    const template: GithubOperationTemplate = {
      method: "POST",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: ["title"],
    };
    expect(() => resolveOperationTemplate(template, { owner: "acme", repo: "widgets" })).toThrow(
      /Missing required parameter/,
    );
  });

  it("throws when an unexpected parameter is supplied (never silently ignored)", () => {
    const template: GithubOperationTemplate = {
      method: "GET",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: [],
    };
    expect(() =>
      resolveOperationTemplate(template, { owner: "acme", repo: "widgets", extra: "x" }),
    ).toThrow(/Unexpected parameters/);
  });

  it("a path parameter value is percent-encoded, never interpreted as an additional path segment", () => {
    const template: GithubOperationTemplate = {
      method: "GET",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: [],
    };
    const result = resolveOperationTemplate(template, {
      owner: "acme",
      repo: "widgets/../../admin",
    });
    // The malicious segment is percent-encoded, never resolved as a literal "/../" path traversal.
    expect(result.path).toBe("/repos/acme/widgets%2F..%2F..%2Fadmin/issues");
  });

  it("a GET template with no bodyFields never produces a body", () => {
    const template: GithubOperationTemplate = {
      method: "GET",
      path: "/repos/{{owner}}/{{repo}}/issues",
      bodyFields: [],
    };
    const result = resolveOperationTemplate(template, { owner: "acme", repo: "widgets" });
    expect(result.body).toBeUndefined();
  });
});
