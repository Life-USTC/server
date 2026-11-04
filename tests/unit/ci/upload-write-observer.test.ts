import {
  type APIRequestContext,
  request as nativeRequest,
} from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expectUploadWriteState,
  type UploadState,
  withUploadObserver,
} from "../../e2e/utils/upload-write-observer";

function initial() {
  return {
    upload: {
      id: "owned-upload",
      userId: "owner",
      key: "uploads/owner/private",
      filename: "original.txt",
      contentType: "text/plain",
      size: 4,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    object: { body: new TextEncoder().encode("file") },
    metadata: { size: 4, httpMetadata: { contentType: "text/plain" } },
  } satisfies UploadState;
}

describe("independent upload write observation", () => {
  it("accepts a rename preserving every other persisted field and object", () => {
    const before = initial();
    expectUploadWriteState(
      before,
      {
        ...before,
        upload: {
          ...before.upload,
          filename: "renamed.txt",
          updatedAt: new Date(),
        },
      },
      {
        id: "owned-upload",
        method: "PATCH",
        status: 200,
        filename: "renamed.txt",
      },
    );
  });

  it("rejects a successful response when the filename was not persisted", () => {
    expect(() =>
      expectUploadWriteState(initial(), initial(), {
        id: "owned-upload",
        method: "PATCH",
        status: 200,
        filename: "renamed.txt",
      }),
    ).toThrow();
  });

  it.each(["PATCH", "DELETE"] as const)(
    "requires a rejected %s to preserve metadata and bytes",
    (method) => {
      const before = initial();
      expectUploadWriteState(before, initial(), {
        id: "owned-upload",
        method,
        status: 403,
      });
      for (const changed of [
        { ...initial(), upload: null },
        { ...initial(), object: { body: new TextEncoder().encode("evil") } },
        { ...initial(), metadata: null },
      ])
        expect(() =>
          expectUploadWriteState(before, changed, {
            id: "owned-upload",
            method,
            status: 403,
          }),
        ).toThrow();
    },
  );

  it("rejects renamed metadata with damaged object bytes or ownership", () => {
    const before = initial();
    const after = {
      ...initial(),
      upload: { ...before.upload, filename: "renamed.txt" },
    };
    const write = {
      id: "owned-upload",
      method: "PATCH",
      status: 200,
      filename: "renamed.txt",
    } as const;
    for (const corrupted of [
      { ...after, object: null },
      { ...after, object: { body: new TextEncoder().encode("evil") } },
      ...[
        { userId: "other" },
        { key: "uploads/owner/different" },
        { contentType: "text/html" },
        { size: 200 },
      ].map((fields) => ({ ...after, upload: { ...after.upload, ...fields } })),
      { ...after, metadata: { ...after.metadata, size: 200 } },
      {
        ...after,
        metadata: {
          ...after.metadata,
          httpMetadata: { contentType: "text/html" },
        },
      },
    ])
      expect(() => expectUploadWriteState(before, corrupted, write)).toThrow();
  });

  it("requires deletion of metadata and both object observations", () => {
    const before = initial();
    const absent = { upload: null, object: null, metadata: null };
    const write = {
      id: "owned-upload",
      method: "DELETE",
      status: 200,
    } as const;
    expectUploadWriteState(before, absent, write);
    for (const retained of [
      { ...absent, upload: before.upload },
      { ...absent, object: before.object },
      { ...absent, metadata: before.metadata },
    ])
      expect(() => expectUploadWriteState(before, retained, write)).toThrow();
  });
});

describe("upload observer connection ownership", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gives each phase a fresh context and disposes it before returning", async () => {
    const first = { dispose: vi.fn().mockResolvedValue(undefined) };
    const second = { dispose: vi.fn().mockResolvedValue(undefined) };
    const create = vi
      .spyOn(nativeRequest, "newContext")
      .mockResolvedValueOnce(first as unknown as APIRequestContext)
      .mockResolvedValueOnce(second as unknown as APIRequestContext);
    expect(
      await withUploadObserver("http://example.test", async () => "setup"),
    ).toBe("setup");
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).not.toHaveBeenCalled();
    await withUploadObserver("http://example.test", async () => "observe");
    expect(second.dispose).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "disposes after observation failure and retains cleanup failure %s",
    async (cleanupFails) => {
      const observation = new Error("state observation failed");
      const cleanup = new Error("context disposal failed");
      const dispose = cleanupFails
        ? vi.fn().mockRejectedValue(cleanup)
        : vi.fn().mockResolvedValue(undefined);
      vi.spyOn(nativeRequest, "newContext").mockResolvedValue({
        dispose,
      } as unknown as APIRequestContext);
      const result = withUploadObserver("http://example.test", async () => {
        throw observation;
      });
      if (cleanupFails)
        await expect(result).rejects.toMatchObject({
          errors: [observation, cleanup],
        });
      else await expect(result).rejects.toBe(observation);
      expect(dispose).toHaveBeenCalledTimes(1);
    },
  );

  it("propagates disposal failure after a successful observation", async () => {
    const cleanup = new Error("context disposal failed");
    vi.spyOn(nativeRequest, "newContext").mockResolvedValue({
      dispose: vi.fn().mockRejectedValue(cleanup),
    } as unknown as APIRequestContext);
    await expect(
      withUploadObserver("http://example.test", async () => "state"),
    ).rejects.toBe(cleanup);
  });
});
