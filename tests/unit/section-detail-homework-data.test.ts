import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSectionHomeworkDetailMock,
  listSectionHomeworksMock,
  renderEmbeddedMarkdownMock,
} = vi.hoisted(() => ({
  getSectionHomeworkDetailMock: vi.fn(),
  listSectionHomeworksMock: vi.fn(),
  renderEmbeddedMarkdownMock: vi.fn(),
}));

vi.mock("@/features/homeworks/server/homework-list-read-model", () => ({
  getSectionHomeworkDetail: getSectionHomeworkDetailMock,
  listSectionHomeworks: listSectionHomeworksMock,
}));

vi.mock("@/lib/components/markdown-preview-renderer", () => ({
  renderEmbeddedMarkdown: renderEmbeddedMarkdownMock,
}));

import { getSectionHomeworkData } from "@/features/section-detail/server/section-detail-homework-data";

const summaryHomework = {
  commentCount: 3,
  completion: { completedAt: new Date("2026-08-01T00:00:00.000Z") },
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  createdById: "creator-1",
  deletedAt: null,
  deletedById: null,
  id: "homework-1",
  isMajor: true,
  publishedAt: new Date("2026-07-02T00:00:00.000Z"),
  requiresTeam: false,
  sectionId: 7,
  submissionDueAt: new Date("2026-08-10T00:00:00.000Z"),
  submissionStartAt: null,
  title: "Homework",
  updatedAt: new Date("2026-07-03T00:00:00.000Z"),
  updatedById: null,
};

const viewer = {
  image: null,
  isAdmin: false,
  isAuthenticated: false,
  isSuspended: false,
  name: null,
  suspensionExpiresAt: null,
  suspensionReason: null,
  userId: null,
};

describe("section homework page data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSectionHomeworksMock.mockResolvedValue({
      homeworks: [summaryHomework],
      viewer,
    });
    getSectionHomeworkDetailMock.mockResolvedValue(null);
    renderEmbeddedMarkdownMock.mockReturnValue("<p>Details</p>");
  });

  it("keeps list SSR summary-only without rendering Markdown", async () => {
    const result = await getSectionHomeworkData(7, null);

    expect(getSectionHomeworkDetailMock).not.toHaveBeenCalled();
    expect(renderEmbeddedMarkdownMock).not.toHaveBeenCalled();
    expect(result.auditLogs).toEqual([]);
    expect(result.homeworks[0]).toEqual(
      expect.objectContaining({
        commentCount: 3,
        completion: { completedAt: "2026-08-01T08:00:00+08:00" },
        id: "homework-1",
      }),
    );
    expect(result.homeworks[0]).not.toHaveProperty("description");
    expect(result.homeworks[0]).not.toHaveProperty("section");
  });

  it("renders Markdown only for an explicitly focused detail", async () => {
    getSectionHomeworkDetailMock.mockResolvedValueOnce({
      auditLogs: [{ id: "audit-1" }],
      homework: {
        ...summaryHomework,
        description: {
          content: "See section#7",
        },
        section: { id: 7 },
      },
    });

    const result = await getSectionHomeworkData(7, null, "homework-1");

    expect(getSectionHomeworkDetailMock).toHaveBeenCalledWith({
      homeworkId: "homework-1",
      userId: null,
    });
    expect(renderEmbeddedMarkdownMock).toHaveBeenCalledWith("See section#7", {
      remarkPlugins: expect.any(Array),
    });
    expect(result.homeworks[0]).toEqual(
      expect.objectContaining({
        description: {
          content: "See section#7",
          renderedHtml: "<p>Details</p>",
        },
      }),
    );
    expect(result.auditLogs).toEqual([{ id: "audit-1" }]);
  });
});
