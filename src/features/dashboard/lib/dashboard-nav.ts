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

const signedTabIdSet = new Set<string>(signedTabIds);

export function isSignedDashboardTab(
  value: string | null | undefined,
): value is SignedTabId {
  return Boolean(value && signedTabIdSet.has(value));
}

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
