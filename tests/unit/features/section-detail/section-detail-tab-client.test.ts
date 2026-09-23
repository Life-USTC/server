import { afterEach, describe, expect, it, vi } from "vitest";
import { createSectionDetailTabPanelStore } from "@/features/section-detail/lib/section-detail-tab-client";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    GET: getMock,
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("createSectionDetailTabPanelStore", () => {
  it("skips client fetch for SSR-seeded tabs", async () => {
    const store = createSectionDetailTabPanelStore("user-1", {
      loadedTabs: ["calendar", "exams"],
      state: {
        commentsData: null,
        descriptionData: {
          description: {
            content: "",
            id: null,
            lastEditedAt: null,
            lastEditedBy: null,
            renderedHtml: "",
            updatedAt: null,
          },
          history: [],
          viewer: {
            image: null,
            isAdmin: false,
            isAuthenticated: true,
            isSuspended: false,
            name: null,
            suspensionExpiresAt: null,
            suspensionReason: null,
            userId: "user-1",
          },
        },
        homeworkAuditLogs: [],
        homeworkViewer: {
          isAdmin: false,
          isAuthenticated: true,
          isSuspended: false,
          userId: "user-1",
        },
        homeworks: [],
        sectionOverlay: {
          exams: [{ examRooms: [], id: 1 }],
          schedules: [{ teachers: [] }],
          teachers: [],
        },
      },
    });

    await store.ensureLoaded("calendar", {
      errorMessage: "failed",
      jwId: 301,
      locale: "zh-cn",
      sectionId: 31,
    });

    expect(getMock).not.toHaveBeenCalled();
    expect(store.isLoaded("calendar")).toBe(true);
  });

  it("requests narrow section detail payloads per tab", async () => {
    getMock.mockResolvedValue({
      data: {
        exams: [{ examRooms: [], id: 3 }],
        schedules: [{ teachers: [] }],
        teachers: [
          {
            department: { namePrimary: "CS" },
            id: 5,
            namePrimary: "Ada",
          },
        ],
      },
      response: { ok: true },
    });

    const store = createSectionDetailTabPanelStore(null);
    const input = {
      errorMessage: "failed",
      jwId: 301,
      locale: "zh-cn" as const,
      sectionId: 31,
    };

    await store.ensureLoaded("calendar", input);
    expect(getMock).toHaveBeenLastCalledWith("/api/catalog/sections/301", {
      params: {
        query: {
          includeExams: "true",
          includeSchedules: "true",
          locale: "zh-cn",
        },
      },
    });

    await store.ensureLoaded("exams", input);
    expect(getMock).toHaveBeenLastCalledWith("/api/catalog/sections/301", {
      params: {
        query: {
          includeExams: "true",
          locale: "zh-cn",
        },
      },
    });

    await store.ensureLoaded("teachers", input);
    expect(getMock).toHaveBeenLastCalledWith("/api/catalog/sections/301", {
      params: {
        query: {
          includeTeacherDepartments: "true",
          locale: "zh-cn",
        },
      },
    });
  });

  it("keeps a failed panel retryable", async () => {
    getMock
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        data: { teachers: [] },
        response: { ok: true },
      });

    const store = createSectionDetailTabPanelStore(null);
    const input = {
      errorMessage: "failed",
      jwId: 301,
      locale: "zh-cn" as const,
      sectionId: 31,
    };

    await expect(store.ensureLoaded("teachers", input)).rejects.toThrow(
      "network error",
    );
    expect(store.isLoaded("teachers")).toBe(false);

    await store.ensureLoaded("teachers", input);
    expect(store.isLoaded("teachers")).toBe(true);
    expect(getMock).toHaveBeenCalledTimes(2);
  });
});
