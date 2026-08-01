import type { CommentsInitialData } from "@/features/comments/lib/comment-panel-data";
import type { DescriptionPayload } from "@/features/descriptions/lib/description-card-actions";
import { fetchDescriptionPayload } from "@/features/descriptions/lib/description-card-client";
import { emptyDescriptionPayload } from "@/features/descriptions/lib/description-empty-payload";
import type { DescriptionViewer } from "@/features/descriptions/lib/description-payload-types";
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

type SectionDetailTabPanelPatch = Partial<
  Omit<SectionDetailTabPanelState, "sectionOverlay">
> & {
  sectionOverlay?: Partial<SectionDetailTabPanelState["sectionOverlay"]>;
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

function applyPanelPatch(
  state: SectionDetailTabPanelState,
  patch: SectionDetailTabPanelPatch,
): SectionDetailTabPanelState {
  return {
    ...state,
    ...patch,
    sectionOverlay: {
      ...state.sectionOverlay,
      ...patch.sectionOverlay,
    },
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
): Promise<SectionDetailTabPanelPatch> {
  const detail = await fetchSectionDetailApi(jwId, locale);
  return {
    sectionOverlay: {
      exams: detail.exams ?? [],
      schedules: detail.schedules ?? [],
    },
  };
}

async function loadTeachersPanel(
  jwId: number,
  locale: AppLocale,
): Promise<SectionDetailTabPanelPatch> {
  const detail = await fetchSectionDetailApi(jwId, locale);
  return {
    sectionOverlay: {
      teachers: detail.teachers ?? [],
    },
  };
}

async function loadIntroductionPanel(
  sectionId: number,
): Promise<SectionDetailTabPanelPatch> {
  const result = await fetchDescriptionPayload({
    targetId: sectionId,
    targetType: "section",
  });
  if (result.ok && result.payload) {
    return { descriptionData: result.payload };
  }
  return {};
}

async function loadHomeworkPanel(
  sectionId: number,
  errorMessage: string,
  state: SectionDetailTabPanelState,
): Promise<SectionDetailTabPanelPatch> {
  const payload = await loadSectionHomeworks<
    HomeworkViewer,
    SectionHomework,
    HomeworkAuditLog
  >(sectionId, errorMessage);
  return {
    homeworkAuditLogs: payload.auditLogs ?? [],
    homeworkViewer: payload.viewer ?? state.homeworkViewer,
    homeworks: payload.homeworks ?? [],
  };
}

const tabLoaders: Record<
  Exclude<SectionDetailTab, "overview" | "comments">,
  (input: {
    errorMessage: string;
    jwId: number;
    locale: AppLocale;
    sectionId: number;
    state: SectionDetailTabPanelState;
  }) => Promise<SectionDetailTabPanelPatch>
> = {
  introduction: ({ sectionId }) => loadIntroductionPanel(sectionId),
  calendar: ({ jwId, locale }) => loadCalendarPanel(jwId, locale),
  exams: ({ jwId, locale }) => loadCalendarPanel(jwId, locale),
  homework: ({ errorMessage, sectionId, state }) =>
    loadHomeworkPanel(sectionId, errorMessage, state),
  teachers: ({ jwId, locale }) => loadTeachersPanel(jwId, locale),
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
      const patch = await loader({ ...input, state });
      state = applyPanelPatch(state, patch);
      loaded.add(tab);
      return state;
    },
    reset() {
      loaded.clear();
      state = emptyPanelState(userId);
    },
  };
}
