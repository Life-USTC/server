import type { Cookies } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  applyAuthResponseCookiesMock,
  deleteProcessedProfileAvatarMock,
  getSessionFromHeadersMock,
  processProfileAvatarUploadMock,
  updateOwnProfileMock,
} = vi.hoisted(() => ({
  applyAuthResponseCookiesMock: vi.fn(),
  deleteProcessedProfileAvatarMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
  processProfileAvatarUploadMock: vi.fn(),
  updateOwnProfileMock: vi.fn(),
}));

vi.mock("@/features/profile/server/profile-avatar-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/profile/server/profile-avatar-service")
  >("@/features/profile/server/profile-avatar-service");
  return {
    ...actual,
    deleteProcessedProfileAvatar: deleteProcessedProfileAvatarMock,
    processProfileAvatarUpload: processProfileAvatarUploadMock,
  };
});

vi.mock("@/features/profile/server/profile-update-service", () => ({
  updateOwnProfile: updateOwnProfileMock,
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/auth/svelte-auth-actions", () => ({
  applyAuthResponseCookies: applyAuthResponseCookiesMock,
}));

import { ProfileAvatarUploadError } from "@/features/profile/server/profile-avatar-service";
import { completeWelcomeProfile } from "@/features/welcome/server/welcome-complete-action";

const cookies = {} as Cookies;
const locals = {
  authUser: null,
  locale: "en-us" as const,
  publicSsr: false,
  requestId: "request-1",
};

function requestWithForm(entries: Record<string, File | string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return new Request("https://life.example/account/welcome?/complete", {
    body: form,
    method: "POST",
  });
}

describe("completeWelcomeProfile", () => {
  beforeEach(() => {
    applyAuthResponseCookiesMock.mockReset();
    deleteProcessedProfileAvatarMock.mockReset();
    deleteProcessedProfileAvatarMock.mockResolvedValue(undefined);
    getSessionFromHeadersMock.mockReset();
    getSessionFromHeadersMock.mockResolvedValue({ user: { id: "user-1" } });
    processProfileAvatarUploadMock.mockReset();
    updateOwnProfileMock.mockReset();
  });

  it("passes a processed avatar through the trusted profile update boundary", async () => {
    const headers = new Headers();
    processProfileAvatarUploadMock.mockResolvedValue({
      key: "avatars/user-1/avatar.webp",
      url: "/media/avatars/user-1/avatar.webp",
    });
    updateOwnProfileMock.mockResolvedValue({ headers, ok: true });

    await expect(
      completeWelcomeProfile({
        cookies,
        locals,
        request: requestWithForm({
          avatar: new File(["image"], "avatar.png", { type: "image/png" }),
          callbackUrl: "/workspace/overview",
          name: "Test User",
          username: "test-user",
        }),
      }),
    ).rejects.toMatchObject({
      location:
        "/account/welcome?step=subscriptions&callbackUrl=%2Fworkspace%2Foverview",
      status: 303,
    });
    expect(updateOwnProfileMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      image: "/media/avatars/user-1/avatar.webp",
      name: "Test User",
      trustedImageUrl: "/media/avatars/user-1/avatar.webp",
      userId: "user-1",
      username: "test-user",
    });
    expect(applyAuthResponseCookiesMock).toHaveBeenCalledWith(headers, cookies);
  });

  it("removes the processed object when profile validation fails", async () => {
    processProfileAvatarUploadMock.mockResolvedValue({
      key: "avatars/user-1/avatar.webp",
      url: "/media/avatars/user-1/avatar.webp",
    });
    updateOwnProfileMock.mockResolvedValue({
      ok: false,
      reason: "username_taken",
    });

    const result = await completeWelcomeProfile({
      cookies,
      locals,
      request: requestWithForm({
        avatar: new File(["image"], "avatar.png", { type: "image/png" }),
        name: "Test User",
        username: "taken",
      }),
    });

    expect(result.status).toBe(400);
    expect(deleteProcessedProfileAvatarMock).toHaveBeenCalledWith(
      "avatars/user-1/avatar.webp",
    );
  });

  it("maps image processing failures to a user-visible message", async () => {
    processProfileAvatarUploadMock.mockRejectedValue(
      new ProfileAvatarUploadError("too_large"),
    );

    const result = await completeWelcomeProfile({
      cookies,
      locals,
      request: requestWithForm({
        avatar: new File(["image"], "avatar.png", { type: "image/png" }),
        name: "Test User",
        username: "test-user",
      }),
    });

    expect(result.status).toBe(400);
    expect(result.data).toEqual({
      message: "Avatar files must be 5 MB or smaller.",
    });
    expect(updateOwnProfileMock).not.toHaveBeenCalled();
  });
});
