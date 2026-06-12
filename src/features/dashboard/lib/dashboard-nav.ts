export const signedTabIds = [
  "overview",
  "calendar",
  "homeworks",
  "todos",
  "exams",
  "subscriptions",
  "bus",
  "links",
] as const;

export type SignedTabId = (typeof signedTabIds)[number];

type DashboardNavData = {
  navStats: {
    calendarItemsCount: number;
    examsCount: number;
    pendingHomeworksCount: number;
    pendingTodosCount: number;
  };
  subscribedSectionCount: number;
};

export function dashboardTabHref(
  id: SignedTabId,
  params: Record<string, string | number | null | undefined> = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const search = query.toString();
  const path = `/dashboard/${id}`;
  return `${path}${search ? `?${search}` : ""}`;
}

export function signedTabBadge(signedData: DashboardNavData, id: string) {
  if (id === "homeworks") return signedData.navStats.pendingHomeworksCount;
  if (id === "todos") return signedData.navStats.pendingTodosCount;
  if (id === "exams") return signedData.navStats.examsCount;
  if (id === "subscriptions") return signedData.subscribedSectionCount;
  if (id === "calendar") return signedData.navStats.calendarItemsCount;
  return null;
}
