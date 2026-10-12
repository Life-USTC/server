import { decodeJwt } from "jose";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { issueResourceBoundRefreshAccessToken } from "@/features/oauth/server/refresh-token-resources.server";
import { maybeBindOAuthRefreshResourceRequest } from "@/lib/api/routes/auth-token-refresh-resource-binding";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { isolatedNodeTest } from "../shared/isolated-node-fixture";

const test = isolatedNodeTest.extend(
  "state",
  async ({ isolatedDatabase, nodeRuntime }) =>
    nodeRuntime.run(async () => {
      const db = isolatedDatabase.owner;
      const userId = "refresh-resource-owner";
      const clientId = "refresh-resource-client";
      await db.$transaction(async (db) => {
        await db.user.create({
          data: { id: userId, email: `${userId}@test.invalid` },
        });
        await db.oAuthClient.create({
          data: {
            clientId,
            name: "Resource binding contract",
            public: true,
            requirePKCE: true,
            redirectUris: ["https://resource-binding.example/callback"],
            grantTypes: ["authorization_code", "refresh_token"],
            responseTypes: ["code"],
            scopes: [
              "openid",
              "profile",
              "offline_access",
              "workspace.todo:read",
            ],
            tokenEndpointAuthMethod: "none",
          },
        });
      });
      async function refreshFixture(input: {
        resources: string[];
        scopes: string[];
        confirmation?: { jkt: string };
      }) {
        const raw = crypto.randomUUID();
        await db.oAuthRefreshToken.create({
          data: {
            clientId,
            userId,
            token: await hashOAuthClientSecretForDbStorage(raw),
            expiresAt: new Date(Date.now() + 3600_000),
            resources: input.resources,
            scopes: input.scopes,
            ...(input.confirmation ? { confirmation: input.confirmation } : {}),
          },
        });
        return raw;
      }
      return { refreshFixture, clientId, userId };
    }),
);

test(
  "oauth.mcp-refresh-resource-binding",
  { tags: ["@OAuth/OAuth"] },
  async ({ state, nodeRuntime, isolatedDatabase }) =>
    nodeRuntime.run(async () => {
      const { refreshFixture } = state;
      const mcp = getOAuthMcpResourceUrl();
      const cases = [
        { resources: [mcp], scopes: ["workspace.todo:read"], expected: mcp },
        { resources: [], scopes: ["workspace.todo:read"], expected: undefined },
        { resources: [mcp], scopes: ["profile"], expected: undefined },
        {
          resources: [mcp],
          scopes: ["profile"],
          scope: "workspace.todo:read",
          expected: undefined,
        },
        {
          resources: [mcp],
          scopes: ["workspace.todo:read", "profile"],
          scope: "profile",
          expected: undefined,
        },
        {
          resources: [mcp, getOAuthGraphqlResourceUrl()],
          scopes: ["workspace.todo:read"],
          expected: undefined,
        },
        {
          resources: [mcp, "not-a-resource"],
          scopes: ["workspace.todo:read"],
          expected: undefined,
        },
        {
          resources: [new URL("/api/auth", mcp).toString()],
          scopes: ["workspace.todo:read"],
          expected: undefined,
        },
      ];
      for (const scenario of cases) {
        const raw = await refreshFixture(scenario);
        const params = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: raw,
          ...(scenario.scope ? { scope: scenario.scope } : {}),
        });
        const request = new Request(new URL("/api/auth/oauth2/token", mcp), {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: params,
        });
        const before = await isolatedDatabase.owner.oAuthRefreshToken.findMany({
          orderBy: { id: "asc" },
        });
        const prepared = await maybeBindOAuthRefreshResourceRequest(
          request,
          params,
        );
        expect(params.get("resource")).toBe(scenario.expected ?? null);
        expect(new URLSearchParams(await prepared.text()).get("resource")).toBe(
          scenario.expected ?? null,
        );
        if (!scenario.expected) expect(prepared).toBe(request);
        expect(
          await isolatedDatabase.owner.oAuthRefreshToken.findMany({
            orderBy: { id: "asc" },
          }),
        ).toEqual(before);
      }
    }),
);

test(
  "oauth.refresh-confirmation-binding",
  { tags: ["@OAuth/OAuth"] },
  async ({ state, nodeRuntime, isolatedDatabase }) =>
    nodeRuntime.run(async () => {
      const { refreshFixture, clientId, userId } = state;
      const resource = getOAuthMcpResourceUrl();
      const cases: Array<{
        stored?: { jkt: string };
        issued?: { jkt: string };
        type: string;
        valid: boolean;
        tampered?: boolean;
      }> = [
        { type: "Bearer", valid: true },
        {
          stored: { jkt: "same" },
          issued: { jkt: "same" },
          type: "DPoP",
          valid: true,
        },
        { issued: { jkt: "upgraded" }, type: "DPoP", valid: true },
        {
          stored: { jkt: "old" },
          issued: { jkt: "new" },
          type: "DPoP",
          valid: false,
        },
        { stored: { jkt: "old" }, type: "Bearer", valid: false },
        { issued: { jkt: "same" }, type: "Bearer", valid: false },
        { type: "DPoP", valid: false },
        { stored: { jkt: "" }, type: "Bearer", valid: false },
        { issued: { jkt: "" }, type: "DPoP", valid: false },
        { type: "Bearer", valid: false, tampered: true },
      ];
      for (const scenario of cases) {
        const refreshToken = await refreshFixture({
          resources: [resource],
          scopes: ["workspace.todo:read"],
          confirmation: scenario.stored,
        });
        const issuedAt = Math.floor(Date.now() / 1000);
        let accessToken = await signResourceBoundOAuthAccessToken({
          clientId,
          userId,
          resources: [resource],
          scopes: ["workspace.todo:read"],
          confirmation: scenario.issued,
          issuedAt,
          expiresAt: issuedAt + 300,
        });
        if (!accessToken) throw new Error("Expected signed token");
        if (scenario.tampered) {
          const parts = accessToken.split(".");
          parts[1] = Buffer.from(
            JSON.stringify({ ...decodeJwt(accessToken), sub: "forged-user" }),
          ).toString("base64url");
          accessToken = parts.join(".");
        }
        const before = await isolatedDatabase.owner.oAuthRefreshToken.findMany({
          orderBy: { id: "asc" },
        });
        const replacement = await issueResourceBoundRefreshAccessToken({
          refreshToken,
          resourceValues: [resource],
          effectiveScopes: ["workspace.todo:read"],
          issuedAccessToken: accessToken,
          issuedTokenType: scenario.type,
        });
        if (scenario.valid) {
          expect(replacement).toBeDefined();
          expect(replacement?.tokenType).toBe(scenario.type);
          const claims = decodeJwt(replacement!.accessToken);
          expect(claims.cnf).toEqual(scenario.issued);
          expect(claims.aud).toEqual(resource);
        } else {
          expect(replacement).toBeUndefined();
        }
        expect(
          await isolatedDatabase.owner.oAuthRefreshToken.findMany({
            orderBy: { id: "asc" },
          }),
        ).toEqual(before);
      }
      expect(await isolatedDatabase.owner.jwks.count()).toBe(1);
    }),
);
