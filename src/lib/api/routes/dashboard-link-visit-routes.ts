import {
  recordDashboardLinkClick,
  resolveDashboardLinkBySlug,
} from "@/features/dashboard-links/server/dashboard-link-service";
import { dashboardLinkVisitQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveSessionUserId } from "@/lib/auth/api-auth";
import { checkUserMutationRateLimit } from "@/lib/security/user-mutation-rate-limit";

export async function getDashboardLinkVisitRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = dashboardLinkVisitQuerySchema.safeParse({
    slug: searchParams.get("slug"),
  });
  const target = parsed.success
    ? resolveDashboardLinkBySlug(parsed.data.slug)
    : null;

  if (!target) {
    return Response.redirect(new URL("/", request.url), 307);
  }

  const userId = await resolveSessionUserId(request);

  if (userId) {
    const url = new URL(request.url);
    const outcome = await checkUserMutationRateLimit({
      action: "catalog.link:visit",
      host: url.host,
      userId,
    });
    if (outcome.allowed) {
      await recordDashboardLinkClick(userId, target.slug);
    }
  }

  return Response.redirect(target.url, 307);
}
