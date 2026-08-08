import { resolve4, resolve6 } from "node:dns/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  restReadScope,
} from "@/lib/oauth/constants";

vi.mock("node:dns/promises", () => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

const authOrigin = "http://localhost:3000";
const createdClientIds: string[] = [];
const metadataByUrl = new Map<string, Record<string, unknown>>();
const originalFetch = globalThis.fetch;
let authHandler: (request: Request) => Promise<Response>;

function authorizeRequest(clientId: string, includePkce = true) {
  const url = new URL("/api/auth/oauth2/authorize", authOrigin);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", "https://client.example/callback");
  url.searchParams.set("scope", restReadScope("account.profile"));
  if (includePkce) {
    url.searchParams.set(
      "code_challenge",
      "0ZTVJ3y8iV5f0fIArEGRm8H8q_TfQXQGGVQnXKgV3Q4",
    );
    url.searchParams.set("code_challenge_method", "S256");
  }
  return authHandler(new Request(url));
}

describe.sequential("Better Auth CIMD registration", () => {
  beforeAll(async () => {
    vi.mocked(resolve4).mockResolvedValue(["8.8.8.8"]);
    vi.mocked(resolve6).mockRejectedValue(
      Object.assign(new Error("no AAAA record"), { code: "ENODATA" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          input instanceof Request
            ? input.url
            : input instanceof URL
              ? input.toString()
              : input;
        const metadata = metadataByUrl.get(url);
        if (metadata) {
          return Response.json(metadata, {
            headers: { "content-type": "application/json" },
          });
        }
        return originalFetch(input, init);
      }),
    );

    const [{ betterAuth }, { buildBetterAuthOptions }] = await Promise.all([
      import("better-auth"),
      import("@/lib/auth/better-auth-options"),
    ]);
    const options = buildBetterAuthOptions();
    const auth = betterAuth({
      ...options,
      plugins: options.plugins.filter((plugin) =>
        ["jwt", "oauth-provider", "cimd"].includes(plugin.id),
      ),
    });
    authHandler = auth.handler;
  });

  afterAll(async () => {
    await prisma.oAuthClient.deleteMany({
      where: { clientId: { in: createdClientIds } },
    });
    vi.unstubAllGlobals();
    await prisma.$disconnect();
  });

  it("rejects missing client_name without persisting the client", async () => {
    const clientId = `https://client.example/missing-name-${crypto.randomUUID()}.json`;
    metadataByUrl.set(clientId, {
      client_id: clientId,
      redirect_uris: ["https://client.example/callback"],
      token_endpoint_auth_method: "none",
    });

    const response = await authorizeRequest(clientId);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_client",
    });
    await expect(
      prisma.oAuthClient.findUnique({ where: { clientId } }),
    ).resolves.toBeNull();
  });

  it("rejects DPoP-only metadata without persisting the client", async () => {
    const clientId = `https://client.example/dpop-${crypto.randomUUID()}.json`;
    metadataByUrl.set(clientId, {
      client_id: clientId,
      client_name: "DPoP-only Client",
      dpop_bound_access_tokens: true,
      redirect_uris: ["https://client.example/callback"],
      token_endpoint_auth_method: "none",
    });

    const response = await authorizeRequest(clientId);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_client",
      error_description:
        "DPoP-bound access tokens are not supported by this Bearer-only resource server",
    });
    await expect(
      prisma.oAuthClient.findUnique({ where: { clientId } }),
    ).resolves.toBeNull();
  });

  it("rejects private DNS answers before fetching metadata", async () => {
    const clientId = `https://client.example/private-${crypto.randomUUID()}.json`;
    metadataByUrl.set(clientId, {
      client_id: clientId,
      client_name: "Private DNS Client",
      redirect_uris: ["https://client.example/callback"],
    });
    vi.mocked(resolve4).mockResolvedValueOnce(["127.0.0.1"]);
    const fetchMock = vi.mocked(globalThis.fetch);
    const fetchCallsBefore = fetchMock.mock.calls.length;

    const response = await authorizeRequest(clientId);

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(fetchCallsBefore);
    await expect(
      prisma.oAuthClient.findUnique({ where: { clientId } }),
    ).resolves.toBeNull();
  });

  it("discovers and persists a public CIMD client before authorization", async () => {
    const clientId = `https://client.example/mcp-${crypto.randomUUID()}.json`;
    createdClientIds.push(clientId);
    metadataByUrl.set(clientId, {
      client_id: clientId,
      client_name: "Integration MCP Client",
      redirect_uris: ["https://client.example/callback"],
      token_endpoint_auth_method: "none",
      grant_types: [
        "authorization_code",
        "refresh_token",
        OAUTH_DEVICE_CODE_GRANT_TYPE,
        "urn:ietf:params:oauth:grant-type:jwt-bearer",
      ],
      response_types: ["code", "token"],
      scope: restReadScope("account.profile"),
    });

    const response = await authorizeRequest(clientId);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/account/sign-in");
    await expect(
      prisma.oAuthClient.findUnique({ where: { clientId } }),
    ).resolves.toMatchObject({
      clientId,
      clientSecret: null,
      name: "Integration MCP Client",
      public: true,
      redirectUris: ["https://client.example/callback"],
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      tokenEndpointAuthMethod: "none",
    });

    const withoutPkce = await authorizeRequest(clientId, false);
    expect(withoutPkce.status).toBe(302);
    const callback = new URL(withoutPkce.headers.get("location") ?? "");
    expect(callback.origin).toBe("https://client.example");
    expect(callback.searchParams.get("error")).toBe("invalid_request");
  });

  it("keeps dynamic client registration as a compatibility fallback", async () => {
    const response = await authHandler(
      new Request(`${authOrigin}/api/auth/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "Integration DCR Client",
          redirect_uris: ["https://client.example/callback"],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          scope: restReadScope("account.profile"),
        }),
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { client_id?: unknown };
    expect(typeof body.client_id).toBe("string");
    if (typeof body.client_id !== "string") {
      throw new Error("Missing registered client_id");
    }
    createdClientIds.push(body.client_id);
    await expect(
      prisma.oAuthClient.findUnique({ where: { clientId: body.client_id } }),
    ).resolves.toMatchObject({
      clientId: body.client_id,
      name: "Integration DCR Client",
      public: true,
    });
  });
});
