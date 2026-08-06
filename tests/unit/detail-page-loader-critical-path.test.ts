/// <reference path="../../src/app.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const {
  getCommentsPayloadMock,
  getCoursePageMock,
  getDescriptionPayloadMock,
  getSessionFromHeadersMock,
  getSectionHomeworkDataMock,
  getSectionPageMock,
  getTeacherPageMock,
  getUserSectionSubscriptionStateMock,
  getViewerContextMock,
  withSectionPageRelatedDataMock,
} = vi.hoisted(() => ({
  getCommentsPayloadMock: vi.fn(),
  getCoursePageMock: vi.fn(),
  getDescriptionPayloadMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
  getSectionHomeworkDataMock: vi.fn(),
  getSectionPageMock: vi.fn(),
  getTeacherPageMock: vi.fn(),
  getUserSectionSubscriptionStateMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  withSectionPageRelatedDataMock: vi.fn(),
}));

vi.mock("@/app-env", () => ({
  getOptionalTrimmedEnv: () => undefined,
  loadEnv: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
  getSessionFromHeadersWithResponseHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/features/catalog/server/course-page-data", () => ({
  getCoursePage: getCoursePageMock,
}));

vi.mock("@/features/catalog/server/teacher-page-data", () => ({
  getTeacherPage: getTeacherPageMock,
}));

vi.mock("@/features/comments/server/comments-server", () => ({
  getCommentsPayload: getCommentsPayloadMock,
}));

vi.mock("@/features/descriptions/server/descriptions-server", () => ({
  getDescriptionPayload: getDescriptionPayloadMock,
}));

vi.mock("@/features/section-detail/server/section-page-data", () => ({
  getSectionPage: getSectionPageMock,
  withSectionPageRelatedData: withSectionPageRelatedDataMock,
}));

vi.mock(
  "@/features/section-detail/server/section-detail-homework-data",
  () => ({
    getSectionHomeworkData: getSectionHomeworkDataMock,
  }),
);

vi.mock("@/features/subscriptions/server/subscriptions", () => ({
  getUserSectionSubscriptionState: getUserSectionSubscriptionStateMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: vi.fn(async () => "test-revision"),
  resetCatalogDetailCacheRevisionForTest: vi.fn(),
}));

const anonymousViewer = {
  image: null,
  isAdmin: false,
  isAuthenticated: false,
  isSuspended: false,
  name: null,
  suspensionExpiresAt: null,
  suspensionReason: null,
  userId: null,
};

const descriptionData = {
  description: {
    content: "Primary SSR description",
    id: "description-1",
    lastEditedAt: null,
    lastEditedBy: null,
    updatedAt: null,
  },
  history: [],
  viewer: anonymousViewer,
};

const course = {
  code: "MATH1001",
  id: 11,
  jwId: 101,
  namePrimary: "Calculus",
  sectionCount: 0,
  sections: [],
};

const teacher = {
  id: 21,
  namePrimary: "Ada",
  sectionCount: 0,
  sections: [],
};

const section = {
  adminClasses: [],
  code: "001",
  course: {
    id: course.id,
    jwId: course.jwId,
    namePrimary: course.namePrimary,
  },
  courseId: course.id,
  examCount: 0,
  exams: [],
  id: 31,
  jwId: 301,
  retiredAt: null,
  otherCourseSections: [],
  scheduleCount: 0,
  schedules: [],
  semesterId: 1,
  teachers: [{ id: teacher.id, namePrimary: teacher.namePrimary }],
};

const signedInUser = {
  email: "user@example.test",
  id: "user-1",
  image: null,
  isAdmin: false,
  name: "User",
  profilePictures: [],
  username: "user",
};

function locals(
  authUser: App.Locals["authUser"] = null,
  publicSsr = false,
  locale: App.Locals["locale"] = "en-us",
): App.Locals {
  return {
    authUser,
    locale,
    publicSsr,
    requestId: "detail-loader-test",
  };
}

function request(path: string) {
  return new Request(`https://example.test${path}`);
}

