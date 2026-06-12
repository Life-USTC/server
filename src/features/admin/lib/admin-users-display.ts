import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  addShanghaiTime,
  parseShanghaiDateTimeLocalInput,
} from "@/lib/time/shanghai-format";

export function formatAdminUserMessage(
  template: string,
  values: Record<string, string>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    template,
  );
}

export function adminUsersPageHref(
  page: number,
  search: string | null | undefined,
) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export function adminUserDisplayName(user: {
  email?: string | null;
  id: string;
  name?: string | null;
  username?: string | null;
}) {
  return user.name || user.username || user.email || user.id;
}

export function adminUserSuspensionLabel(
  user: { activeSuspension?: { expiresAt?: string | null } | null },
  copy: { clearStatus: string; until: string },
  moderationCopy: { permanent: string },
  formatDate: (value: Date | string | null | undefined) => string,
) {
  if (!user.activeSuspension) return copy.clearStatus;
  return user.activeSuspension.expiresAt
    ? formatAdminUserMessage(copy.until, {
        date: formatDate(user.activeSuspension.expiresAt),
      })
    : moderationCopy.permanent;
}

export function adminUserSuspensionExpiresAt(
  duration: string,
  customExpiresAt: string,
) {
  if (duration === "permanent") return undefined;
  if (duration === "custom") {
    const parsed = parseShanghaiDateTimeLocalInput(customExpiresAt);
    return parsed ? toShanghaiIsoString(parsed) : undefined;
  }
  const days =
    duration === "1d" ? 1 : duration === "7d" ? 7 : duration === "30d" ? 30 : 3;
  return toShanghaiIsoString(addShanghaiTime(new Date(), days, "day"));
}

export async function adminUserResponseMessage(
  response: Response,
  fallback: string,
) {
  try {
    const body = await response.json();
    return String(body?.message ?? body?.error?.message ?? fallback);
  } catch {
    return fallback;
  }
}
