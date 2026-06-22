import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { ilike } from "@/lib/query-filter-helpers";

type AdminUsersParsedQuery = {
  pagination: {
    pageSize: number;
    skip: number;
  };
  query?: {
    search?: string | null;
  };
};

type AdminUserReadPrisma = Pick<PrismaClient, "user">;

type AdminUserListRow = {
  createdAt: Date;
  id: string;
  isAdmin: boolean;
  name: string | null;
  username: string | null;
  verifiedEmails: Array<{ email: string }>;
  suspensions?: Array<{
    expiresAt: Date | null;
    id: string;
    reason: string | null;
  }>;
};

export type AdminUserListItem = {
  createdAt: Date;
  email: string | null;
  id: string;
  isAdmin: boolean;
  name: string | null;
  username: string | null;
  activeSuspension?: {
    expiresAt: Date | null;
    id: string;
    reason: string | null;
  } | null;
};

const adminUserListSelect = {
  id: true,
  name: true,
  username: true,
  isAdmin: true,
  createdAt: true,
  verifiedEmails: {
    select: { email: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.UserSelect;

function normalizeAdminUsersSearch(search: string | null | undefined) {
  return search?.trim() ?? "";
}

export function buildAdminUsersWhere(
  search: string | null | undefined,
): Prisma.UserWhereInput {
  const normalized = normalizeAdminUsersSearch(search);
  return normalized
    ? {
        OR: [
          { id: ilike(normalized) },
          { name: ilike(normalized) },
          { username: ilike(normalized) },
          { verifiedEmails: { some: { email: ilike(normalized) } } },
        ],
      }
    : {};
}

export function toAdminUserListItem(user: AdminUserListRow): AdminUserListItem {
  const activeSuspension = user.suspensions?.[0];

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    isAdmin: user.isAdmin,
    email: user.verifiedEmails[0]?.email ?? null,
    createdAt: user.createdAt,
    ...(user.suspensions === undefined
      ? {}
      : {
          activeSuspension: activeSuspension
            ? {
                id: activeSuspension.id,
                reason: activeSuspension.reason,
                expiresAt: activeSuspension.expiresAt,
              }
            : null,
        }),
  };
}

function buildAdminUserListSelect(includeActiveSuspension: boolean) {
  if (!includeActiveSuspension) return adminUserListSelect;

  return {
    ...adminUserListSelect,
    suspensions: {
      where: {
        liftedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, reason: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  } satisfies Prisma.UserSelect;
}

export async function listAdminUsers({
  pagination,
  query,
  includeActiveSuspension = false,
  prismaClient = defaultPrisma,
}: AdminUsersParsedQuery & {
  includeActiveSuspension?: boolean;
  prismaClient?: AdminUserReadPrisma;
}) {
  const where = buildAdminUsersWhere(query?.search);

  const [users, total] = await Promise.all([
    prismaClient.user.findMany({
      where,
      select: buildAdminUserListSelect(includeActiveSuspension),
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.pageSize,
    }) as Promise<AdminUserListRow[]>,
    prismaClient.user.count({ where }),
  ]);

  return {
    total,
    users: users.map(toAdminUserListItem),
  };
}

export async function getAdminUserListItem(
  id: string,
  prismaClient: AdminUserReadPrisma = defaultPrisma,
) {
  const user = (await prismaClient.user.findUnique({
    where: { id },
    select: adminUserListSelect,
  })) as AdminUserListRow | null;

  return user ? toAdminUserListItem(user) : null;
}