beforeEach(() => {
  delete (
    globalThis as typeof globalThis & {
      __lifeUstcPublicRuntimeCache?: unknown;
    }
  ).__lifeUstcPublicRuntimeCache;
  vi.clearAllMocks();
  getCommentsPayloadMock.mockResolvedValue({
    comments: [],
    complete: true,
    hiddenCount: 0,
    viewer: anonymousViewer,
  });
  getCoursePageMock.mockResolvedValue(course);
  getDescriptionPayloadMock.mockResolvedValue(descriptionData);
  getSessionFromHeadersMock.mockResolvedValue(null);
  getSectionHomeworkDataMock.mockResolvedValue({
    auditLogs: [],
    homeworks: [],
    viewer: anonymousViewer,
  });
  getSectionPageMock.mockResolvedValue(section);
  getTeacherPageMock.mockResolvedValue(teacher);
  getUserSectionSubscriptionStateMock.mockResolvedValue({
    subscribedSections: [],
    subscriptionIcsUrl: null,
  });
  getViewerContextMock.mockResolvedValue(anonymousViewer);
  withSectionPageRelatedDataMock.mockImplementation(
    async (value: typeof section) => value,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catalog detail loader critical path", () => {
  it("starts course and viewer work together and skips comments outside the comments section", async () => {
    let resolveCourse: ((value: typeof course) => void) | undefined;
    getCoursePageMock.mockReturnValue(
      new Promise<typeof course>((resolve) => {
        resolveCourse = resolve;
      }),
    );
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    const resultPromise = loadCourseDetailPage({
      locals: locals(),
      params: { jwId: String(course.jwId) },
      request: request(`/catalog/courses/${course.jwId}`),
      url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
    });

    await vi.waitFor(() => {
      expect(getViewerContextMock).toHaveBeenCalledOnce();
    });
    expect(getDescriptionPayloadMock).not.toHaveBeenCalled();

    resolveCourse?.(course);
    const result = await resultPromise;

    expect(result.descriptionData).toBe(descriptionData);
    expect(result.structuredDataJson).toContain("Primary SSR description");
    expect(result.commentsData).toBeNull();
    expect(getDescriptionPayloadMock).toHaveBeenCalledWith(
      "course",
      course.id,
      anonymousViewer,
      { includeHistory: false },
    );
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
  });

  it("skips comments on course detail (client-fetched only)", async () => {
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    const result = await loadCourseDetailPage({
      locals: locals(),
      params: { jwId: String(course.jwId) },
      request: request(`/catalog/courses/${course.jwId}`),
      url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
    });

    expect(result.commentsData).toBeNull();
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
  });

  it("loads description without history on the stream layout", async () => {
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    await loadCourseDetailPage({
      locals: locals(),
      params: { jwId: String(course.jwId) },
      request: request(`/catalog/courses/${course.jwId}`),
      url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
    });

    expect(getDescriptionPayloadMock).toHaveBeenCalledWith(
      "course",
      course.id,
      anonymousViewer,
      { includeHistory: false },
    );
  });

  it("loads course sections for anonymous PublicSsr stream pages", async () => {
    getCoursePageMock.mockResolvedValue(course);
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    await loadCourseDetailPage({
      locals: locals(null, true),
      params: { jwId: String(course.jwId) },
      request: request(`/catalog/courses/${course.jwId}`),
      url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
    });
    await loadCourseDetailPage({
      locals: locals(null, true),
      params: { jwId: String(course.jwId) },
      request: request(`/catalog/courses/${course.jwId}`),
      url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
    });

    expect(getCoursePageMock).toHaveBeenCalledTimes(2);
    expect(getCoursePageMock).toHaveBeenCalledWith(course.jwId, "en-us", {
      includeSections: true,
    });
  });

  it("separates public detail core entries by locale and entity", async () => {
    getCoursePageMock.mockImplementation(async (jwId: number) => ({
      ...course,
      id: jwId,
      jwId,
    }));
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );
    const load = (jwId: number, locale: App.Locals["locale"]) =>
      loadCourseDetailPage({
        locals: locals(null, true, locale),
        params: { jwId: String(jwId) },
        request: request(`/catalog/courses/${jwId}`),
        url: new URL(`https://example.test/catalog/courses/${jwId}`),
      });

    await load(course.jwId, "en-us");
    await load(course.jwId, "zh-cn");
    await load(course.jwId + 1, "en-us");
    await load(course.jwId, "en-us");

    // Stream pages always include sections, so PublicSsr no longer caches the
    // lightweight core-without-sections payload.
    expect(getCoursePageMock).toHaveBeenCalledTimes(4);
  });

  it("loads teacher sections for anonymous and signed-in stream pages", async () => {
    const { loadTeacherDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );
    const loadPublicCore = () =>
      loadTeacherDetailPage({
        locals: locals(null, true),
        params: { id: String(teacher.id) },
        request: request(`/catalog/teachers/${teacher.id}`),
        url: new URL(`https://example.test/catalog/teachers/${teacher.id}`),
      });
    const loadSignedInWithSections = () =>
      loadTeacherDetailPage({
        locals: locals(signedInUser, true),
        params: { id: String(teacher.id) },
        request: request(`/catalog/teachers/${teacher.id}`),
        url: new URL(`https://example.test/catalog/teachers/${teacher.id}`),
      });

    await loadPublicCore();
    await loadPublicCore();
    await loadSignedInWithSections();
    await loadSignedInWithSections();

    expect(getTeacherPageMock).toHaveBeenCalledTimes(4);
    expect(getTeacherPageMock).toHaveBeenCalledWith(teacher.id, "en-us", {
      includeSections: true,
    });
  });

  it("bypasses public detail core caching for default dynamic and authenticated SSR", async () => {
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );
    const load = (loadLocals: App.Locals) =>
      loadCourseDetailPage({
        locals: loadLocals,
        params: { jwId: String(course.jwId) },
        request: request(`/catalog/courses/${course.jwId}`),
        url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
      });

    await load(locals());
    await load(locals());
    await load(locals(signedInUser, true));
    await load(locals(signedInUser, true));

    expect(getCoursePageMock).toHaveBeenCalledTimes(4);
  });

  it("does not use colo cache for stream catalog detail pages", async () => {
    const match = vi.fn(async (_request: Request) => undefined);
    const put = vi.fn(
      async (_request: Request, _response: Response) => undefined,
    );
    const open = vi.fn(async () => ({ match, put }));
    vi.stubGlobal("caches", { open });
    const scheduled: Promise<unknown>[] = [];
    const executionContext = {
      waitUntil(promise: Promise<unknown>) {
        scheduled.push(promise);
      },
    };
    const { loadCourseDetailPage, loadTeacherDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await loadCourseDetailPage({
          locals: locals(null, true),
          params: { jwId: String(course.jwId) },
          request: request(`/catalog/courses/${course.jwId}`),
          url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
        });
        await loadTeacherDetailPage({
          locals: locals(null, true),
          params: { id: String(teacher.id) },
          request: request(`/catalog/teachers/${teacher.id}`),
          url: new URL(`https://example.test/catalog/teachers/${teacher.id}`),
        });
        await loadSectionDetailPage({
          locals: locals(null, true),
          params: { jwId: String(section.jwId) },
          request: request(`/catalog/sections/${section.jwId}`),
          url: new URL(`https://example.test/catalog/sections/${section.jwId}`),
        });
        await Promise.all(scheduled);
      },
      executionContext,
    );

    expect(open).not.toHaveBeenCalled();
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("loads description in stream layout and defers comments to client", async () => {
    const { loadTeacherDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    const result = await loadTeacherDetailPage({
      locals: locals(),
      params: { id: String(teacher.id) },
      request: request(`/catalog/teachers/${teacher.id}#sections`),
      url: new URL(
        `https://example.test/catalog/teachers/${teacher.id}#sections`,
      ),
    });

    expect(result.descriptionData).toEqual(descriptionData);
    expect(result.commentsData).toBeNull();
    expect(getDescriptionPayloadMock).toHaveBeenCalled();
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
  });
});

describe("detail request session resolution", () => {
  async function resolveCourseThroughHook(headers?: HeadersInit) {
    const request = new Request(
      `https://example.test/catalog/courses/${course.jwId}`,
      {
        headers,
      },
    );
    const event = {
      cookies: { get: vi.fn(() => undefined) },
      locals: locals(),
      platform: undefined,
      request,
      route: { id: "/catalog/courses/[jwId]" },
      url: new URL(request.url),
    };
    const { handle } = await import("@/hooks.server");
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    return handle({
      event,
      resolve: async (resolvedEvent: { locals: App.Locals }) => {
        await loadCourseDetailPage({
          locals: resolvedEvent.locals,
          params: { jwId: String(course.jwId) },
          request,
          url: new URL(request.url),
        });
        return new Response('<html lang="zh-CN"><script></script></html>', {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
    } as unknown as Parameters<typeof handle>[0]);
  }

  it.each([
    ["cookie", { cookie: "better-auth.session_token=session-token" }],
    ["bearer", { authorization: "Bearer access-token" }],
  ])("parses a signed-in %s session once in the hook and reuses locals in the detail loader", async (_authKind, headers) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    getSessionFromHeadersMock.mockResolvedValue({
      headers: new Headers({
        "set-cookie":
          "better-auth.session_token=refreshed-token; Path=/; HttpOnly",
      }),
      session: {
        session: { id: "session-1" },
        user: signedInUser,
      },
    });

    const response = await resolveCourseThroughHook(headers);

    expect(response.status).toBe(200);
    expect(getSessionFromHeadersMock).toHaveBeenCalledOnce();
    expect(response.headers.get("set-cookie")).toContain("refreshed-token");
    expect(getViewerContextMock).toHaveBeenCalledWith({
      userId: signedInUser.id,
    });
  });

  it("does not initialize Better Auth for an anonymous detail request", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await resolveCourseThroughHook();

    expect(response.status).toBe(200);
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(getViewerContextMock).toHaveBeenCalledWith({ userId: null });
  });

  it("does not cache anonymous PublicSsr course stream pages without sections omit", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const publicSsrHeaders = {
      "x-life-public-ssr": "1",
      "x-life-public-ssr-locale": "en-us",
      "x-life-public-ssr-mode": "page",
    };

    await resolveCourseThroughHook(publicSsrHeaders);
    await resolveCourseThroughHook(publicSsrHeaders);

    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(getCoursePageMock).toHaveBeenCalledTimes(2);
    expect(getCoursePageMock).toHaveBeenCalledWith(course.jwId, "en-us", {
      includeSections: true,
    });
  });
});

describe("section detail loader critical path", () => {
  it("loads section detail without public overview colo cache on stream pages", async () => {
    const match = vi.fn(async () => undefined);
    const put = vi.fn(async () => undefined);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match, put })),
    });
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    const result = await loadSectionDetailPage({
      locals: locals(null, true),
      params: { jwId: String(section.jwId) },
      request: request(`/catalog/sections/${section.jwId}`),
      url: new URL(`https://example.test/catalog/sections/${section.jwId}`),
    });

    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(getSectionPageMock).toHaveBeenCalledOnce();
    expect(result.section).toBe(section);
  });

  it("loads the section while reusing hook auth and skips comments and homework on overview", async () => {
    let resolveSection: ((value: typeof section) => void) | undefined;
    getSectionPageMock.mockReturnValue(
      new Promise<typeof section>((resolve) => {
        resolveSection = resolve;
      }),
    );
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    const resultPromise = loadSectionDetailPage({
      locals: locals(),
      params: { jwId: String(section.jwId) },
      request: request(`/catalog/sections/${section.jwId}`),
      url: new URL(`https://example.test/catalog/sections/${section.jwId}`),
    });

    await vi.waitFor(() => {
      expect(getSectionPageMock).toHaveBeenCalledOnce();
    });
    expect(getDescriptionPayloadMock).not.toHaveBeenCalled();

    resolveSection?.(section);
    const result = await resultPromise;

    expect(result.descriptionData).toBe(descriptionData);
    expect(result.structuredDataJson).toContain("Primary SSR description");
    expect(result.commentsData).toBeNull();
    expect(result.homeworkData.homeworks).toEqual([]);
    expect(result.viewer).toEqual({
      isSubscribed: false,
      signedIn: false,
      subscriptionIcsUrl: null,
    });
    expect(getDescriptionPayloadMock).toHaveBeenCalledWith(
      "section",
      section.id,
      anonymousViewer,
      { includeHistory: false },
    );
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
    expect(getSectionHomeworkDataMock).not.toHaveBeenCalled();
    expect(getUserSectionSubscriptionStateMock).not.toHaveBeenCalled();
  });

  it("redirects legacy tab query params to canonical hash URLs", async () => {
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    await expect(
      loadSectionDetailPage({
        locals: locals(),
        params: { jwId: String(section.jwId) },
        request: request(`/catalog/sections/${section.jwId}?tab=homework`),
        url: new URL(
          `https://example.test/catalog/sections/${section.jwId}?tab=homework`,
        ),
      }),
    ).rejects.toMatchObject({
      location: `/catalog/sections/${section.jwId}#homework`,
      status: 308,
    });
  });

  it("loads homework when homeworkId is present and still defers comments to client", async () => {
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    const result = await loadSectionDetailPage({
      locals: locals(),
      params: { jwId: String(section.jwId) },
      request: request(`/catalog/sections/${section.jwId}?homeworkId=hw-1`),
      url: new URL(
        `https://example.test/catalog/sections/${section.jwId}?homeworkId=hw-1`,
      ),
    });

    expect(result.detailSection).toBe("overview");
    expect(result.focusedHomeworkId).toBe("hw-1");
    expect(result.commentsData).toBeNull();
    expect(result.homeworkData.homeworks).toEqual([]);
    expect(getSectionHomeworkDataMock).toHaveBeenCalledOnce();
    expect(getSectionHomeworkDataMock).toHaveBeenCalledWith(section.id, null);
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
  });

  it("retains subscription state on signed-in sections because the fixed header consumes it", async () => {
    getUserSectionSubscriptionStateMock.mockResolvedValue({
      subscribedSections: [section.id],
      subscriptionIcsUrl: "/api/calendar-feeds/user-1.ics",
    });
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    const result = await loadSectionDetailPage({
      locals: locals(signedInUser),
      params: { jwId: String(section.jwId) },
      request: request(`/catalog/sections/${section.jwId}`),
      url: new URL(`https://example.test/catalog/sections/${section.jwId}`),
    });

    expect(getUserSectionSubscriptionStateMock).toHaveBeenCalledWith("user-1");
    expect(result.viewer).toMatchObject({
      isSubscribed: true,
      signedIn: true,
      subscriptionIcsUrl: "/api/calendar-feeds/user-1.ics",
    });
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
    expect(getDescriptionPayloadMock).toHaveBeenCalled();
    expect(getSectionHomeworkDataMock).toHaveBeenCalledWith(
      section.id,
      signedInUser.id,
    );
  });

  it("loads full stream section data for anonymous PublicSsr requests", async () => {
    const relatedSection = {
      ...section,
      otherCourseSections: [{ id: 32 }],
    };
    getSectionPageMock.mockResolvedValue(relatedSection);
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );
    const load = () =>
      loadSectionDetailPage({
        locals: locals(null, true),
        params: { jwId: String(section.jwId) },
        request: request(`/catalog/sections/${section.jwId}`),
        url: new URL(`https://example.test/catalog/sections/${section.jwId}`),
      });

    const [first, second] = await Promise.all([load(), load()]);

    expect(getSectionPageMock).toHaveBeenCalledTimes(2);
    expect(getSectionPageMock).toHaveBeenCalledWith(section.jwId, "en-us", {
      includeExams: true,
      includeRelated: true,
      includeSchedules: true,
      includeTeacherDepartments: true,
    });
    expect(withSectionPageRelatedDataMock).not.toHaveBeenCalled();
    expect(first.section).toBe(relatedSection);
    expect(second.section).toBe(relatedSection);
  });

  it("loads full stream section data for signed-in requests without overview cache", async () => {
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    await loadSectionDetailPage({
      locals: locals(signedInUser),
      params: { jwId: String(section.jwId) },
      request: request(`/catalog/sections/${section.jwId}`),
      url: new URL(`https://example.test/catalog/sections/${section.jwId}`),
    });
    await loadSectionDetailPage({
      locals: locals(signedInUser),
      params: { jwId: String(section.jwId) },
      request: request(`/catalog/sections/${section.jwId}`),
      url: new URL(`https://example.test/catalog/sections/${section.jwId}`),
    });

    expect(getSectionPageMock).toHaveBeenCalledTimes(2);
    expect(getSectionPageMock).toHaveBeenCalledWith(section.jwId, "en-us", {
      includeExams: true,
      includeRelated: true,
      includeSchedules: true,
      includeTeacherDepartments: true,
    });
  });
});
