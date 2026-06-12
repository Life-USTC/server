import { buildPaginatedResponse, jsonResponse } from "@/lib/api/helpers";
import { adminUserListItem, buildAdminUsersWhere } from "./admin-user-shape";
import { buildAdminUserUpdateData } from "./admin-user-update-data";

type AdminUsersParsedQuery = {
  pagination: {
    page: number;
    pageSize: number;
    skip: number;
  };
  query: {
    search?: string | null;
  };
};

type AdminUpdateUserBody = {
  isAdmin?: boolean;
  name?: unknown;
  username?: unknown;
};

export async function listAdminUsersAction({
  pagination,
  query,
}: AdminUsersParsedQuery) {
  const search = query.search ?? "";
  const where = buildAdminUsersWhere(search);

  const { prisma } = await import("@/lib/db/prisma");
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        isAdmin: true,
        createdAt: true,
        verifiedEmails: {
          select: { email: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return jsonResponse(
    buildPaginatedResponse(
      users.map(adminUserListItem),
      pagination.page,
      pagination.pageSize,
      total,
    ),
  );
}

export async function updateAdminUserAction(
  id: string,
  parsedBody: AdminUpdateUserBody,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const data = await buildAdminUserUpdateData(id, parsedBody);
  if (data instanceof Response) return data;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      username: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  const email = await prisma.verifiedEmail.findFirst({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    select: { email: true },
  });

  return jsonResponse({
    user: adminUserListItem({
      ...updated,
      verifiedEmails: email ? [email] : [],
    }),
  });
}
