import { afterEach, expect, it, vi } from "vitest";
import {
  type CloudflareR2Bucket,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import {
  deleteStorageObject,
  getStorageObjectResponse,
  headStorageObject,
  putStorageObject,
} from "@/lib/storage/r2-object";

const key = "uploads/private-user-id/private-filename?signature=secret";
const disposition = 'attachment; filename="private-filename"';
function bucket() {
  return {
    head: vi.fn(async () => ({
      size: 5,
      httpMetadata: { contentType: "text/plain" },
    })),
    get: vi.fn(async () => ({
      size: 5,
      body: new Response("hello").body as ReadableStream<Uint8Array>,
      httpMetadata: { contentType: "text/plain" },
    })),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  } satisfies CloudflareR2Bucket;
}
afterEach(() => vi.restoreAllMocks());

it("upload.r2-backend", async () => {
  const storage = bucket();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Unexpected fallback"));
  const writeDataPoint = vi.fn();
  await runWithCloudflareRuntimeEnv(
    { R2_UPLOADS: storage, ANALYTICS: { writeDataPoint } },
    async () => {
      const body = new Response("hello").body;
      await putStorageObject({ key, body, contentType: "text/plain" });
      expect(storage.put).toHaveBeenCalledWith(key, body, {
        httpMetadata: { contentType: "text/plain" },
      });
      expect(await headStorageObject(key)).toEqual({
        size: 5,
        contentType: "text/plain",
      });
      const response = await getStorageObjectResponse({
        key,
        contentDisposition: disposition,
      });
      expect(response?.headers.get("Content-Disposition")).toBe(disposition);
      expect(response?.headers.get("Content-Length")).toBe("5");
      expect(await response?.text()).toBe("hello");
      await deleteStorageObject(key);
      for (const method of [storage.head, storage.get, storage.delete])
        expect(method).toHaveBeenCalledWith(key);
    },
  );
  await runWithCloudflareRuntimeEnv({}, async () => {
    for (const operation of [
      () => headStorageObject(key),
      () => getStorageObjectResponse({ key, contentDisposition: disposition }),
      () => putStorageObject({ key, body: null }),
      () => deleteStorageObject(key),
    ])
      await expect(operation()).rejects.toThrow(
        "R2_UPLOADS binding is required",
      );
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("upload.storage-observability", async () => {
  const storage = bucket();
  const writeDataPoint = vi.fn();
  const logs = ["debug", "info", "log", "warn", "error"].map((method) =>
    vi.spyOn(console, method as "log").mockImplementation(() => undefined),
  );
  const operations = {
    head: () => headStorageObject(key),
    get: () =>
      getStorageObjectResponse({ key, contentDisposition: disposition }),
    put: () => putStorageObject({ key, body: null }),
    delete: () => deleteStorageObject(key),
  };
  await runWithCloudflareRuntimeEnv(
    { R2_UPLOADS: storage, ANALYTICS: { writeDataPoint } },
    async () => {
      for (const operation of Object.values(operations)) await operation();
      storage.head.mockResolvedValueOnce(null as never);
      storage.get.mockResolvedValueOnce(null as never);
      expect(await operations.head()).toEqual({ size: 0 });
      expect(await operations.get()).toBeNull();
      for (const name of ["head", "get", "put", "delete"] as const) {
        const error = new Error(
          `private-bucket ${key} private-filename https://signed.test/private?token=secret`,
        );
        storage[name].mockRejectedValueOnce(error);
        await expect(operations[name]()).rejects.toBe(error);
      }
    },
  );
  expect(writeDataPoint).toHaveBeenCalledTimes(10);
  const expected = [
    ["head", "success"],
    ["get", "success"],
    ["put", "success"],
    ["delete", "success"],
    ["head", "miss"],
    ["get", "miss"],
    ["head", "error"],
    ["get", "error"],
    ["put", "error"],
    ["delete", "error"],
  ];
  expect(writeDataPoint.mock.calls.map(([point]) => point.blobs)).toEqual(
    expected.map(([op, event]) => ["storage_operation_v2", event, op]),
  );
  for (const [point] of writeDataPoint.mock.calls) {
    expect(Object.keys(point).sort()).toEqual(["blobs", "doubles", "indexes"]);
    expect(point.indexes).toEqual([`storage:${point.blobs[2]}`]);
    expect(point.doubles).toHaveLength(2);
    expect(
      point.doubles.every(
        (value: unknown) => typeof value === "number" && Number.isFinite(value),
      ),
    ).toBe(true);
  }
  expect(logs.flatMap((log) => log.mock.calls)).toEqual([]);
  const recorded = JSON.stringify(writeDataPoint.mock.calls);
  for (const secret of [
    key,
    "private-user-id",
    "private-filename",
    "private-bucket",
    "signed.test",
    "secret",
  ])
    expect(recorded).not.toContain(secret);
});
