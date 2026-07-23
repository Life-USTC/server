import { describe, expect, it } from "vitest";
import {
  MCP_FEATURES,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  PUBLIC_REST_FEATURES,
  REST_FEATURES,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  expandScopeClaim,
  isFeatureScope,
  isMcpScope,
  OAUTH_PROVIDER_SCOPES,
  OAUTH_SCOPES,
  PUBLIC_OAUTH_SCOPES,
  PUBLIC_REST_SCOPES,
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
    expect(OAUTH_SCOPES).toContain("admin:read");
    expect(OAUTH_SCOPES).toContain("admin:write");
  });

  it("exports public OAuth scopes without admin scopes", () => {
    expect(PUBLIC_OAUTH_SCOPES).toEqual([
      OAUTH_OPENID_SCOPE,
      OAUTH_PROFILE_SCOPE,
      OAUTH_EMAIL_SCOPE,
      OAUTH_OFFLINE_ACCESS_SCOPE,
      ...PUBLIC_REST_SCOPES,
    ]);
    expect(PUBLIC_REST_SCOPES).toEqual(
      PUBLIC_REST_FEATURES.flatMap((f) => [
        restReadScope(f),
        restWriteScope(f),
      ]),
    );
    expect(PUBLIC_OAUTH_SCOPES).not.toContain("admin:read");
    expect(PUBLIC_OAUTH_SCOPES).not.toContain("admin:write");
  });

  it("keeps admin scopes as REST scopes but not MCP-compatible scopes", () => {
    expect(isFeatureScope("admin:read")).toBe(true);
    expect(isFeatureScope("admin:write")).toBe(true);
    expect(isMcpScope("admin:read")).toBe(false);
    expect(isMcpScope("admin:write")).toBe(false);
  });

  it("parses a space-separated canonical scope claim", () => {
    const result = expandScopeClaim(
      "openid workspace.todo:read workspace.todo:write",
    );
    expect(result.has("openid")).toBe(true);
    expect(result.has("workspace.todo:read")).toBe(true);
    expect(result.has("workspace.todo:write")).toBe(true);
  });

  it("parses an array scope claim", () => {
    const result = expandScopeClaim(["openid", "workspace.todo:write"]);
    expect(result.has("openid")).toBe(true);
    expect(result.has("workspace.todo:write")).toBe(true);
  });

  it("ignores invalid scope claim inputs", () => {
    expect(expandScopeClaim(null)).toEqual(new Set());
    expect(expandScopeClaim(123)).toEqual(new Set());
    expect(expandScopeClaim(undefined)).toEqual(new Set());
  });

  it("deduplicates canonical scopes", () => {
    const result = expandScopeClaim("workspace.todo:read workspace.todo:read");
    expect(result.size).toBe(1);
  });

  it("exposes only canonical public scopes for dynamic registration", () => {
    for (const scope of PUBLIC_OAUTH_SCOPES) {
      expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).toContain(scope);
    }
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain("rest:read");
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain("mcp:tools");
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain(
      "rest:workspace.todo:read",
    );
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain(
      "mcp:workspace.todo",
    );
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain("admin:read");
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain("admin:write");
    expect(CLIENT_REGISTRATION_ALLOWED_SCOPES).not.toContain("rest:admin:read");
    expect(OAUTH_PROVIDER_SCOPES).toContain("admin:read");
    expect(OAUTH_PROVIDER_SCOPES).toContain("admin:write");
    expect(MCP_FEATURES).toContain("workspace.todo");
  });
});
