import { getSignedInCatalogLinksData } from "@/features/catalog-links/server/catalog-link-data";
import {
  privateSessionJson,
  rejectBearerOnSessionRoute,
} from "@/lib/api/internal-session-response";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, request }) => {
  const rejected = rejectBearerOnSessionRoute(request);
  if (rejected) return rejected;
  const userId = locals.authUser?.id;
  if (!userId) return privateSessionJson({ signedIn: false, links: null });
  try {
    const result = await getSignedInCatalogLinksData(userId, locals.locale);
    return privateSessionJson({
      signedIn: true,
      links: result.catalogLinks,
    });
  } catch {
    return privateSessionJson(
      { error: "Failed to load link preferences" },
      { status: 500 },
    );
  }
};
