import { describe, expect, test, vi } from "vitest";
import {
  getClientShellBootstrap,
  parseShellBootstrapPayload,
  workspaceNavigationFromPageData,
} from "@/lib/shell/shell-bootstrap";

const viewer = {
  id: "user-1",
  image: null,
  isAdmin: false,
  name: "User",
  username: "user",
};

const navigation = {
  userId: "user-1",
  calendarItemsCount: 8,
  examsCount: 2,
  pendingHomeworksCount: 3,
  pendingTodosCount: 4,
  subscribedSectionCount: 5,
};

describe("shell bootstrap client", () => {
  test("accepts explicit anonymous and matched authenticated payloads", () => {
    expect(
      parseShellBootstrapPayload({ viewer: null, navigation: null }),
    ).toEqual({ viewer: null, navigation: null });
    expect(parseShellBootstrapPayload({ viewer, navigation })).toEqual({
      viewer,
      navigation,
    });
  });

  test("rejects malformed counts and cross-user navigation data", () => {
    expect(() =>
      parseShellBootstrapPayload({
        viewer,
        navigation: { ...navigation, userId: "user-2" },
      }),
    ).toThrow("Invalid shell bootstrap navigation summary");
    expect(() =>
      parseShellBootstrapPayload({
        viewer,
        navigation: { ...navigation, pendingTodosCount: -1 },
      }),
    ).toThrow("Invalid shell bootstrap navigation summary");
  });

  test("maps matching workspace SSR data into the same projection", () => {
    expect(
      workspaceNavigationFromPageData(
        {
          navStats: {
            user: { id: "user-1" },
            calendarItemsCount: 8,
            examsCount: 2,
            pendingHomeworksCount: 3,
            pendingTodosCount: 4,
          },
          subscribedSectionCount: 5,
        },
        "user-1",
      ),
    ).toEqual(navigation);
    expect(
      workspaceNavigationFromPageData(
        {
          navStats: { ...navigation, user: { id: "user-2" } },
          subscribedSectionCount: 5,
        },
        "user-1",
      ),
    ).toBeNull();
  });

  test("loads the private same-origin bootstrap without client caching", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ viewer, navigation }),
    ) as unknown as typeof fetch;

    await expect(getClientShellBootstrap(fetcher)).resolves.toEqual({
      viewer,
      navigation,
    });
    expect(fetcher).toHaveBeenCalledWith("/_internal/shell-bootstrap", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
  });

  test("does not turn a failed bootstrap into an anonymous result", async () => {
    const fetcher = vi.fn(
      async () => new Response(null, { status: 503 }),
    ) as unknown as typeof fetch;

    await expect(getClientShellBootstrap(fetcher)).rejects.toThrow(
      "Shell bootstrap failed with status 503",
    );
  });
});
