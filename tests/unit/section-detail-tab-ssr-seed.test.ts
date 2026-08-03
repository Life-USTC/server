import { describe, expect, it } from "vitest";
import { emptyDescriptionPayload } from "@/features/descriptions/lib/description-empty-payload";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-types";
import {
  applySectionDetailTabPanelPatch,
  emptySectionDetailTabPanelState,
} from "@/features/section-detail/lib/section-detail-tab-client";
import {
  buildSectionDetailTabPanelSsrState,
  getSsrLoadedSectionDetailTabs,
  sectionTeachersIncludeDepartments,
} from "@/features/section-detail/lib/section-detail-tab-ssr-seed";

const userId = "user-1";

function basePageData(
  overrides: Partial<SectionDetailPageData> = {},
): SectionDetailPageData {
  return {
    commentsData: null,
    copy: {} as SectionDetailPageData["copy"],
    descriptionData: emptyDescriptionPayload({
      image: null,
      isAdmin: false,
      isAuthenticated: false,
      isSuspended: false,
      name: null,
      suspensionExpiresAt: null,
      suspensionReason: null,
      userId: null,
    }),
    detailSection: "overview",
    focusedHomeworkId: null,
    homeworkData: {
      auditLogs: [],
      homeworks: [],
      viewer: {
        isAdmin: false,
        isAuthenticated: false,
        isSuspended: false,
        userId: null,
      },
    },
    homeworkView: "cards",
    locale: "zh-cn",
    section: {
      adminClasses: [],
      code: "001",
      course: { id: 1, jwId: 101, namePrimary: "Calculus" },
      courseId: 1,
      examCount: 1,
      exams: [{ examRooms: [], id: 9 }],
      id: 31,
      jwId: 301,
      sameSemesterOtherTeachers: [],
      sameTeacherOtherSemesters: [],
      scheduleCount: 1,
      schedules: [{ teachers: [] }],
      teachers: [{ id: 1, namePrimary: "Ada" }],
    },
    showSubscribeDialog: false,
    structuredDataJson: "{}",
    todayCalendarKey: "2026-03-01",
    viewer: { signedIn: false },
    ...overrides,
  };
}

describe("getSsrLoadedSectionDetailTabs", () => {
  it("marks homework when the homework tab or focused homework is SSR-loaded", () => {
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({ detailSection: "homework" }),
      ),
    ).toContain("homework");
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({ focusedHomeworkId: "hw-1" }),
      ),
    ).toContain("homework");
    expect(getSsrLoadedSectionDetailTabs(basePageData())).not.toContain(
      "homework",
    );
  });

  it("marks introduction when SSR fetched description content", () => {
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({ detailSection: "introduction" }),
      ),
    ).toContain("introduction");
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({
          descriptionData: {
            ...basePageData().descriptionData,
            description: {
              ...basePageData().descriptionData.description,
              content: "Course intro",
            },
          },
        }),
      ),
    ).toContain("introduction");
    expect(getSsrLoadedSectionDetailTabs(basePageData())).not.toContain(
      "introduction",
    );
  });

  it("marks teachers only when department-expanded teachers were SSR-loaded", () => {
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({
          detailSection: "teachers",
          section: {
            ...basePageData().section,
            teachers: [
              {
                department: { namePrimary: "CS" },
                id: 1,
                namePrimary: "Ada",
              } as SectionDetailPageData["section"]["teachers"][number],
            ],
          },
        }),
      ),
    ).toContain("teachers");

    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({
          detailSection: "teachers",
          section: {
            ...basePageData().section,
            teachers: [{ id: 1, namePrimary: "Ada" }],
          },
        }),
      ),
    ).not.toContain("teachers");
  });

  it("marks calendar and exams from the matching SSR tab", () => {
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({ detailSection: "calendar" }),
      ),
    ).toEqual(expect.arrayContaining(["calendar", "exams"]));

    expect(
      getSsrLoadedSectionDetailTabs(basePageData({ detailSection: "exams" })),
    ).toEqual(["exams"]);

    expect(getSsrLoadedSectionDetailTabs(basePageData())).not.toContain(
      "calendar",
    );
  });

  it("does not treat overview schedules as calendar SSR data", () => {
    const loaded = getSsrLoadedSectionDetailTabs(basePageData());
    expect(loaded).not.toContain("calendar");
    expect(loaded).not.toContain("exams");
  });
});

describe("buildSectionDetailTabPanelSsrState", () => {
  it("seeds overlay fields from SSR section data", () => {
    const data = basePageData({
      detailSection: "calendar",
      section: {
        ...basePageData().section,
        exams: [{ examRooms: [], id: 42 }],
        schedules: [{ teachers: [] }],
      },
    });

    const state = buildSectionDetailTabPanelSsrState(
      data,
      emptySectionDetailTabPanelState,
      applySectionDetailTabPanelPatch,
      userId,
    );

    expect(state.sectionOverlay.schedules).toEqual([{ teachers: [] }]);
    expect(state.sectionOverlay.exams).toEqual([{ examRooms: [], id: 42 }]);
  });

  it("leaves overlay empty when SSR tab mapping does not match", () => {
    const state = buildSectionDetailTabPanelSsrState(
      basePageData({
        detailSection: "teachers",
        section: {
          ...basePageData().section,
          teachers: [{ id: 1, namePrimary: "Ada" }],
        },
      }),
      emptySectionDetailTabPanelState,
      applySectionDetailTabPanelPatch,
      userId,
    );

    expect(state.sectionOverlay.teachers).toEqual([]);
  });
});

describe("sectionTeachersIncludeDepartments", () => {
  it("detects department-expanded teacher payloads", () => {
    expect(
      sectionTeachersIncludeDepartments([
        {
          department: { namePrimary: "CS" },
          id: 1,
          namePrimary: "Ada",
        } as SectionDetailPageData["section"]["teachers"][number],
      ]),
    ).toBe(true);
    expect(
      sectionTeachersIncludeDepartments([{ id: 1, namePrimary: "Ada" }]),
    ).toBe(false);
  });
});
