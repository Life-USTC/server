import { redirect } from "@sveltejs/kit";
import { listUploads } from "@/features/uploads/server/upload-list";
import { getUploadPageCopy } from "@/features/uploads/server/upload-page-copy";
import { uploadTableFilterKeys } from "@/features/uploads/server/upload-table-filters";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { parsePositivePage } from "@/lib/load-data-utils";
import {
  tableFilterPageHref,
  tableFilterParams,
} from "@/lib/table-filter-query";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const userId = locals.authUser?.id;
  if (!userId) redirect(303, buildSignInPageUrl(url.pathname + url.search));
  setHeaders({ "Cache-Control": "private, no-store" });
  const page = parsePositivePage(url.searchParams.get("page"));
  const pageSize = 20;
  const filters = tableFilterParams(url, uploadTableFilterKeys);
  const result = await listUploads(
    userId,
    {
      pageSize,
      skip: (page - 1) * pageSize,
    },
    filters,
  );
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
  if (page > totalPages)
    redirect(303, tableFilterPageHref(url.pathname, filters, totalPages));
  return {
    ...result,
    uploads: result.uploads.map(({ key: _key, ...upload }) => ({
      ...upload,
      createdAt: new Date(upload.createdAt).toISOString(),
    })),
    page,
    filters,
    totalPages,
    locale: locals.locale,
    copy: getUploadPageCopy(locals.locale),
  };
};
