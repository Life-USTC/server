import type { Prisma } from "@/generated/prisma/client";
import { ADMIN_USERS_PAGE_SIZE } from "@/lib/admin-constants";
import { getPrismaClient, requireAdminPage } from "@/lib/admin-page-auth";
import { parsePositivePage, toLoadData } from "@/lib/page-data-utils";
import { ilike } from "@/lib/query-helpers";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export async function getAdminUsersPage(request: Request, url: URL) {
  await requireAdminPage(request);
  const prisma = await getPrismaClient();
  const page = parsePositivePage(url.searchParams.get("page"));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { id: ilike(search) },
          { name: ilike(search) },
          { username: ilike(search) },
          { verifiedEmails: { some: { email: ilike(search) } } },
        ],
      }
    : {};
  const skip = (page - 1) * ADMIN_USERS_PAGE_SIZE;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        isAdmin: true,
        createdAt: true,
        verifiedEmails: { select: { email: true }, take: 1 },
        suspensions: {
          where: {
            liftedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true, reason: true, expiresAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_USERS_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));

  return toLoadData({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.verifiedEmails[0]?.email ?? null,
      isAdmin: user.isAdmin,
      createdAt: toShanghaiIsoString(user.createdAt),
      activeSuspension: user.suspensions[0]
        ? {
            ...user.suspensions[0],
            expiresAt: user.suspensions[0].expiresAt
              ? toShanghaiIsoString(user.suspensions[0].expiresAt)
              : null,
          }
        : null,
    })),
    pagination: { page, pageSize: ADMIN_USERS_PAGE_SIZE, total, totalPages },
    filters: { search },
  });
}
