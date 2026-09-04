import { beforeEach, describe, expect, test, vi } from "vitest";

const { getWorkspaceNavigationSummaryMock, logRouteFailureMock } = vi.hoisted(
  () => ({
    getWorkspaceNavigationSummaryMock: vi.fn(),
    logRouteFailureMock: vi.fn(),
  }),
);

vi.mock("@/features/workspace/server/workspace-navigation-summary", () => ({
  getWorkspaceNavigationSummary: getWorkspaceNavigationSummaryMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logRouteFailure: logRouteFailureMock,
}));

const authUser = {
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

function event(input?: {
  authorization?: string;
  user?: typeof authUser | null;
}) {
  return {
    locals: { authUser: input?.user ?? null },
    request: new Request("https://life.example/_internal/shell-bootstrap", {
      headers: input?.authorization
        ? { authorization: input.authorization }
        : undefined,
    }),
  } as never;
}

function expectPrivateSessionHeaders(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

describe("shell bootstrap Web endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceNavigationSummaryMock.mockResolvedValue(navigation);
  });

  test("returns an explicit anonymous payload without querying workspace data", async () => {
    const { GET } = await import("@/routes/_internal/shell-bootstrap/+server");
    const response = await GET(event());

    expect(response.status).toBe(200);
    expectPrivateSessionHeaders(response);
    await expect(response.json()).resolves.toEqual({
      viewer: null,
      navigation: null,
    });
    expect(getWorkspaceNavigationSummaryMock).not.toHaveBeenCalled();
  });

  test("returns the allowlisted viewer and matching navigation summary", async () => {
    const { GET } = await import("@/routes/_internal/shell-bootstrap/+server");
    const response = await GET(event({ user: authUser }));

    expect(response.status).toBe(200);
    expectPrivateSessionHeaders(response);
    await expect(response.json()).resolves.toEqual({
      viewer: authUser,
      navigation,
    });
    expect(getWorkspaceNavigationSummaryMock).toHaveBeenCalledWith("user-1");
  });

  test("rejects Bearer authentication even when a viewer is present", async () => {
    const { GET } = await import("@/routes/_internal/shell-bootstrap/+server");
    const response = await GET(
      event({ authorization: "Bearer token", user: authUser }),
    );

    expect(response.status).toBe(401);
    expectPrivateSessionHeaders(response);
    expect(getWorkspaceNavigationSummaryMock).not.toHaveBeenCalled();
  });

  test("keeps failures private and does not serialize internal errors", async () => {
    getWorkspaceNavigationSummaryMock.mockRejectedValue(
      new Error("database details"),
    );
    const { GET } = await import("@/routes/_internal/shell-bootstrap/+server");
    const response = await GET(event({ user: authUser }));

    expect(response.status).toBe(500);
    expectPrivateSessionHeaders(response);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load shell bootstrap",
    });
    expect(logRouteFailureMock).toHaveBeenCalledOnce();
  });

  test("applies private headers to unsupported methods", async () => {
    const { fallback } = await import(
      "@/routes/_internal/shell-bootstrap/+server"
    );
    const response = await fallback(event());

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expectPrivateSessionHeaders(response);
  });
});
