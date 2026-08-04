import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-types";
import type { SectionDetailTab } from "@/features/section-detail/lib/section-detail-tab";
import {
  applySectionDetailTabPanelPatch,
  emptySectionDetailTabPanelState,
  type SectionDetailTabPanelSsrSeed,
  type SectionDetailTabPanelState,
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

function sectionSchedulesSsrLoaded(
  section: SectionDetailPageData["section"],
): boolean {
  if (section.scheduleCount === 0) return true;
  return (section.schedules?.length ?? 0) > 0;
}

function sectionExamsSsrLoaded(
  section: SectionDetailPageData["section"],
): boolean {
  if (section.examCount === 0) return true;
  return (section.exams?.length ?? 0) > 0;
}

function sectionTeachersSsrLoaded(
  teachers: SectionDetailPageData["section"]["teachers"],
): boolean {
  if (teachers.length === 0) return true;
  return sectionTeachersIncludeDepartments(teachers);
}

export function getSsrLoadedSectionDetailTabs(
  data: Pick<
    SectionDetailPageData,
    "descriptionData" | "focusedHomeworkId" | "homeworkData" | "section"
  >,
): SectionDetailTab[] {
  const loaded: SectionDetailTab[] = ["introduction"];

  if (
    data.focusedHomeworkId != null ||
    data.homeworkData.homeworks.length > 0 ||
    data.homeworkData.viewer.isAuthenticated
  ) {
    loaded.push("homework");
  }

  if (sectionSchedulesSsrLoaded(data.section)) {
    loaded.push("calendar");
  }

  if (sectionExamsSsrLoaded(data.section)) {
    loaded.push("exams");
  }

  if (sectionTeachersSsrLoaded(data.section.teachers)) {
    loaded.push("teachers");
  }

  return loaded;
}

export function buildSectionDetailTabPanelSsrState(
  data: SectionDetailPageData,
  createEmptyState: (userId: string | null) => SectionDetailTabPanelState,
  applyPatch: typeof applySectionDetailTabPanelPatch,
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
    applyPatch?: typeof applySectionDetailTabPanelPatch;
    createEmptyState?: (userId: string | null) => SectionDetailTabPanelState;
  } = {},
): SectionDetailTabPanelSsrSeed {
  return {
    loadedTabs: getSsrLoadedSectionDetailTabs(data),
    state: buildSectionDetailTabPanelSsrState(
      data,
      helpers.createEmptyState ?? emptySectionDetailTabPanelState,
      helpers.applyPatch ?? applySectionDetailTabPanelPatch,
      userId,
    ),
  };
}
