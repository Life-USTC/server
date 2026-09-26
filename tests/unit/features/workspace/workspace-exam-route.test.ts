import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthMock, listMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  listMock: vi.fn(),
}));
vi.mock("@/lib/auth/api-auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  listSubscribedExamPage: listMock,
}));

import { getSubscribedExamsRoute } from "@/lib/api/routes/subscribed-exam-routes";

function request(query = "") {
  return new Request(`https://example.test/api/workspace/exams${query}`, {
    headers: { "Accept-Language": "en-US" },
  });
}
describe("workspace exam REST boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ userId: "owner" });
    listMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
  });
  it("uses the authenticated owner and the exam read scope", async () => {
    const response = await getSubscribedExamsRoute(
      request("?userId=someone-else"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(requireAuthMock).toHaveBeenCalledWith(expect.any(Request), {
      bearerScope: { feature: "workspace.exam", action: "read" },
    });
    expect(listMock).toHaveBeenCalledWith("owner", {
      includeDateUnknown: true,
      locale: "en-us",
      pagination: { page: 1, pageSize: 20 },
    });
  });
  it.each([401, 403])(
    "preserves auth rejection %i before parsing or reading",
    async (status) => {
      requireAuthMock.mockResolvedValue(new Response(null, { status }));
      expect(
        (await getSubscribedExamsRoute(request("?dateFrom=bad"))).status,
      ).toBe(status);
      expect(listMock).not.toHaveBeenCalled();
    },
  );
  it("normalizes zoned bounds to the same Shanghai dates as GraphQL", async () => {
    const query = new URLSearchParams({
      dateFrom: "2026-09-14T20:00:00Z",
      dateTo: "2026-09-15T22:00:00+08:00",
      semesterId: "9",
      page: "2",
      pageSize: "3",
      includeDateUnknown: "false",
      locale: "zh-cn",
    });
    expect((await getSubscribedExamsRoute(request(`?${query}`))).status).toBe(
      200,
    );
    expect(listMock).toHaveBeenCalledWith("owner", {
      dateFrom: new Date("2026-09-15T00:00:00Z"),
      dateTo: new Date("2026-09-15T00:00:00Z"),
      semesterId: 9,
      includeDateUnknown: false,
      locale: "zh-cn",
      pagination: { page: 2, pageSize: 3 },
    });
  });
  it.each([
    "dateFrom=bad",
    "dateTo=2026-02-30",
    "dateFrom=2026-09-16&dateTo=2026-09-15",
    "page=0",
    "pageSize=101",
    "semesterId=-1",
    "includeDateUnknown=1",
    "locale=bad",
  ])("rejects invalid input %s", async (query) => {
    expect((await getSubscribedExamsRoute(request(`?${query}`))).status).toBe(
      400,
    );
    expect(listMock).not.toHaveBeenCalled();
  });
});
