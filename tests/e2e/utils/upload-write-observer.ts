import { expect, request as nativeRequest } from "@playwright/test";
import type { Upload } from "@/generated/prisma-node/client";
import { createUploadBucket, type UploadBucket } from "./upload-bucket";

/** A phase owns its connection and response buffers through failure and close. */
export async function withUploadObserver<T>(
  origin: string,
  observe: (bucket: UploadBucket) => Promise<T>,
): Promise<T> {
  const request = await nativeRequest.newContext({ baseURL: origin });
  let result: { value: T } | { error: unknown };
  try {
    result = { value: await observe(createUploadBucket(request, origin)) };
  } catch (error) {
    result = { error };
  }
  try {
    await request.dispose();
  } catch (error) {
    if ("error" in result)
      throw new AggregateError(
        [result.error, error],
        "Upload observation and disposal failed",
      );
    throw error;
  }
  if ("error" in result) throw result.error;
  return result.value;
}

export type UploadState = {
  upload: Upload | null;
  object: Awaited<ReturnType<UploadBucket["get"]>>;
  metadata: Awaited<ReturnType<UploadBucket["head"]>>;
};

export type UploadWrite = { id: string } & (
  | { method: "PATCH" | "DELETE"; status: 403 }
  | { method: "PATCH"; status: 200; filename: string }
  | { method: "DELETE"; status: 200 }
);

/** Expected outcomes come from the scenario, never the application response. */
export function expectUploadWriteState(
  before: UploadState,
  after: UploadState,
  write: UploadWrite,
) {
  expect(before.upload).not.toBeNull();
  expect(before.object).not.toBeNull();
  expect(before.metadata).not.toBeNull();
  if (write.status === 403) {
    expect(after).toEqual(before);
    return;
  }
  if (write.method === "DELETE") {
    expect(after).toEqual({ upload: null, object: null, metadata: null });
    return;
  }
  expect(after).toEqual({
    ...before,
    upload: {
      ...before.upload,
      filename: write.filename,
      updatedAt: expect.any(Date),
    },
  });
  expect(after.upload?.updatedAt.getTime()).toBeGreaterThanOrEqual(
    before.upload?.updatedAt.getTime() ?? 0,
  );
  expect(after.upload?.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
}
