import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-types";
import type { SectionDetailTab } from "@/features/section-detail/lib/section-detail-tab";
import type {
  SectionDetailTabPanelSsrSeed,
  SectionDetailTabPanelState,
} from "@/features/section-detail/lib/section-detail-tab-client";

export function sectionTeachersIncludeDepartments(
  teachers: SectionDetailPageData["section"]["teachers"],
): boolean {
  return teachers.some(
    (teacher) =>
      teacher != null &&
      typeof teacher === "object" &&
      "department" in teacher &&
      teacher.department != null,
  );
}

export function getSsrLoadedSectionDetailTabs(
  data: Pick<
    SectionDetailPageData,
    "descriptionData" | "detailSection" | "focusedHomeworkId" | "section"
  >,
): SectionDetailTab[] {
  const loaded: SectionDetailTab[] = [];

  if (data.detailSection === "homework" || data.focusedHomeworkId != null) {
    loaded.push("homework");
  }

  if (
    data.detailSection === "introduction" ||
    data.descriptionData.description.content
  ) {
    loaded.push("introduction");
  }

  if (
    data.detailSection === "teachers" &&
    sectionTeachersIncludeDepartments(data.section.teachers)
  ) {
    loaded.push("teachers");
  }

  if (data.detailSection === "calendar") {
    loaded.push("calendar");
  }

  if (data.detailSection === "exams" || data.detailSection === "calendar") {
    loaded.push("exams");
  }

  return loaded;
}

export function buildSectionDetailTabPanelSsrState(
  data: SectionDetailPageData,
  createEmptyState: (userId: string | null) => SectionDetailTabPanelState,
  applyPatch: (
    state: SectionDetailTabPanelState,
    patch: Partial<SectionDetailTabPanelState> & {
      sectionOverlay?: Partial<SectionDetailTabPanelState["sectionOverlay"]>;
    },
  ) => SectionDetailTabPanelState,
  userId: string | null,
): SectionDetailTabPanelState {
  const loadedTabs = getSsrLoadedSectionDetailTabs(data);
  let state = createEmptyState(userId);

  if (loadedTabs.includes("homework")) {
    state = applyPatch(state, {
      homeworkAuditLogs: data.homeworkData.auditLogs,
      homeworkViewer: data.homeworkData.viewer,
      homeworks: data.homeworkData.homeworks,
    });
  }

  if (loadedTabs.includes("introduction")) {
    state = applyPatch(state, {
      descriptionData: data.descriptionData,
    });
  }

  if (loadedTabs.includes("teachers")) {
    state = applyPatch(state, {
      sectionOverlay: { teachers: data.section.teachers },
    });
  }

  if (loadedTabs.includes("calendar")) {
    state = applyPatch(state, {
      sectionOverlay: {
        exams: data.section.exams,
        schedules: data.section.schedules,
      },
    });
  } else if (loadedTabs.includes("exams")) {
    state = applyPatch(state, {
      sectionOverlay: { exams: data.section.exams },
    });
  }

  return state;
}

export function buildSectionDetailTabPanelSsrSeed(
  data: SectionDetailPageData,
  userId: string | null,
  helpers: {
    applyPatch: (
      state: SectionDetailTabPanelState,
      patch: Partial<SectionDetailTabPanelState> & {
        sectionOverlay?: Partial<SectionDetailTabPanelState["sectionOverlay"]>;
      },
    ) => SectionDetailTabPanelState;
    createEmptyState: (userId: string | null) => SectionDetailTabPanelState;
  },
): SectionDetailTabPanelSsrSeed {
  return {
    loadedTabs: getSsrLoadedSectionDetailTabs(data),
    state: buildSectionDetailTabPanelSsrState(
      data,
      helpers.createEmptyState,
      helpers.applyPatch,
      userId,
    ),
  };
}
