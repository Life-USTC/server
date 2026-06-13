import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getCloudflareR2UploadsBucket } from "@/lib/cloudflare/runtime-env";
import { recordStorageOperationMetric } from "@/lib/metrics/observability-metrics";
import { getS3Bucket, getS3SignedUrl, sendS3 } from "@/lib/storage/s3";

export type StorageObjectHead = {
  contentType?: string;
  size: number;
};

export async function headStorageObject(
  key: string,
): Promise<StorageObjectHead> {
  const r2Bucket = getCloudflareR2UploadsBucket();
  if (r2Bucket) {
    const object = await recordR2Operation("HeadObject", () =>
      r2Bucket.head(key),
    );
    if (!object) return { size: 0 };
    return {
      contentType: object.httpMetadata?.contentType,
      size: object.size,
    };
  }

  const head = await sendS3(
    new HeadObjectCommand({ Bucket: getS3Bucket(), Key: key }),
  );
  return {
    contentType: head.ContentType,
    size: head.ContentLength ?? 0,
  };
}

export async function deleteStorageObject(key: string) {
  const r2Bucket = getCloudflareR2UploadsBucket();
  if (r2Bucket) {
    await recordR2Operation("DeleteObject", () => r2Bucket.delete(key));
    return;
  }

  await sendS3(new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: key }));
}

export async function getStorageObjectResponse(input: {
  contentDisposition: string;
  contentType?: string | null;
  key: string;
}) {
  const r2Bucket = getCloudflareR2UploadsBucket();
  if (r2Bucket) {
    const object = await recordR2Operation("GetObject", () =>
      r2Bucket.get(input.key),
    );
    if (!object) return null;

    const headers = new Headers();
    headers.set("Content-Disposition", input.contentDisposition);
    headers.set(
      "Content-Type",
      input.contentType ??
        object.httpMetadata?.contentType ??
        "application/octet-stream",
    );
    headers.set("Content-Length", String(object.size));
    return new Response(object.body, { headers });
  }

  const command = new GetObjectCommand({
    Bucket: getS3Bucket(),
    Key: input.key,
    ResponseContentDisposition: input.contentDisposition,
    ResponseContentType: input.contentType ?? undefined,
  });
  const url = await getS3SignedUrl(command, { expiresIn: 60 });
  return Response.redirect(url);
}

async function recordR2Operation<T>(operation: string, run: () => Promise<T>) {
  const start = Date.now();
  try {
    const result = await run();
    recordStorageOperationMetric({
      operation,
      status: "success",
      durationMs: Date.now() - start,
    });
    return result;
  } catch (error) {
    recordStorageOperationMetric({
      operation,
      status: "error",
      durationMs: Date.now() - start,
    });
    throw error;
  }
}
