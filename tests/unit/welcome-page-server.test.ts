import type { ServerLoadEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentSemesterMock,
  getSessionFromHeadersMock,
  semesterFindManyMock,
  userFindUniqueMock,
} = vi.hoisted(() => ({
  getCurrentSemesterMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
  semesterFindManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@/features/catalog/server/academic-metadata-read-model", () => ({
  getCurrentSemester: getCurrentSemesterMock,
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    semester: { findMany: semesterFindManyMock },
    user: { findUnique: userFindUniqueMock },
  },
}));

import { loadWelcomePage } from "@/features/welcome/server/welcome-page-server";

function loadEvent(search: string) {
  const url = new URL(`https://life.example/account/welcome${search}`);
  return {
    locals: {
      authUser: null,
      locale: "en-us" as const,
      publicSsr: false,
      requestId: "request-1",
    },
    request: new Request(url),
    url,
  } as unknown as ServerLoadEvent;
}

describe("loadWelcomePage", () => {
  beforeEach(() => {
    getCurrentSemesterMock.mockReset();
    getCurrentSemesterMock.mockResolvedValue({ id: 7 });
    getSessionFromHeadersMock.mockReset();
    getSessionFromHeadersMock.mockResolvedValue({ user: { id: "user-1" } });
    semesterFindManyMock.mockReset();
    semesterFindManyMock.mockResolvedValue([{ id: 7, nameCn: "2026 秋" }]);
    userFindUniqueMock.mockReset();
  });

  it("keeps an incomplete profile on the required first step", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      name: null,
      username: null,
      image: null,
      profilePictures: [],
      accounts: [{ provider: "github" }, { provider: "credential" }],
    });

    const data = await loadWelcomePage(loadEvent("?step=finish"));

    expect(data.step).toBe("profile");
    expect(data.backUrl).toBeNull();
    expect(data.nextUrl).toBe(
      "/account/welcome?step=subscriptions&callbackUrl=%2F",
    );
    expect(data.stepIndicators).toEqual([
      { id: "profile", label: "Your profile", number: 1, state: "current" },
      {
        id: "subscriptions",
        label: "Section subscriptions",
        number: 2,
        state: "upcoming",
      },
      { id: "finish", label: "Get started", number: 3, state: "upcoming" },
    ]);
    expect(data.oauthProviders).toEqual([{ id: "github", name: "GitHub" }]);
  });

  it("leaves onboarding when a complete profile requests the first step", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      username: "test-user",
      image: null,
      profilePictures: [],
      accounts: [],
    });

    await expect(
      loadWelcomePage(loadEvent("?callbackUrl=%2Faccount%2Fsettings")),
    ).rejects.toMatchObject({
      location: "/account/settings",
      status: 303,
    });
  });

  it("advances a complete profile through the optional steps", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      username: "test-user",
      image: null,
      profilePictures: [],
      accounts: [],
    });

    const subscriptions = await loadWelcomePage(
      loadEvent("?step=subscriptions&callbackUrl=%2Fworkspace%2Foverview"),
    );
    expect(subscriptions.step).toBe("subscriptions");
    expect(subscriptions.backUrl).toBe(
      "/account/welcome?step=profile&callbackUrl=%2Fworkspace%2Foverview",
    );
    expect(subscriptions.nextUrl).toBe(
      "/account/welcome?step=finish&callbackUrl=%2Fworkspace%2Foverview",
    );
    expect(
      subscriptions.stepIndicators.map(({ id, state }) => [id, state]),
    ).toEqual([
      ["profile", "complete"],
      ["subscriptions", "current"],
      ["finish", "upcoming"],
    ]);

    const finish = await loadWelcomePage(
      loadEvent("?step=finish&callbackUrl=%2Fworkspace%2Foverview"),
    );
    expect(finish.step).toBe("finish");
    expect(finish.nextUrl).toBe("/workspace/overview");
  });
});
