import { describe, expect, test, vi } from "vitest";
import {
  getClientViewer,
  layoutUserSummaryFromClientSession,
} from "@/lib/auth/client-viewer";

describe("client viewer", () => {
  test("maps the existing Better Auth session payload to shell data", () => {
    expect(
      layoutUserSummaryFromClientSession({
        id: "user-1",
        image: "https://example.test/avatar.png",
        isAdmin: true,
        name: "User",
        username: "user",
      }),
    ).toEqual({
      id: "user-1",
      image: "https://example.test/avatar.png",
      isAdmin: true,
      name: "User",
      username: "user",
    });
  });

  test.each([
    null,
    {},
    { id: "" },
    { id: 123 },
  ])("rejects invalid session user %j", (value) => {
    expect(layoutUserSummaryFromClientSession(value)).toBeNull();
  });

  test("loads the viewer from the existing session endpoint", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        user: {
          id: "user-1",
          image: null,
          isAdmin: false,
          name: "User",
          username: "user",
        },
      }),
    ) as unknown as typeof fetch;

    await expect(getClientViewer(fetcher)).resolves.toMatchObject({
      id: "user-1",
      username: "user",
    });
    expect(fetcher).toHaveBeenCalledWith("/api/auth/get-session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
  });

  test("treats a failed session lookup as anonymous", async () => {
    const fetcher = vi.fn(
      async () => new Response(null, { status: 401 }),
    ) as unknown as typeof fetch;

    await expect(getClientViewer(fetcher)).resolves.toBeNull();
  });
});
