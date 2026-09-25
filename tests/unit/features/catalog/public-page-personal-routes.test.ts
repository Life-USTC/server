import { beforeEach, describe, expect, it, vi } from "vitest";

const { sectionPersonal, signedLinks } = vi.hoisted(() => ({
  sectionPersonal: vi.fn(),
  signedLinks: vi.fn(),
}));
vi.mock("@/features/section-detail/server/section-personal-data", () => ({
  getSectionPersonalData: sectionPersonal,
}));
vi.mock("@/features/catalog-links/server/catalog-link-data", () => ({
  getSignedInCatalogLinksData: signedLinks,
}));

function event(
  input: {
    userId?: string;
    authorization?: string;
    jwId?: string;
    search?: string;
  } = {},
) {
  const url = new URL(
    `https://example.test/_internal/catalog/viewer${input.search ?? ""}`,
  );
  return {
    locals: {
      locale: "en-us",
      authUser: input.userId ? { id: input.userId } : null,
    },
    params: { jwId: input.jwId ?? "301" },
    url,
    request: new Request(url, {
      headers: input.authorization
        ? { authorization: input.authorization }
        : {},
    }),
  } as never;
}
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
}

beforeEach(() => {
  vi.clearAllMocks();
  sectionPersonal.mockResolvedValue({
    viewer: { signedIn: false, isSubscribed: false },
    homeworkData: { homeworks: [] },
  });
  signedLinks.mockResolvedValue({
    catalogLinks: [{ slug: "jw", isPinned: true, clickCount: 7 }],
  });
});

describe("session-only public page overlays", () => {
  it("does not query personal links for anonymous viewers", async () => {
    const { GET } = await import(
      "@/routes/_internal/catalog/links/viewer/+server"
    );
    const response = await GET(event());
    expectPrivate(response);
    expect(await response.json()).toEqual({ signedIn: false, links: null });
    expect(signedLinks).not.toHaveBeenCalled();
  });

  it("loads each session's pins and click counts without reusing another viewer", async () => {
    const { GET } = await import(
      "@/routes/_internal/catalog/links/viewer/+server"
    );
    for (const userId of ["alice", "bob"]) {
      const response = await GET(event({ userId, search: "?userId=mallory" }));
      expectPrivate(response);
      expect(await response.json()).toEqual({
        signedIn: true,
        links: [{ slug: "jw", isPinned: true, clickCount: 7 }],
      });
      expect(signedLinks).toHaveBeenLastCalledWith(userId, "en-us");
    }
  });

  it("forwards focused homework and only the session identity to the section projection", async () => {
    const { GET } = await import(
      "@/routes/_internal/catalog/sections/[jwId]/viewer/+server"
    );
    for (const userId of [undefined, "alice", "bob"]) {
      const response = await GET(
        event({ userId, search: "?homeworkId=hw-1&userId=mallory" }),
      );
      expectPrivate(response);
      expect(response.status).toBe(200);
      expect(sectionPersonal).toHaveBeenLastCalledWith({
        jwId: 301,
        userId: userId ?? null,
        focusedHomeworkId: "hw-1",
      });
    }
  });

  it.each(["links", "section"] as const)(
    "rejects Bearer on %s even with a resolved session",
    async (kind) => {
      const { GET } =
        kind === "links"
          ? await import("@/routes/_internal/catalog/links/viewer/+server")
          : await import(
              "@/routes/_internal/catalog/sections/[jwId]/viewer/+server"
            );
      const response = await GET(
        event({ userId: "alice", authorization: "Bearer token" }),
      );
      expect(response.status).toBe(401);
      expectPrivate(response);
      expect(sectionPersonal).not.toHaveBeenCalled();
      expect(signedLinks).not.toHaveBeenCalled();
    },
  );

  it.each(["links", "section"] as const)(
    "keeps %s failures private",
    async (kind) => {
      sectionPersonal.mockRejectedValue(new Error("database unavailable"));
      signedLinks.mockRejectedValue(new Error("database unavailable"));
      const { GET } =
        kind === "links"
          ? await import("@/routes/_internal/catalog/links/viewer/+server")
          : await import(
              "@/routes/_internal/catalog/sections/[jwId]/viewer/+server"
            );
      const response = await GET(event({ userId: "alice" }));
      expect(response.status).toBe(500);
      expectPrivate(response);
      expect(await response.text()).not.toContain("database unavailable");
    },
  );

  it("does not query malformed section IDs and keeps missing records uncached", async () => {
    const { GET } = await import(
      "@/routes/_internal/catalog/sections/[jwId]/viewer/+server"
    );
    const invalid = await GET(event({ jwId: "invalid" }));
    expect(invalid.status).toBe(400);
    expectPrivate(invalid);
    expect(sectionPersonal).not.toHaveBeenCalled();
    sectionPersonal.mockResolvedValue(null);
    const missing = await GET(event());
    expect(missing.status).toBe(404);
    expectPrivate(missing);
  });
});
