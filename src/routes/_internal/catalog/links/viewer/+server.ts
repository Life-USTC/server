import { json } from "@sveltejs/kit";
import { getSignedInCatalogLinksData } from "@/features/catalog-links/server/catalog-link-data";
import type { RequestHandler } from "./$types";

const headers = {
  "Cache-Control": "private, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Vary: "Cookie",
};

export const GET: RequestHandler = async ({ locals, request }) => {
  if (request.headers.has("authorization"))
    return json(
      { error: "Session authentication required" },
      { status: 401, headers },
    );
  const userId = locals.authUser?.id;
  if (!userId) return json({ signedIn: false, links: null }, { headers });
  try {
    const result = await getSignedInCatalogLinksData(userId, locals.locale);
    return json({ signedIn: true, links: result.catalogLinks }, { headers });
  } catch {
    return json(
      { error: "Failed to load link preferences" },
      { status: 500, headers },
    );
  }
};
