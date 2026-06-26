import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("get_my_profile", () => {
  it("returns the authenticated user's REST-equivalent profile fields", async () => {
    const profile = await context.client.call<{
      id?: string;
      email?: string | null;
      name?: string | null;
      username?: string | null;
      isAdmin?: boolean;
      createdAt?: string;
      updatedAt?: string;
    }>("get_my_profile");

    expect(profile.id).toBe(context.devUserId);
    expect(typeof profile.email).toBe("string");
    expect(profile.name).toBe(fixtures.DEV_SEED.debugName);
    expect(profile.username).toBe(fixtures.DEV_SEED.debugUsername);
    expect(profile.isAdmin).toBe(false);
    // Dates are serialized in Asia/Shanghai (+08:00)
    expect(profile.createdAt).toMatch(/\+08:00$/);
    expect(profile.updatedAt).toMatch(/\+08:00$/);
  });
});

describe("get_public_user_profile", () => {
  it("returns public profile hierarchy by username", async () => {
    const profile = await context.client.call<{
      found?: boolean;
      user?: {
        id?: string;
        name?: string | null;
        username?: string | null;
        _count?: {
          comments?: number;
          homeworksCreated?: number;
          subscribedSections?: number;
          uploads?: number;
        };
      };
      sectionCount?: number;
      totalContributions?: number;
      weeks?: Array<Array<{ date?: string; count?: number }>>;
    }>("get_public_user_profile", {
      username: fixtures.DEV_SEED.debugUsername,
      mode: "full",
    });

    expect(profile.found).toBe(true);
    expect(profile.user?.id).toBe(context.devUserId);
    expect(profile.user?.name).toBe(fixtures.DEV_SEED.debugName);
    expect(profile.user?.username).toBe(fixtures.DEV_SEED.debugUsername);
    expect(typeof profile.sectionCount).toBe("number");
    expect(typeof profile.totalContributions).toBe("number");
    expect((profile.weeks?.length ?? 0) > 0).toBe(true);
    expect(profile.weeks?.[0]?.[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof profile.user?._count?.comments).toBe("number");
    expect(typeof profile.user?._count?.uploads).toBe("number");
    expect(typeof profile.user?._count?.homeworksCreated).toBe("number");
    expect(typeof profile.user?._count?.subscribedSections).toBe("number");
  });

  it("returns not_found for missing users", async () => {
    const result = await context.client.call<{
      success?: boolean;
      found?: boolean;
      error?: string;
    }>("get_public_user_profile", {
      username: "missing-integration-user",
    });

    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.error).toBe("not_found");
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
