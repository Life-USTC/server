import { withAdminRoute } from "@/lib/admin-utils";
import {
  badRequest,
  jsonResponse,
  parseResourceIdParam,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { adminUpdateUserRequestSchema } from "@/lib/api/schemas/request-schemas";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

function normalizeName(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || "";
}

function normalizeUsername(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Update one user.
 * @pathParams resourceIdPathParamsSchema
 * @body adminUpdateUserRequestSchema
 * @response adminUserResponseSchema
 * @response 400:openApiErrorSchema
 */
async function patchRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminRoute("Failed to update user", async () => {
    const parsed = await parseResourceIdParam(params, "user");
    if (parsed instanceof Response) {
      return parsed;
    }
    const id = parsed;
    const parsedBody = await parseRouteJsonBody(
      request,
      adminUpdateUserRequestSchema,
      "Invalid update request",
    );
    if (parsedBody instanceof Response) {
      return parsedBody;
    }

    const data: {
      name?: string;
      username?: string | null;
      isAdmin?: boolean;
    } = {};

    if ("name" in parsedBody) {
      data.name = normalizeName(parsedBody.name);
    }

    if ("username" in parsedBody) {
      const username = normalizeUsername(parsedBody.username);
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
      user: {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        isAdmin: updated.isAdmin,
        email: email?.email ?? null,
        createdAt: updated.createdAt,
      },
    });
  });
}
export const PATCH = observedApiRoute(patchRoute);
