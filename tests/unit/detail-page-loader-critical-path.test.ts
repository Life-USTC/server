/// <reference path="../../src/app.d.ts" />

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  currentCatalogViewerMock,
  getCommentsPayloadMock,
  getCoursePageMock,
  getDescriptionPayloadMock,
  getSectionDetailUserIdMock,
  getSectionHomeworkDataMock,
  getSectionPageMock,
  getTeacherPageMock,
  getUserSectionSubscriptionStateMock,
  getViewerContextMock,
} = vi.hoisted(() => ({
  currentCatalogViewerMock: vi.fn(),
  getCommentsPayloadMock: vi.fn(),
  getCoursePageMock: vi.fn(),
  getDescriptionPayloadMock: vi.fn(),
  getSectionDetailUserIdMock: vi.fn(),
  getSectionHomeworkDataMock: vi.fn(),
  getSectionPageMock: vi.fn(),
  getTeacherPageMock: vi.fn(),
  getUserSectionSubscriptionStateMock: vi.fn(),
  getViewerContextMock: vi.fn(),
}));

vi.mock("@/features/catalog/server/course-page-data", () => ({
  getCoursePage: getCoursePageMock,
}));

vi.mock("@/features/catalog/server/teacher-page-data", () => ({
  getTeacherPage: getTeacherPageMock,
}));

vi.mock("@/features/catalog/server/catalog-detail-viewer", () => ({
  currentCatalogViewer: currentCatalogViewerMock,
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

vi.mock("@/features/section-detail/server/section-detail-session", () => ({
  getSectionDetailUserId: getSectionDetailUserIdMock,
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

function locals(): App.Locals {
  return {
    authUser: null,
    locale: "en-us",
    requestId: "detail-loader-test",
  };
}

function request(path: string) {
  return new Request(`https://example.test${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  currentCatalogViewerMock.mockResolvedValue(anonymousViewer);
  getCommentsPayloadMock.mockResolvedValue({
    comments: [],
    hiddenCount: 0,
    viewer: anonymousViewer,
  });
  getCoursePageMock.mockResolvedValue(course);
  getDescriptionPayloadMock.mockResolvedValue(descriptionData);
  getSectionDetailUserIdMock.mockResolvedValue(null);
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
      request: request(`/courses/${course.jwId}`),
      url: new URL(`https://example.test/courses/${course.jwId}`),
    });

    await vi.waitFor(() => {
      expect(currentCatalogViewerMock).toHaveBeenCalledOnce();
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
      request: request(`/courses/${course.jwId}/comments`),
      url: new URL(`https://example.test/courses/${course.jwId}/comments`),
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
      request: request(`/teachers/${teacher.id}/sections`),
      url: new URL(`https://example.test/teachers/${teacher.id}/sections`),
    });

    expect(result.descriptionData).toBe(descriptionData);
    expect(result.commentsData).toBeNull();
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
  });
});

describe("section detail loader critical path", () => {
  it("starts section and session work together and skips comments and homework on overview", async () => {
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
      request: request(`/sections/${section.jwId}`),
      url: new URL(`https://example.test/sections/${section.jwId}`),
    });

    await vi.waitFor(() => {
      expect(getSectionDetailUserIdMock).toHaveBeenCalledOnce();
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
      request: request(`/sections/${section.jwId}/homework`),
      url: new URL(`https://example.test/sections/${section.jwId}/homework`),
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
      request: request(`/sections/${section.jwId}/comments`),
      url: new URL(`https://example.test/sections/${section.jwId}/comments`),
    });

    expect(result.commentsData).not.toBeNull();
    expect(getCommentsPayloadMock).toHaveBeenCalledTimes(3);
    expect(getSectionHomeworkDataMock).not.toHaveBeenCalled();
  });

  it("retains subscription state on signed-in sections because the fixed header consumes it", async () => {
    getSectionDetailUserIdMock.mockResolvedValue("user-1");
    getUserSectionSubscriptionStateMock.mockResolvedValue({
      subscribedSections: [section.id],
      subscriptionIcsUrl: "/api/users/user-1/calendar.ics",
    });
    const { loadSectionDetailPage } = await import(
      "@/features/section-detail/server/section-detail-page-server"
    );

    const result = await loadSectionDetailPage({
      locals: locals(),
      params: { jwId: String(section.jwId), section: "teachers" },
      request: request(`/sections/${section.jwId}/teachers`),
      url: new URL(`https://example.test/sections/${section.jwId}/teachers`),
    });

    expect(getUserSectionSubscriptionStateMock).toHaveBeenCalledWith("user-1");
    expect(result.viewer).toMatchObject({
      isSubscribed: true,
      signedIn: true,
      subscriptionIcsUrl: "/api/users/user-1/calendar.ics",
    });
    expect(getCommentsPayloadMock).not.toHaveBeenCalled();
    expect(getSectionHomeworkDataMock).not.toHaveBeenCalled();
  });
});
