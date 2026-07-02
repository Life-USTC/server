import { getCloudflareR2UploadsBucket } from "@/lib/adapters/cloudflare-runtime";

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
  const object = await r2Bucket.head(key);
  if (!object) return { size: 0 };
  return {
    contentType: object.httpMetadata?.contentType,
    size: object.size,
  };
}

export async function deleteStorageObject(key: string) {
  const r2Bucket = requireR2UploadsBucket();
  await r2Bucket.delete(key);
}

export async function getStorageObjectResponse(input: {
  contentDisposition: string;
  contentType?: string | null;
  key: string;
}) {
  const r2Bucket = requireR2UploadsBucket();
  const object = await r2Bucket.get(input.key);
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
  await r2Bucket.put(input.key, input.body, {
    httpMetadata: {
      contentType: input.contentType ?? "application/octet-stream",
    },
  });
}
