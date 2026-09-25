import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  countUnreadYoungNotifications: vi.fn(),
  listYoungNotifications: vi.fn(),
  listYoungEventSubscriptions: vi.fn(),
  listYoungOrganizerSubscriptions: vi.fn(),
}));
vi.mock("@/features/young/server/young-notification-service", () => service);
vi.mock("@/features/young/server/young-subscription-service", () => service);

import { load } from "@/routes/workspace/subscriptions/activities/+page.server";

function event(query: string) {
  return {
    locals: { authUser: { id: "owner" }, locale: "en-us" },
    url: new URL(
      `https://life.example/workspace/subscriptions/activities?${query}`,
    ),
    setHeaders: vi.fn(),
  } as unknown as Parameters<typeof load>[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  service.countUnreadYoungNotifications.mockResolvedValue(20);
});

describe("activity subscription page pagination", () => {
  for (const [view, list] of [
    ["notifications", service.listYoungNotifications],
    ["events", service.listYoungEventSubscriptions],
    ["organizers", service.listYoungOrganizerSubscriptions],
  ] as const) {
    it(`redirects an emptied last ${view} page while preserving filters`, async () => {
      list.mockResolvedValue({
        data: [],
        pagination: { page: 2, pageSize: 20, total: 20, totalPages: 1 },
      });
      await expect(
        load(event(`view=${view}&unread=true&page=2`)),
      ).rejects.toMatchObject({
        status: 303,
        location: `/workspace/subscriptions/activities?view=${view}&unread=true&page=1`,
      });
    });
  }
  it("redirects zero results to page one", async () => {
    service.listYoungNotifications.mockResolvedValue({
      data: [],
      pagination: { page: 3, pageSize: 20, total: 0, totalPages: 0 },
    });
    await expect(
      load(event("view=notifications&unread=true&page=3")),
    ).rejects.toMatchObject({
      status: 303,
      location:
        "/workspace/subscriptions/activities?view=notifications&unread=true&page=1",
    });
  });
  it("keeps a valid last page", async () => {
    service.listYoungNotifications.mockResolvedValue({
      data: [],
      pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
    });
    await expect(
      load(event("view=notifications&unread=true&page=2")),
    ).resolves.toMatchObject({ notifications: { pagination: { page: 2 } } });
  });
});
