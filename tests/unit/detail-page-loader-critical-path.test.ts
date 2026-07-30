/// <reference path="../../src/app.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDescriptionPayload } from "@/features/descriptions/server/description-payload";
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
  sameSemesterOtherTeachers: [],
  sameTeacherOtherSemesters: [],
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

  it("loads comments only for the course comments section", async () => {
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    const result = await loadCourseDetailPage({
      locals: locals(),
      params: { jwId: String(course.jwId), section: "comments" },
      request: request(`/catalog/courses/${course.jwId}/comments`),
      url: new URL(
        `https://example.test/catalog/courses/${course.jwId}/comments`,
      ),
    });

    expect(result.commentsData).not.toBeNull();
    expect(getCommentsPayloadMock).toHaveBeenCalledOnce();
    expect(getCommentsPayloadMock).toHaveBeenCalledWith(
      { targetId: course.id, type: "course" },
      anonymousViewer,
      { pageSize: 20 },
    );
  });

  it("loads description history only for the introduction section", async () => {
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    await loadCourseDetailPage({
      locals: locals(),
      params: { jwId: String(course.jwId), section: "introduction" },
      request: request(`/catalog/courses/${course.jwId}/introduction`),
      url: new URL(
        `https://example.test/catalog/courses/${course.jwId}/introduction`,
      ),
    });

    expect(getDescriptionPayloadMock).toHaveBeenCalledWith(
      "course",
      course.id,
      anonymousViewer,
      { includeHistory: true },
    );
  });

  it("coalesces the same anonymous PublicSsr course core across default and introduction tabs", async () => {
    let resolveCourse: ((value: typeof course) => void) | undefined;
    getCoursePageMock.mockReturnValue(
      new Promise<typeof course>((resolve) => {
        resolveCourse = resolve;
      }),
    );
    const { loadCourseDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    const overview = loadCourseDetailPage({
      locals: locals(null, true),
      params: { jwId: String(course.jwId) },
      request: request(`/catalog/courses/${course.jwId}`),
      url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
    });
    const introduction = loadCourseDetailPage({
      locals: locals(null, true),
      params: { jwId: String(course.jwId), section: "introduction" },
      request: request(`/catalog/courses/${course.jwId}/introduction`),
      url: new URL(
        `https://example.test/catalog/courses/${course.jwId}/introduction`,
      ),
    });

    await vi.waitFor(() => expect(getCoursePageMock).toHaveBeenCalledOnce());
    resolveCourse?.(course);
    await Promise.all([overview, introduction]);

    expect(getCoursePageMock).toHaveBeenCalledWith(course.jwId, "en-us", {
      includeSections: false,
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

    expect(getCoursePageMock).toHaveBeenCalledTimes(3);
  });

  it("caches the final anonymous PublicSsr teacher core but bypasses the sections shape", async () => {
    const { loadTeacherDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );
    const load = (section?: "sections") =>
      loadTeacherDetailPage({
        locals: locals(null, true),
        params: { id: String(teacher.id), section },
        request: request(
          `/catalog/teachers/${teacher.id}${section ? `/${section}` : ""}`,
        ),
        url: new URL(
          `https://example.test/catalog/teachers/${teacher.id}${section ? `/${section}` : ""}`,
        ),
      });

    await load();
    await load();
    await load("sections");
    await load("sections");

    expect(getTeacherPageMock).toHaveBeenCalledTimes(3);
    expect(getTeacherPageMock).toHaveBeenNthCalledWith(1, teacher.id, "en-us", {
      includeSections: false,
    });
    expect(getTeacherPageMock).toHaveBeenNthCalledWith(2, teacher.id, "en-us", {
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

  it("uses the colo cache only for reviewed anonymous PublicSsr detail shapes", async () => {
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
        await Promise.all(scheduled);
      },
      executionContext,
    );

    expect(open).toHaveBeenCalledWith("life-ustc-public-detail-core-v1");
    expect(match).toHaveBeenCalledOnce();
    const matchedRequest = match.mock.calls[0]?.[0];
    expect(matchedRequest?.url).toBe(
      `https://example.test/_life-ustc-internal-cache/catalog-detail-core/v1/course/core-without-sections/en-us/${course.jwId}`,
    );
    expect(put).toHaveBeenCalledOnce();

    open.mockClear();
    match.mockClear();
    put.mockClear();
    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await loadCourseDetailPage({
          locals: locals(),
          params: { jwId: String(course.jwId) },
          request: request(`/catalog/courses/${course.jwId}`),
          url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
        });
        await loadCourseDetailPage({
          locals: locals(signedInUser, true),
          params: { jwId: String(course.jwId) },
          request: request(`/catalog/courses/${course.jwId}`),
          url: new URL(`https://example.test/catalog/courses/${course.jwId}`),
        });
        await loadTeacherDetailPage({
          locals: locals(null, true),
          params: { id: String(teacher.id), section: "sections" },
          request: request(`/catalog/teachers/${teacher.id}/sections`),
          url: new URL(
            `https://example.test/catalog/teachers/${teacher.id}/sections`,
          ),
        });
        await loadSectionDetailPage({
          locals: locals(null, true),
          params: { jwId: String(section.jwId), section: "calendar" },
          request: request(`/catalog/sections/${section.jwId}/calendar`),
          url: new URL(
            `https://example.test/catalog/sections/${section.jwId}/calendar`,
          ),
        });
      },
      executionContext,
    );

    expect(open).not.toHaveBeenCalled();
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("skips comments outside the teacher comments section", async () => {
    const { loadTeacherDetailPage } = await import(
      "@/features/catalog/server/catalog-detail-page-server"
    );

    const result = await loadTeacherDetailPage({
      locals: locals(),
      params: { id: String(teacher.id), section: "sections" },
      request: request(`/catalog/teachers/${teacher.id}/sections`),
      url: new URL(
        `https://example.test/catalog/teachers/${teacher.id}/sections`,
      ),
    });

    expect(result.descriptionData).toEqual(
      emptyDescriptionPayload(anonymousViewer),
    );
    expect(result.commentsData).toBeNull();
    expect(getDescriptionPayloadMock).not.toHaveBeenCalled();
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

  it("enables the core cache only for the internal anonymous PublicSsr marker", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const publicSsrHeaders = {
      "x-life-public-ssr": "1",
      "x-life-public-ssr-locale": "en-us",
      "x-life-public-ssr-mode": "page",
    };

    await resolveCourseThroughHook(publicSsrHeaders);
    await resolveCourseThroughHook(publicSsrHeaders);

    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(getCoursePageMock).toHaveBeenCalledOnce();
  });
});

describe("section detail loader critical path", () => {
  it("fails open when a versioned colo entry omits a required section field", async () => {
    const match = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            expiresAt: Date.now() + 30_000,
            schema: "catalog-detail-core-v1",
            value: { ...section, adminClasses: undefined },
          }),
        ),
    );
    const put = vi.fn(async () => undefined);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match, put })),
    });
    const scheduled: Promise<unknown>[] = [];
    const executionContext = {
      waitUntil(promise: Promise<unknown>) {
        scheduled.push(promise);
      },
    };
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    const result = await runWithCloudflareRuntimeEnv(
      {},
      () =>
        loadSectionDetailPage({
          locals: locals(null, true),
          params: { jwId: String(section.jwId) },
          request: request(`/catalog/sections/${section.jwId}`),
          url: new URL(`https://example.test/catalog/sections/${section.jwId}`),
        }),
      executionContext,
    );
    await Promise.all(scheduled);

    expect(match).toHaveBeenCalledOnce();
    expect(getSectionPageMock).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledOnce();
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

  it("loads homework, but not comments, for the homework section", async () => {
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    const result = await loadSectionDetailPage({
      locals: locals(),
      params: { jwId: String(section.jwId), section: "homework" },
      request: request(`/catalog/sections/${section.jwId}/homework`),
      url: new URL(
        `https://example.test/catalog/sections/${section.jwId}/homework`,
      ),
    });

    expect(result.descriptionData).toEqual(
      emptyDescriptionPayload(anonymousViewer),
    );
    expect(getDescriptionPayloadMock).not.toHaveBeenCalled();
    expect(getSectionHomeworkDataMock).toHaveBeenCalledWith(section.id, null);
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
  });

  it("loads comments, but not homework, for the comments section", async () => {
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    const result = await loadSectionDetailPage({
      locals: locals(),
      params: { jwId: String(section.jwId), section: "comments" },
      request: request(`/catalog/sections/${section.jwId}/comments`),
      url: new URL(
        `https://example.test/catalog/sections/${section.jwId}/comments`,
      ),
    });

    expect(result.commentsData).not.toBeNull();
    expect(getCommentsPayloadMock).toHaveBeenCalledTimes(3);
    expect(getDescriptionPayloadMock).not.toHaveBeenCalled();
    expect(getSectionHomeworkDataMock).not.toHaveBeenCalled();
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
      params: { jwId: String(section.jwId), section: "teachers" },
      request: request(`/catalog/sections/${section.jwId}/teachers`),
      url: new URL(
        `https://example.test/catalog/sections/${section.jwId}/teachers`,
      ),
    });

    expect(getUserSectionSubscriptionStateMock).toHaveBeenCalledWith("user-1");
    expect(result.viewer).toMatchObject({
      isSubscribed: true,
      signedIn: true,
      subscriptionIcsUrl: "/api/calendar-feeds/user-1.ics",
    });
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
    expect(getDescriptionPayloadMock).not.toHaveBeenCalled();
    expect(getSectionHomeworkDataMock).not.toHaveBeenCalled();
  });

  it("caches the anonymous PublicSsr section overview core with related data included", async () => {
    const relatedSection = {
      ...section,
      sameSemesterOtherTeachers: [{ id: 32 }],
      sameTeacherOtherSemesters: [],
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

    expect(getSectionPageMock).toHaveBeenCalledOnce();
    expect(getSectionPageMock).toHaveBeenCalledWith(section.jwId, "en-us", {
      includeExams: false,
      includeRelated: true,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });
    expect(withSectionPageRelatedDataMock).not.toHaveBeenCalled();
    expect(first.section).toBe(relatedSection);
    expect(second.section).toBe(relatedSection);
  });

  it.each([
    "calendar",
    "exams",
  ] as const)("does not cache the section %s tab shape", async (detailSection) => {
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );
    const load = () =>
      loadSectionDetailPage({
        locals: locals(null, true),
        params: { jwId: String(section.jwId), section: detailSection },
        request: request(`/catalog/sections/${section.jwId}/${detailSection}`),
        url: new URL(
          `https://example.test/catalog/sections/${section.jwId}/${detailSection}`,
        ),
      });

    await load();
    await load();

    expect(getSectionPageMock).toHaveBeenCalledTimes(2);
  });
});
