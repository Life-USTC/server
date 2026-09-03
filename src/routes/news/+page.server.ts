import { getPublicationPageCopy } from "@/features/publications/server/publication-page-copy";
import { listPublications } from "@/features/publications/server/publication-public-read-service";
import { publicationsQuerySchema } from "@/lib/api/schemas/request-schemas";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export const load: PageServerLoad = async (event) => {
  const layoutData = await event.parent();
  const rawQuery = Object.fromEntries(
    ["type", "source", "query"].flatMap((key) => {
      const value = event.url.searchParams.get(key)?.trim();
      return value ? [[key, value]] : [];
    }),
  );
  const parsedQuery = publicationsQuerySchema.safeParse(rawQuery);
  const filters = parsedQuery.success ? parsedQuery.data : {};
  const publications = await listPublications({
    filters,
    pagination: {
      page: parsePage(event.url.searchParams.get("page")),
      pageSize: 20,
    },
  });
  const copy = getPublicationPageCopy(event.locals.locale);

  return {
    publications,
    filters,
    copy,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: copy.pageDescription,
      title: `${copy.pageTitle} - Life@USTC`,
    }),
  };
};
