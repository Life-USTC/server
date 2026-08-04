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
      examCount: 0,
      exams: [],
      id: 31,
      jwId: 301,
      sameSemesterOtherTeachers: [],
      sameTeacherOtherSemesters: [],
      scheduleCount: 0,
      schedules: [],
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
  it("always marks introduction from SSR description payload", () => {
    expect(getSsrLoadedSectionDetailTabs(basePageData())).toContain(
      "introduction",
    );
  });

  it("marks homework when SSR fetched homework or focused homework", () => {
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({
          homeworkData: {
            ...basePageData().homeworkData,
            homeworks: [{ id: "hw-1" } as never],
          },
        }),
      ),
    ).toContain("homework");
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({ focusedHomeworkId: "hw-1" }),
      ),
    ).toContain("homework");
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({
          homeworkData: {
            ...basePageData().homeworkData,
            viewer: {
              ...basePageData().homeworkData.viewer,
              isAuthenticated: true,
            },
          },
        }),
      ),
    ).toContain("homework");
    expect(getSsrLoadedSectionDetailTabs(basePageData())).not.toContain(
      "homework",
    );
  });

  it("marks calendar and exams when SSR included child arrays", () => {
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({
          section: {
            ...basePageData().section,
            examCount: 1,
            exams: [{ examRooms: [], id: 9 }],
            scheduleCount: 1,
            schedules: [{ teachers: [] }],
          },
        }),
      ),
    ).toEqual(expect.arrayContaining(["introduction", "calendar", "exams"]));
  });

  it("treats zero-count schedule and exam sections as SSR-loaded", () => {
    const loaded = getSsrLoadedSectionDetailTabs(basePageData());
    expect(loaded).toContain("calendar");
    expect(loaded).toContain("exams");
  });

  it("defers teachers when departments were not SSR-expanded", () => {
    expect(getSsrLoadedSectionDetailTabs(basePageData())).not.toContain(
      "teachers",
    );
    expect(
      getSsrLoadedSectionDetailTabs(
        basePageData({
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
  });
});

describe("buildSectionDetailTabPanelSsrState", () => {
  it("seeds overlay fields from SSR section data", () => {
    const data = basePageData({
      section: {
        ...basePageData().section,
        examCount: 1,
        exams: [{ examRooms: [], id: 42 }],
        scheduleCount: 1,
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

  it("leaves teacher overlay empty when departments were not SSR-expanded", () => {
    const state = buildSectionDetailTabPanelSsrState(
      basePageData(),
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
