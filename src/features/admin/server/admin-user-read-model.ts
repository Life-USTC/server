import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { ilike } from "@/lib/query-filter-helpers";
import { dateTableFilter } from "@/lib/table-filter-query";
import { tableFilterValues } from "@/lib/table-filters";

type AdminUsersParsedQuery = {
  pagination: {
    pageSize: number;
    skip: number;
  };
  query?: {
    search?: string | null;
    filters?: Record<string, string>;
  };
};

type AdminUserReadPrisma = Pick<PrismaClient, "user">;

type AdminUserListRow = {
  createdAt: Date;
  email: string;
  id: string;
  isAdmin: boolean;
  name: string | null;
  username: string | null;
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
  email: true,
  isAdmin: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

function normalizeAdminUsersSearch(search: string | null | undefined) {
  return search?.trim() ?? "";
}

function adminUserDisplayNameWhere(value: string): Prisma.UserWhereInput {
  return {
    OR: [
      { name: ilike(value) },
      { name: "", username: ilike(value) },
      {
        name: "",
        OR: [{ username: null }, { username: "" }],
        email: ilike(value),
      },
      {
        name: "",
        OR: [{ username: null }, { username: "" }],
        email: "",
        id: ilike(value),
      },
    ],
  };
}

export function buildAdminUsersWhere(
  search: string | null | undefined,
  filters: Record<string, string> = {},
): Prisma.UserWhereInput {
  const normalized = normalizeAdminUsersSearch(search);
  const searchWhere: Prisma.UserWhereInput = normalized
    ? {
        OR: [
          { id: ilike(normalized) },
          { name: ilike(normalized) },
          { username: ilike(normalized) },
          { email: ilike(normalized) },
        ],
      }
    : {};
  if (
    !Object.entries(filters).some(([key, value]) => key !== "search" && value)
  )
    return searchWhere;
  const roles = tableFilterValues(filters.role);
  const suspension = tableFilterValues(filters.suspension);
  const active: Prisma.UserSuspensionWhereInput = {
    liftedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
  return {
    AND: [
      searchWhere,
      ...(filters.name ? [adminUserDisplayNameWhere(filters.name)] : []),
      ...(filters.username ? [{ username: ilike(filters.username) }] : []),
      ...(filters.email ? [{ email: ilike(filters.email) }] : []),
      ...(roles.length
        ? [
            {
              OR: roles.flatMap((role) =>
                role === "admin"
                  ? [{ isAdmin: true }]
                  : role === "user"
                    ? [{ isAdmin: false }]
                    : [],
              ),
            },
          ]
        : []),
      ...(suspension.length
        ? [
            {
              OR: suspension.flatMap((status): Prisma.UserWhereInput[] =>
                status === "suspended"
                  ? [{ suspensions: { some: active } }]
                  : status === "clear"
                    ? [{ suspensions: { none: active } }]
                    : [],
              ),
            },
          ]
        : []),
      { createdAt: dateTableFilter(filters, "createdAt") },
    ],
  };
}

export function toAdminUserListItem(user: AdminUserListRow): AdminUserListItem {
  const activeSuspension = user.suspensions?.[0];

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    isAdmin: user.isAdmin,
    email: user.email,
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
  const where = buildAdminUsersWhere(query?.search, query?.filters);

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
