import type {
  CourseDetailSection,
  TeacherDetailSection,
} from "@/features/catalog/components/catalog-detail-component-types";
import type { DescriptionPayload } from "@/features/descriptions/lib/description-card-actions";
import { fetchDescriptionPayload } from "@/features/descriptions/lib/description-card-client";
import type { DescriptionViewer } from "@/features/descriptions/lib/description-payload-types";
import { emptyDescriptionPayload } from "@/features/descriptions/server/description-payload";
import type { AppLocale } from "@/i18n/config";
import { apiClient } from "@/lib/api/client";
import type { CatalogDetailTab } from "./catalog-detail-tab";

type CatalogDetailKind = "course" | "teacher";

type CatalogDetailTabPanelState = {
  descriptionData: DescriptionPayload;
  sections: CourseDetailSection[] | TeacherDetailSection[];
};

type CatalogDetailTabPanelPatch = Partial<CatalogDetailTabPanelState>;

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

function emptyPanelState(userId: string | null): CatalogDetailTabPanelState {
  return {
    descriptionData: emptyDescriptionPayload(emptyDescriptionViewer(userId)),
    sections: [],
  };
}

function applyPanelPatch(
  state: CatalogDetailTabPanelState,
  patch: CatalogDetailTabPanelPatch,
): CatalogDetailTabPanelState {
  return { ...state, ...patch };
}

async function loadIntroductionPanel(
  targetType: CatalogDetailKind,
  targetId: number,
): Promise<CatalogDetailTabPanelPatch> {
  const result = await fetchDescriptionPayload({
    targetId,
    targetType,
  });
  if (result.ok && result.payload) {
    return { descriptionData: result.payload };
  }
  return {};
}

async function loadCourseSectionsPanel(
  jwId: number,
  locale: AppLocale,
): Promise<CatalogDetailTabPanelPatch> {
  const result = await apiClient.GET<{ sections?: CourseDetailSection[] }>(
    `/api/catalog/courses/${jwId}`,
    {
      params: { query: { locale } },
    },
  );
  if (!result.response.ok || !result.data) {
    throw new Error("Failed to load course sections");
  }
  return { sections: result.data.sections ?? [] };
}

async function loadTeacherSectionsPanel(
  id: number,
  locale: AppLocale,
): Promise<CatalogDetailTabPanelPatch> {
  const result = await apiClient.GET<{ sections?: TeacherDetailSection[] }>(
    `/api/catalog/teachers/${id}`,
    {
      params: { query: { locale } },
    },
  );
  if (!result.response.ok || !result.data) {
    throw new Error("Failed to load teacher sections");
  }
  return { sections: result.data.sections ?? [] };
}

const tabLoaders: Record<
  Exclude<CatalogDetailTab, "overview" | "comments">,
  (input: {
    id: number;
    jwId: number;
    kind: CatalogDetailKind;
    locale: AppLocale;
  }) => Promise<CatalogDetailTabPanelPatch>
> = {
  introduction: ({ id, kind }) => loadIntroductionPanel(kind, id),
  sections: ({ id, jwId, kind, locale }) =>
    kind === "course"
      ? loadCourseSectionsPanel(jwId, locale)
      : loadTeacherSectionsPanel(id, locale),
};

export function createCatalogDetailTabPanelStore(
  kind: CatalogDetailKind,
  userId: string | null,
) {
  const loaded = new Set<CatalogDetailTab>();
  let state = emptyPanelState(userId);

  return {
    getState: () => state,
    isLoaded: (tab: CatalogDetailTab) => loaded.has(tab),
    async ensureLoaded(
      tab: CatalogDetailTab,
      input: {
        id: number;
        jwId: number;
        locale: AppLocale;
      },
    ) {
      if (tab === "overview" || tab === "comments" || loaded.has(tab)) {
        loaded.add(tab);
        return state;
      }

      const loader = tabLoaders[tab];
      const patch = await loader({ ...input, kind });
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
