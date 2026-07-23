/// <reference path="../../src/app.d.ts" />

import { beforeEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("@/app-env", () => ({
  getOptionalTrimmedEnv: () => undefined,
  loadEnv: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
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
  sections: [],
};

const teacher = {
  id: 21,
  namePrimary: "Ada",
  sections: [],
};

const section = {
  code: "001",
  course: {
    id: course.id,
    jwId: course.jwId,
    namePrimary: course.namePrimary,
  },
  id: 31,
  jwId: 301,
  retiredAt: null,
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

function locals(authUser: App.Locals["authUser"] = null): App.Locals {
  return {
    authUser,
    locale: "en-us",
    requestId: "detail-loader-test",
  };
}

function request(path: string) {
  return new Request(`https://example.test${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  getCommentsPayloadMock.mockResolvedValue({
    comments: [],
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
    );
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

    expect(result.descriptionData).toBe(descriptionData);
    expect(result.commentsData).toBeNull();
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
      session: { id: "session-1" },
      user: signedInUser,
    });

    const response = await resolveCourseThroughHook(headers);

    expect(response.status).toBe(200);
    expect(getSessionFromHeadersMock).toHaveBeenCalledOnce();
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
});

describe("section detail loader critical path", () => {
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

    expect(result.descriptionData).toBe(descriptionData);
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
    expect(getSectionHomeworkDataMock).not.toHaveBeenCalled();
  });
});
