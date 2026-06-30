import { describe, expect, it } from "vitest";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  LEGACY_MCP_TOOLS_SCOPE,
  LEGACY_REST_READ_SCOPE,
  LEGACY_REST_WRITE_SCOPE,
  OAUTH_SCOPES,
  expandLegacyScope,
  expandScopeClaim,
} from "@/lib/oauth/scope-registry";
import {
  MCP_FEATURES,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  REST_FEATURES,
  mcpScope,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";

describe("oauth scope registry", () => {
  it("exports the canonical scope list", () => {
    expect(OAUTH_SCOPES).toEqual([
      OAUTH_OPENID_SCOPE,
      OAUTH_PROFILE_SCOPE,
      OAUTH_EMAIL_SCOPE,
      OAUTH_OFFLINE_ACCESS_SCOPE,
      ...REST_FEATURES.flatMap((f) => [restReadScope(f), restWriteScope(f)]),
      ...MCP_FEATURES.map(mcpScope),
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

  it("expands legacy mcp:tools into all feature mcp scopes", () => {
    expect(expandLegacyScope(LEGACY_MCP_TOOLS_SCOPE)).toEqual(
      MCP_FEATURES.map(mcpScope),
    );
  });

  it("returns non-legacy scopes unchanged", () => {
    expect(expandLegacyScope("rest:todo:read")).toEqual(["rest:todo:read"]);
    expect(expandLegacyScope("openid")).toEqual(["openid"]);
  });

  it("expands a space-separated scope claim", () => {
    const result = expandScopeClaim("openid rest:read mcp:tools");
    expect(result.has("openid")).toBe(true);
    expect(result.has("rest:todo:read")).toBe(true);
    expect(result.has("mcp:todo")).toBe(true);
    expect(result.has(LEGACY_REST_READ_SCOPE)).toBe(false);
    expect(result.has(LEGACY_MCP_TOOLS_SCOPE)).toBe(false);
  });

  it("expands an array scope claim", () => {
    const result = expandScopeClaim(["openid", "rest:write"]);
    expect(result.has("openid")).toBe(true);
    expect(result.has("rest:todo:write")).toBe(true);
  });

  it("ignores invalid scope claim inputs", () => {
    expect(expandScopeClaim(null)).toEqual(new Set());
    expect(expandScopeClaim(123)).toEqual(new Set());
    expect(expandScopeClaim(undefined)).toEqual(new Set());
  });

  it("deduplicates expanded scopes", () => {
    const result = expandScopeClaim("rest:read rest:todo:read");
    expect(result.size).toBe(REST_FEATURES.length);
  });

  it("exposes a DCR/authorization allowed-scope list that tolerates legacy scopes", () => {
    for (const scope of OAUTH_SCOPES) {
      expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(scope);
    }
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(LEGACY_REST_READ_SCOPE);
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(
      LEGACY_REST_WRITE_SCOPE,
    );
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(LEGACY_MCP_TOOLS_SCOPE);
  });
});
