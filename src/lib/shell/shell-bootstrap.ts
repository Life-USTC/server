import type { LayoutUserSummary } from "@/lib/shell/layout-server-data";

export type WorkspaceNavigationSummary = {
  userId: string;
  calendarItemsCount: number;
  examsCount: number;
  pendingHomeworksCount: number;
  pendingTodosCount: number;
  subscribedSectionCount: number;
};

export type ShellBootstrapPayload = {
  viewer: LayoutUserSummary;
  navigation: WorkspaceNavigationSummary | null;
};

function parseLayoutUserSummary(value: unknown): LayoutUserSummary {
  if (!value || typeof value !== "object") return null;

  const user = value as Record<string, unknown>;
  if (typeof user.id !== "string" || !user.id) return null;

  return {
    id: user.id,
    image: typeof user.image === "string" ? user.image : null,
    isAdmin: user.isAdmin === true,
    name: typeof user.name === "string" ? user.name : null,
    username: typeof user.username === "string" ? user.username : null,
  };
}

function parseCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function parseWorkspaceNavigationSummary(
  value: unknown,
  expectedUserId: string,
): WorkspaceNavigationSummary | null {
  if (!value || typeof value !== "object") return null;
  const summary = value as Record<string, unknown>;
  if (summary.userId !== expectedUserId) return null;

  const calendarItemsCount = parseCount(summary.calendarItemsCount);
  const examsCount = parseCount(summary.examsCount);
  const pendingHomeworksCount = parseCount(summary.pendingHomeworksCount);
  const pendingTodosCount = parseCount(summary.pendingTodosCount);
  const subscribedSectionCount = parseCount(summary.subscribedSectionCount);
  if (
    calendarItemsCount === null ||
    examsCount === null ||
    pendingHomeworksCount === null ||
    pendingTodosCount === null ||
    subscribedSectionCount === null
  ) {
    return null;
  }

  return {
    userId: expectedUserId,
    calendarItemsCount,
    examsCount,
    pendingHomeworksCount,
    pendingTodosCount,
    subscribedSectionCount,
  };
}

export function workspaceNavigationFromPageData(
  pageData: Record<string, unknown>,
  viewerId: string | null | undefined,
): WorkspaceNavigationSummary | null {
  if (!viewerId) return null;
  const navStats = pageData.navStats;
  if (!navStats || typeof navStats !== "object") return null;
  const navStatsRecord = navStats as Record<string, unknown>;
  const navUser = navStatsRecord.user;
  const navUserId =
    navUser && typeof navUser === "object"
      ? (navUser as Record<string, unknown>).id
      : null;
  if (navUserId !== viewerId) return null;

  return parseWorkspaceNavigationSummary(
    {
      ...navStatsRecord,
      userId: viewerId,
      subscribedSectionCount: pageData.subscribedSectionCount,
    },
    viewerId,
  );
}

export function parseShellBootstrapPayload(
  value: unknown,
): ShellBootstrapPayload {
  if (!value || typeof value !== "object") {
    throw new TypeError("Invalid shell bootstrap payload");
  }
  const payload = value as Record<string, unknown>;
  if (payload.viewer === null && payload.navigation === null) {
    return { viewer: null, navigation: null };
  }

  const viewer = parseLayoutUserSummary(payload.viewer);
  if (!viewer) throw new TypeError("Invalid shell bootstrap viewer");
  const navigation = parseWorkspaceNavigationSummary(
    payload.navigation,
    viewer.id,
  );
  if (!navigation) {
    throw new TypeError("Invalid shell bootstrap navigation summary");
  }
  return { viewer, navigation };
}

export async function getClientShellBootstrap(
  fetcher: typeof fetch = globalThis.fetch,
  signal?: AbortSignal,
): Promise<ShellBootstrapPayload> {
  const response = await fetcher("/_internal/shell-bootstrap", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    throw new Error(`Shell bootstrap failed with status ${response.status}`);
  }
  return parseShellBootstrapPayload(await response.json());
}
