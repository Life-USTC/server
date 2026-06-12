import { ilike } from "./admin-shared";

export function normalizeAdminUserName(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || "";
}

export function normalizeAdminUsername(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildAdminUsersWhere(search: string) {
  return search
    ? {
        OR: [
          { id: ilike(search) },
          { name: ilike(search) },
          { username: ilike(search) },
          {
            verifiedEmails: {
              some: {
                email: ilike(search),
              },
            },
          },
        ],
      }
    : {};
}

export function adminUserListItem(user: {
  createdAt: Date;
  id: string;
  isAdmin: boolean;
  name: string | null;
  username: string | null;
  verifiedEmails?: Array<{ email: string }>;
}) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    isAdmin: user.isAdmin,
    email: user.verifiedEmails?.[0]?.email ?? null,
    createdAt: user.createdAt,
  };
}
