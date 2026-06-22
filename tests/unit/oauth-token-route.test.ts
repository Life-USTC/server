import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenGetRoute, tokenPostRoute } from "@/lib/api/routes/auth-token";

const { betterAuthHandlerMock } = vi.hoisted(() => ({
  betterAuthHandlerMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    handler: betterAuthHandlerMock,
  },
}));

describe("OAuth token route", () => {
  beforeEach(() => {
    betterAuthHandlerMock.mockReset();
  });

  it("returns JSON method guidance for GET", async () => {
    const response = await tokenGetRoute(
      new Request("http://localhost/api/auth/oauth2/token"),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.json()).toEqual({
      error: "invalid_request",
      error_description: "Use POST to exchange OAuth grants.",
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
  });

  it("normalizes delegated Better Auth validation errors", async () => {
    betterAuthHandlerMock.mockResolvedValueOnce(
      Response.json(
        {
          message: "[body.grant_type] Invalid option",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      ),
    );

    const response = await tokenPostRoute(
      new Request("http://localhost/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=unsupported",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_request",
      error_description: "[body.grant_type] Invalid option",
    });
  });
});
