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
