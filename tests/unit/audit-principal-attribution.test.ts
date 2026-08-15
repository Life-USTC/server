import { describe, expect, it } from "vitest";
import {
  attributionFromApiPrincipal,
  attributionFromGraphqlPrincipal,
  attributionFromMcpAuthInfo,
} from "@/lib/audit/principal-attribution";

describe("audit principal attribution", () => {
  it("保留 REST OAuth 的 client、grant 与 session 归因", () => {
    expect(
      attributionFromApiPrincipal({
        kind: "oauth",
        userId: "user-1",
        clientId: "client-1",
        grantId: "grant-1",
        sessionId: "session-1",
        scopes: new Set(["workspace.todo:write"]),
      }),
    ).toEqual({
      channel: "rest",
      userId: "user-1",
      subjectUserId: "user-1",
      oauthClientId: "client-1",
      oauthGrantId: "grant-1",
      sessionId: "session-1",
    });
  });

  it("保留 GraphQL session 的 sessionId", () => {
    expect(
      attributionFromGraphqlPrincipal({
        kind: "session",
        userId: "user-1",
        sessionId: "session-1",
      }),
    ).toEqual({
      channel: "graphql",
      userId: "user-1",
      subjectUserId: "user-1",
      sessionId: "session-1",
    });
  });

  it("从 MCP AuthInfo 读取服务端验证后的 client、grant 与 session", () => {
    expect(
      attributionFromMcpAuthInfo({
        token: "never-written-to-audit",
        clientId: "client-1",
        scopes: ["workspace.todo:read"],
        extra: {
          userId: "user-1",
          grantId: "grant-1",
          sessionId: "session-1",
        },
      }),
    ).toEqual({
      channel: "mcp",
      userId: "user-1",
      subjectUserId: "user-1",
      oauthClientId: "client-1",
      oauthGrantId: "grant-1",
      sessionId: "session-1",
    });
  });

  it("拒绝没有服务端验证 userId 的 MCP 归因", () => {
    expect(
      attributionFromMcpAuthInfo({
        token: "token",
        clientId: "client-1",
        scopes: [],
      }),
    ).toBeNull();
  });
});
