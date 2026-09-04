import {
  recordCatalogLinkClick,
  resolveCatalogLinkBySlug,
} from "@/features/catalog-links/server/catalog-link-service";
import { catalogLinkVisitQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveSessionUserId } from "@/lib/auth/api-auth";
import { checkUserMutationRateLimit } from "@/lib/security/user-mutation-rate-limit";

export async function getCatalogLinkVisitRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = catalogLinkVisitQuerySchema.safeParse({
    slug: searchParams.get("slug"),
  });
  const target = parsed.success
    ? resolveCatalogLinkBySlug(parsed.data.slug)
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
      await recordCatalogLinkClick(userId, target.slug);
    }
  }

  return Response.redirect(target.url, 307);
}
