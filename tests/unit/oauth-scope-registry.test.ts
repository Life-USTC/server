import { describe, expect, it } from "vitest";
import {
  MCP_FEATURES,
  mcpScope,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  REST_FEATURES,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  expandLegacyScope,
  expandScopeClaim,
  LEGACY_MCP_TOOLS_SCOPE,
  LEGACY_REST_READ_SCOPE,
  LEGACY_REST_WRITE_SCOPE,
  OAUTH_SCOPES,
} from "@/lib/oauth/scope-registry";

describe("oauth scope registry", () => {
  it("exports the canonical scope list", () => {
    expect(OAUTH_SCOPES).toEqual([
      OAUTH_OPENID_SCOPE,
      OAUTH_PROFILE_SCOPE,
      OAUTH_EMAIL_SCOPE,
      OAUTH_OFFLINE_ACCESS_SCOPE,
      ...REST_FEATURES.flatMap((f) => [restReadScope(f), restWriteScope(f)]),
    ]);
  });

  it("expands legacy rest:read into all feature read scopes", () => {
    expect(expandLegacyScope(LEGACY_REST_READ_SCOPE)).toEqual(
      REST_FEATURES.map(restReadScope),
    );
  });

  it("expands legacy rest:write into all feature write scopes", () => {
    expect(expandLegacyScope(LEGACY_REST_WRITE_SCOPE)).toEqual(
      REST_FEATURES.map(restWriteScope),
    );
  });

  it("expands legacy mcp:tools into all feature read/write scopes", () => {
    expect(expandLegacyScope(LEGACY_MCP_TOOLS_SCOPE)).toEqual(
      REST_FEATURES.flatMap((f) => [restReadScope(f), restWriteScope(f)]),
    );
  });

  it("returns non-legacy scopes unchanged", () => {
    expect(expandLegacyScope("todo:read")).toEqual(["todo:read"]);
    expect(expandLegacyScope("openid")).toEqual(["openid"]);
  });

  it("maps legacy feature-scoped REST and MCP scopes to canonical scopes", () => {
    expect(expandLegacyScope("rest:todo:read")).toEqual(["todo:read"]);
    expect(expandLegacyScope("rest:todo:write")).toEqual(["todo:write"]);
    expect(expandLegacyScope("mcp:todo")).toEqual(["todo:read", "todo:write"]);
  });

  it("expands a space-separated scope claim", () => {
    const result = expandScopeClaim("openid rest:read mcp:tools");
    expect(result.has("openid")).toBe(true);
    expect(result.has("todo:read")).toBe(true);
    expect(result.has("todo:write")).toBe(true);
    expect(result.has(LEGACY_REST_READ_SCOPE)).toBe(false);
    expect(result.has(LEGACY_MCP_TOOLS_SCOPE)).toBe(false);
  });

  it("expands an array scope claim", () => {
    const result = expandScopeClaim(["openid", "rest:write"]);
    expect(result.has("openid")).toBe(true);
    expect(result.has("todo:write")).toBe(true);
  });

  it("ignores invalid scope claim inputs", () => {
    expect(expandScopeClaim(null)).toEqual(new Set());
    expect(expandScopeClaim(123)).toEqual(new Set());
    expect(expandScopeClaim(undefined)).toEqual(new Set());
  });

  it("deduplicates expanded scopes", () => {
    const result = expandScopeClaim("rest:read todo:read");
    expect(result.size).toBe(REST_FEATURES.length);
  });

  it("exposes a DCR/authorization allowed-scope list that tolerates legacy scopes", () => {
    for (const scope of OAUTH_SCOPES) {
      expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(scope);
    }
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(
      LEGACY_REST_READ_SCOPE,
    );
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(
      LEGACY_REST_WRITE_SCOPE,
    );
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(
      LEGACY_MCP_TOOLS_SCOPE,
    );
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain("rest:todo:read");
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(mcpScope("todo"));
    expect(MCP_FEATURES).toContain("todo");
  });
});
