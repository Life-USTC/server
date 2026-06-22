import { ADMIN_USERS_PAGE_SIZE } from "@/features/admin/server/admin-constants";
import {
  getPrismaClient,
  requireAdminPage,
} from "@/features/admin/server/admin-page-auth";
import { listAdminUsers } from "@/features/admin/server/admin-user-read-model";
import { parsePositivePage, toLoadData } from "@/lib/load-data-utils";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export async function getAdminUsersPage(request: Request, url: URL) {
  await requireAdminPage(request);
  const prisma = await getPrismaClient();
  const page = parsePositivePage(url.searchParams.get("page"));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const skip = (page - 1) * ADMIN_USERS_PAGE_SIZE;

  const { total, users } = await listAdminUsers({
    pagination: { pageSize: ADMIN_USERS_PAGE_SIZE, skip },
    query: { search },
    includeActiveSuspension: true,
    prismaClient: prisma,
  });

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));

  return toLoadData({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: toShanghaiIsoString(user.createdAt),
      activeSuspension: user.activeSuspension
        ? {
            ...user.activeSuspension,
            expiresAt: user.activeSuspension.expiresAt
              ? toShanghaiIsoString(user.activeSuspension.expiresAt)
              : null,
          }
        : null,
    })),
    pagination: { page, pageSize: ADMIN_USERS_PAGE_SIZE, total, totalPages },
    filters: { search },
  });
}
