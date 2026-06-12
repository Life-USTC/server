import { badRequest } from "@/lib/api/helpers";
import {
  normalizeAdminUserName,
  normalizeAdminUsername,
} from "./admin-user-shape";

type AdminUpdateUserBody = {
  isAdmin?: boolean;
  name?: unknown;
  username?: unknown;
};

export async function buildAdminUserUpdateData(
  id: string,
  parsedBody: AdminUpdateUserBody,
) {
  const data: {
    name?: string;
    username?: string | null;
    isAdmin?: boolean;
  } = {};

  if ("name" in parsedBody) data.name = normalizeAdminUserName(parsedBody.name);

  const { prisma } = await import("@/lib/db/prisma");
  if ("username" in parsedBody) {
    const username = normalizeAdminUsername(parsedBody.username);
    if (username) {
      if (!/^[a-z0-9-]{1,20}$/.test(username)) {
        return badRequest("Invalid username");
      }
      const existing = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        return badRequest("Username already taken");
      }
    }
    data.username = username;
  }

  if ("isAdmin" in parsedBody && typeof parsedBody.isAdmin === "boolean") {
    data.isAdmin = parsedBody.isAdmin;
  }

  return data;
}
