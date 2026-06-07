import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { buildContentDisposition } from "@/features/uploads/lib/upload-utils";
import {
  handleRouteError,
  notFound,
  parseResourceIdParam,
} from "@/lib/api/helpers";
import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { getS3Bucket, getS3SignedUrl } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

/**
 * Redirect to signed URL for one upload.
 * @pathParams resourceIdPathParamsSchema
 * @response 302
 * @response 401:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
async function getRoute(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsed = await parseResourceIdParam(context.params, "upload");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;

  try {
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
    return NextResponse.redirect(url);
  } catch (error) {
    return handleRouteError("Failed to prepare download", error);
  }
}
export const GET = observedApiRoute(getRoute);
