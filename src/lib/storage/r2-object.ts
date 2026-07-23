import { getCloudflareR2UploadsBucket } from "@/lib/adapters/cloudflare-runtime";
import { writeStorageOperationAnalytics } from "@/lib/metrics/analytics-engine";

export type StorageObjectHead = {
  contentType?: string;
  size: number;
};

function requireR2UploadsBucket() {
  const r2Bucket = getCloudflareR2UploadsBucket();
  if (!r2Bucket) {
    throw new Error("R2_UPLOADS binding is required for upload storage");
  }
  return r2Bucket;
}

export async function headStorageObject(
  key: string,
): Promise<StorageObjectHead> {
  const r2Bucket = requireR2UploadsBucket();
  const start = Date.now();
  try {
    const object = await r2Bucket.head(key);
    writeStorageOperationAnalytics({
      event: object ? "success" : "miss",
      ioObservedDurationMs: Date.now() - start,
      operation: "head",
      size: object?.size,
    });
    if (!object) return { size: 0 };
    return {
      contentType: object.httpMetadata?.contentType,
      size: object.size,
    };
  } catch (error) {
    writeStorageOperationAnalytics({
      event: "error",
      ioObservedDurationMs: Date.now() - start,
      operation: "head",
    });
    throw error;
  }
}

export async function deleteStorageObject(key: string) {
  const r2Bucket = requireR2UploadsBucket();
  const start = Date.now();
  try {
    await r2Bucket.delete(key);
    writeStorageOperationAnalytics({
      event: "success",
      ioObservedDurationMs: Date.now() - start,
      operation: "delete",
    });
  } catch (error) {
    writeStorageOperationAnalytics({
      event: "error",
      ioObservedDurationMs: Date.now() - start,
      operation: "delete",
    });
    throw error;
  }
}

export async function getStorageObjectResponse(input: {
  contentDisposition: string;
  contentType?: string | null;
  key: string;
}) {
  const r2Bucket = requireR2UploadsBucket();
  const start = Date.now();
  let object: Awaited<ReturnType<typeof r2Bucket.get>>;
  try {
    object = await r2Bucket.get(input.key);
    writeStorageOperationAnalytics({
      event: object ? "success" : "miss",
      ioObservedDurationMs: Date.now() - start,
      operation: "get",
      size: object?.size,
    });
  } catch (error) {
    writeStorageOperationAnalytics({
      event: "error",
      ioObservedDurationMs: Date.now() - start,
      operation: "get",
    });
    throw error;
  }
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

export async function putStorageObject(input: {
  body: ReadableStream<Uint8Array> | null;
  contentType?: string | null;
  key: string;
}) {
  const r2Bucket = requireR2UploadsBucket();
  const start = Date.now();
  try {
    await r2Bucket.put(input.key, input.body, {
      httpMetadata: {
        contentType: input.contentType ?? "application/octet-stream",
      },
    });
    writeStorageOperationAnalytics({
      event: "success",
      ioObservedDurationMs: Date.now() - start,
      operation: "put",
    });
  } catch (error) {
    writeStorageOperationAnalytics({
      event: "error",
      ioObservedDurationMs: Date.now() - start,
      operation: "put",
    });
    throw error;
  }
}
