import { GetObjectCommand } from "@aws-sdk/client-s3";
import { buildContentDisposition } from "@/features/uploads/lib/upload-utils";
import { handleRouteError, notFound } from "@/lib/api/helpers";
import {
  parseUploadId,
  uploadPreviewHtml,
} from "@/lib/api/routes/upload-route-helpers";
import { requireAuth } from "@/lib/auth/api-auth";
import { getS3Bucket, getS3SignedUrl } from "@/lib/storage/s3";

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

    const command = new GetObjectCommand({
      Bucket: getS3Bucket(),
      Key: upload.key,
      ResponseContentDisposition: buildContentDisposition(upload.filename),
      ResponseContentType: upload.contentType ?? undefined,
    });

    const url = await getS3SignedUrl(command, { expiresIn: 60 });
    if (new URL(request.url).searchParams.get("preview") === "1") {
      return new Response(uploadPreviewHtml(upload.filename, url), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return Response.redirect(url);
  } catch (error) {
    return handleRouteError("Failed to prepare download", error);
  }
}
