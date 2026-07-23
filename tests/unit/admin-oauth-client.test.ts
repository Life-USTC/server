import { describe, expect, it } from "vitest";
import { ADMIN_OAUTH_CLIENT_PATTERNS } from "@/features/admin/lib/admin-oauth-action-utils";
import {
  oauthAuthPatternOptions,
  parseOAuthRedirectUris,
} from "@/features/admin/lib/oauth-page-options";
import { parseAdminOAuthCreateRequest } from "@/features/admin/server/admin-oauth-create-request";
import {
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";

const copy = {
  clientNameRequired: "Name is required",
  redirectUrisRequired: "Redirect URI is required",
  unsupportedAuthMethod: "Unsupported client type",
};

function createRequest(tokenEndpointAuthMethod: string) {
  const form = new FormData();
  form.set("name", "Test client");
  form.set(
    "redirectUris",
    "https://example.test/callback\nhttps://example.test/alternate",
  );
  form.set("tokenEndpointAuthMethod", tokenEndpointAuthMethod);
  form.append("scopes", "openid");
  form.append("scopes", "workspace.todo:read");
  return new Request("https://life.example/admin/oauth?/createClient", {
    method: "POST",
    body: form,
  });
}

describe("admin OAuth client creation", () => {
  it.each([
    [
      OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
      {
        enableEndSession: true,
        pattern: "trusted_first_party",
        skipConsent: true,
      },
    ],
    [
      OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
      {
        enableEndSession: false,
        pattern: "public_pkce",
        skipConsent: false,
      },
    ],
    [
      OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
      {
        enableEndSession: false,
        pattern: "confidential_connector",
        skipConsent: false,
      },
    ],
  ] as const)("keeps %s as one fixed server-side security pattern", async (method, expectedPattern) => {
    expect(ADMIN_OAUTH_CLIENT_PATTERNS[method]).toEqual(expectedPattern);

    const parsed = await parseAdminOAuthCreateRequest(
      createRequest(method),
      copy,
    );
    expect(parsed).toEqual({
      value: {
        name: "Test client",
        redirectUris: [
          "https://example.test/callback",
          "https://example.test/alternate",
        ],
        scopes: ["openid", "workspace.todo:read"],
        tokenEndpointAuthMethod: method,
      },
    });
  });

  it("exposes only the three server-supported patterns to the form", () => {
    expect(oauthAuthPatternOptions.map(({ value }) => value)).toEqual([
      OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
      OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
      OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
    ]);
  });

  it("rejects an arbitrary token authentication method", async () => {
    const parsed = await parseAdminOAuthCreateRequest(
      createRequest("client_secret_jwt"),
      copy,
    );

    expect(parsed).toMatchObject({
      error: {
        status: 400,
        data: { message: copy.unsupportedAuthMethod },
      },
    });
  });

  it("parses only non-empty explicit redirect URI lines", () => {
    expect(
      parseOAuthRedirectUris(
        " https://example.test/callback \n\nhttps://example.test/alternate ",
      ),
    ).toEqual([
      "https://example.test/callback",
      "https://example.test/alternate",
    ]);
  });
});
