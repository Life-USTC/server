import { beforeEach, expect, it, vi } from "vitest";

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("@/lib/auth/core", () => ({ betterAuthInstance: { handler } }));

import { authPostRoute } from "@/lib/api/routes/auth";
import { tokenPostRoute } from "@/lib/api/routes/auth-token";

beforeEach(() =>
  handler
    .mockReset()
    .mockResolvedValue(
      Response.json({ error: "unsupported_grant_type" }, { status: 400 }),
    ),
);
function request(path: string, params: URLSearchParams) {
  return new Request(`http://localhost:3000/api/auth/oauth2/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
}
it("oauth.authorization-management.singleton-form-parameters", async () => {
  for (const [path, run, fields] of [
    [
      "token",
      tokenPostRoute,
      [
        "grant_type",
        "client_id",
        "client_secret",
        "code",
        "code_verifier",
        "redirect_uri",
        "refresh_token",
        "scope",
        "device_code",
      ],
    ],
    [
      "introspect",
      authPostRoute,
      ["token", "token_type_hint", "client_id", "client_secret"],
    ],
  ] as const) {
    for (const field of fields) {
      const params = new URLSearchParams({
        grant_type: "unsupported",
        token: "opaque",
      });
      params.set(field, "first");
      params.append(field, "second");
      const response = await run(request(path, params));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_request" });
      expect(handler).not.toHaveBeenCalled();
    }
  }
  const params = new URLSearchParams({ grant_type: "unsupported" });
  params.append("resource", "http://localhost:3000/api/mcp");
  params.append("resource", "http://localhost:3000/api/graphql");
  const response = await tokenPostRoute(request("token", params));
  expect(await response.json()).toMatchObject({
    error: "unsupported_grant_type",
  });
  expect(handler).toHaveBeenCalledTimes(1);
  const delegated = handler.mock.calls[0][0] as Request;
  expect(
    new URLSearchParams(await delegated.text()).getAll("resource"),
  ).toEqual(params.getAll("resource"));
});
