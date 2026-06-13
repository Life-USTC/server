import { buildContentDisposition } from "@/features/uploads/lib/upload-utils";
import { handleRouteError, notFound } from "@/lib/api/helpers";
import {
  parseUploadId,
  uploadPreviewHtml,
} from "@/lib/api/routes/upload-route-helpers";
import { requireAuth } from "@/lib/auth/api-auth";
import { getStorageObjectResponse } from "@/lib/storage/r2-object";

type IdParams = { id: string };

export async function getUploadDownloadRoute(
  request: Request,
  params: IdParams,
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsed = parseUploadId(params);
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed.id;

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const upload = await prisma.upload.findFirst({
      where: { id, userId },
    });

    if (!upload) {
      return notFound();
    }

    const objectResponse = await getStorageObjectResponse({
      contentDisposition: buildContentDisposition(upload.filename),
      contentType: upload.contentType,
      key: upload.key,
    });
    if (!objectResponse) return notFound();

    if (new URL(request.url).searchParams.get("preview") === "1") {
      const downloadUrl = new URL(request.url);
      downloadUrl.searchParams.delete("preview");
      return new Response(
        uploadPreviewHtml(upload.filename, downloadUrl.href),
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }
    return objectResponse;
  } catch (error) {
    return handleRouteError("Failed to prepare download", error);
  }
}
