import type { CommentsInitialData } from "@/features/comments/lib/comment-panel-data";
import type { DescriptionPayload } from "@/features/descriptions/lib/description-card-actions";
import { fetchDescriptionPayload } from "@/features/descriptions/lib/description-card-client";
import type { DescriptionViewer } from "@/features/descriptions/lib/description-payload-types";
import { emptyDescriptionPayload } from "@/features/descriptions/server/description-payload";
import type { AppLocale } from "@/i18n/config";
import { apiClient } from "@/lib/api/client";
import { loadSectionHomeworks } from "./homeworks";
import type {
  ExamItem,
  HomeworkAuditLog,
  HomeworkViewer,
  ScheduleItem,
  SectionDetailSection,
  SectionHomework,
} from "./section-detail-controller-types";
import type { SectionDetailTab } from "./section-detail-tab";

type SectionDetailApiRecord = SectionDetailSection & {
  exams?: ExamItem[];
  schedules?: ScheduleItem[];
};

export type SectionDetailTabPanelState = {
  commentsData: CommentsInitialData | null;
  descriptionData: DescriptionPayload;
  homeworkAuditLogs: HomeworkAuditLog[];
  homeworkViewer: HomeworkViewer;
  homeworks: SectionHomework[];
  sectionOverlay: Pick<
    SectionDetailSection,
    "exams" | "schedules" | "teachers"
  >;
};

const emptyHomeworkViewer = (userId: string | null): HomeworkViewer => ({
  isAdmin: false,
  isAuthenticated: Boolean(userId),
  isSuspended: false,
  userId,
});

function emptyDescriptionViewer(userId: string | null): DescriptionViewer {
  return {
    image: null,
    isAdmin: false,
    isAuthenticated: Boolean(userId),
    isSuspended: false,
    name: null,
    suspensionExpiresAt: null,
    suspensionReason: null,
    userId,
  };
}

function emptyPanelState(userId: string | null): SectionDetailTabPanelState {
  return {
    commentsData: null,
    descriptionData: emptyDescriptionPayload(emptyDescriptionViewer(userId)),
    homeworkAuditLogs: [],
    homeworkViewer: emptyHomeworkViewer(userId),
    homeworks: [],
    sectionOverlay: { exams: [], schedules: [], teachers: [] },
  };
}

async function fetchSectionDetailApi(jwId: number, locale: AppLocale) {
  const result = await apiClient.GET<SectionDetailApiRecord>(
    `/api/catalog/sections/${jwId}`,
    {
      params: {
        query: { locale },
      },
    },
  );
  if (!result.response.ok || !result.data) {
    throw new Error("Failed to load section detail");
  }
  return result.data;
}

async function loadCalendarPanel(
  jwId: number,
  locale: AppLocale,
  state: SectionDetailTabPanelState,
) {
  const detail = await fetchSectionDetailApi(jwId, locale);
  state.sectionOverlay.schedules = detail.schedules ?? [];
  state.sectionOverlay.exams = detail.exams ?? [];
}

async function loadTeachersPanel(
  jwId: number,
  locale: AppLocale,
  state: SectionDetailTabPanelState,
) {
  const detail = await fetchSectionDetailApi(jwId, locale);
  state.sectionOverlay.teachers = detail.teachers ?? [];
}

async function loadIntroductionPanel(
  sectionId: number,
  state: SectionDetailTabPanelState,
) {
  const result = await fetchDescriptionPayload({
    targetId: sectionId,
    targetType: "section",
  });
  if (result.ok && result.payload) {
    state.descriptionData = result.payload;
  }
}

async function loadHomeworkPanel(
  sectionId: number,
  errorMessage: string,
  state: SectionDetailTabPanelState,
) {
  const payload = await loadSectionHomeworks<
    HomeworkViewer,
    SectionHomework,
    HomeworkAuditLog
  >(sectionId, errorMessage);
  state.homeworkViewer = payload.viewer ?? state.homeworkViewer;
  state.homeworks = payload.homeworks ?? [];
  state.homeworkAuditLogs = payload.auditLogs ?? [];
}

const tabLoaders: Record<
  Exclude<SectionDetailTab, "overview" | "comments">,
  (input: {
    errorMessage: string;
    jwId: number;
    locale: AppLocale;
    sectionId: number;
    state: SectionDetailTabPanelState;
  }) => Promise<void>
> = {
  introduction: ({ sectionId, state }) =>
    loadIntroductionPanel(sectionId, state),
  calendar: ({ jwId, locale, state }) => loadCalendarPanel(jwId, locale, state),
  exams: ({ jwId, locale, state }) => loadCalendarPanel(jwId, locale, state),
  homework: ({ errorMessage, sectionId, state }) =>
    loadHomeworkPanel(sectionId, errorMessage, state),
  teachers: ({ jwId, locale, state }) => loadTeachersPanel(jwId, locale, state),
};

export function createSectionDetailTabPanelStore(userId: string | null) {
  const loaded = new Set<SectionDetailTab>();
  let state = emptyPanelState(userId);

  return {
    getState: () => state,
    isLoaded: (tab: SectionDetailTab) => loaded.has(tab),
    async ensureLoaded(
      tab: SectionDetailTab,
      input: {
        errorMessage: string;
        jwId: number;
        locale: AppLocale;
        sectionId: number;
      },
    ) {
      if (tab === "overview" || tab === "comments" || loaded.has(tab)) {
        loaded.add(tab);
        return state;
      }

      const loader = tabLoaders[tab];
      await loader({ ...input, state });
      loaded.add(tab);
      return state;
    },
    reset() {
      loaded.clear();
      state = emptyPanelState(userId);
    },
  };
}
