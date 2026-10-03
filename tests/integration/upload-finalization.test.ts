import { describe, expect } from "vitest";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { createUploadSession } from "@/features/uploads/server/upload-service";
import { uploadFinalizationTest as it } from "../shared/upload-finalization-fixture";

describe("upload finalization ownership", () => {
  it("upload.exclusive-completion", async ({ uploads, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const {
        db: fixturePrisma,
        bucket,
        defer,
        upload,
        put,
        complete,
      } = uploads;
      const key = await upload();
      const headStarted = defer();
      const releaseHead = defer();
      bucket.beforeHead = async () => {
        headStarted.resolve();
        await releaseHead.promise;
      };

      const completion = complete(key);
      await headStarted.promise;
      const replacement = await put(key, 1024).then(
        () => "uploaded",
        (error: Error) => error.message,
      );
      releaseHead.resolve();
      const result = await completion;
      const stored = await fixturePrisma.upload.findUniqueOrThrow({
        where: { key },
      });

      expect(stored.size).toBe(bucket.objects.get(key));
      expect(result.usedBytes).toBe(stored.size);
      expect(replacement).toBe("Upload session expired");
      expect(stored.size).toBe(10);
    });
  });

  it("upload.completion-phase-gate", async ({ uploads, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { db: fixturePrisma, bucket, upload, complete } = uploads;
      for (const phase of ["reserved", "uploading", "cleaning"] as const) {
        const key = await upload();
        await fixturePrisma.uploadPending.update({
          where: { key },
          data: { phase },
        });
        await expect(complete(key)).rejects.toMatchObject({
          code: "Upload session expired",
        });
        expect(bucket.headCalls).toBe(0);
        expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
      }
    });
  });

  it("upload.completion-retry", async ({ uploads, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { bucket, defer, upload, complete } = uploads;
      const key = await upload();
      const headStarted = defer();
      const releaseHead = defer();
      bucket.beforeHead = async () => {
        headStarted.resolve();
        await releaseHead.promise;
      };
      const first = complete(key, "first.txt");
      await headStarted.promise;
      const second = await complete(key, "second.txt").catch((error) => error);
      releaseHead.resolve();
      const firstResult = await first;

      expect(second).toMatchObject({ code: "Upload session expired" });
      const retry = await complete(key, "retry.txt");
      expect(retry.upload).toEqual(firstResult.upload);
      expect(retry.upload.filename).toBe("first.txt");
      expect(bucket.headCalls).toBe(1);
    });
  });

  it("upload.completion-failure-release", async ({
    uploads,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { db: fixturePrisma, bucket, upload, put, complete } = uploads;
      for (const failure of ["missing", "unavailable", "oversized"]) {
        const key = await upload();
        if (failure === "missing") bucket.objects.delete(key);
        if (failure === "oversized") {
          bucket.objects.set(key, uploadConfig.maxFileSizeBytes + 1);
        }
        if (failure === "unavailable") {
          bucket.beforeHead = async () => {
            throw new Error("Storage unavailable");
          };
        }

        await expect(complete(key)).rejects.toThrow();
        expect(
          await fixturePrisma.uploadPending.findUniqueOrThrow({
            where: { key },
          }),
        ).toMatchObject({ phase: "uploaded", leaseExpiresAt: null });
        expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);

        bucket.beforeHead = undefined;
        await put(key, 20);
        const result = await complete(key);
        expect(result.upload.size).toBe(20);
        expect(result.usedBytes).toBe(20);
        await fixturePrisma.upload.delete({ where: { key } });
      }
    });
  });

  it("upload.completion-stale-attempt", async ({
    uploads,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { db: fixturePrisma, bucket, defer, upload, complete } = uploads;
      for (const outcome of ["failed", "successful"]) {
        const key = await upload();
        const firstStarted = defer();
        const releaseFirst = defer();
        const secondStarted = defer();
        const releaseSecond = defer();
        let heads = 0;
        bucket.beforeHead = async () => {
          heads += 1;
          if (heads === 1) {
            firstStarted.resolve();
            await releaseFirst.promise;
            if (outcome === "failed") throw new Error("Storage unavailable");
          } else {
            secondStarted.resolve();
            await releaseSecond.promise;
          }
        };

        const first = complete(key, "stale.txt").catch((error) => error);
        await firstStarted.promise;
        const oldClaim = await fixturePrisma.uploadPending.update({
          where: { key },
          data: { leaseExpiresAt: new Date(0) },
        });
        const second = complete(key, "current.txt");
        await secondStarted.promise;
        const newClaim = await fixturePrisma.uploadPending.findUniqueOrThrow({
          where: { key },
        });
        releaseFirst.resolve();
        const staleResult = await first;
        const claimAfterStaleResult =
          await fixturePrisma.uploadPending.findUniqueOrThrow({
            where: { key },
          });
        releaseSecond.resolve();
        const result = await second;

        expect(newClaim.attemptId).not.toBe(oldClaim.attemptId);
        expect(staleResult).toBeInstanceOf(Error);
        expect(claimAfterStaleResult).toMatchObject({
          attemptId: newClaim.attemptId,
          phase: "completing",
        });
        expect(result.upload.filename).toBe("current.txt");
        expect(result.usedBytes).toBe(10);
        await fixturePrisma.upload.delete({ where: { key } });
      }
    });
  });

  it("upload.completion-expiry", async ({ uploads, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { db: fixturePrisma, bucket, upload, complete } = uploads;
      for (const expired of ["reservation", "lease"]) {
        const key = await upload();
        bucket.beforeHead = async () => {
          await fixturePrisma.uploadPending.update({
            where: { key },
            data:
              expired === "reservation"
                ? { expiresAt: new Date(0) }
                : { leaseExpiresAt: new Date(0) },
          });
        };
        await expect(complete(key)).rejects.toMatchObject({
          code: "Upload session expired",
        });
        expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
        expect(bucket.objects.get(key)).toBe(10);
        expect(
          await fixturePrisma.uploadPending.findUniqueOrThrow({
            where: { key },
          }),
        ).toMatchObject({ phase: "uploaded", leaseExpiresAt: null });
        if (expired === "lease") {
          bucket.beforeHead = undefined;
          expect((await complete(key)).upload.size).toBe(10);
        }
      }
    });
  });

  it("upload.completion-quota-rejection", async ({
    uploads,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { db: fixturePrisma, bucket, userId, upload, complete } = uploads;
      const key = await upload();
      await fixturePrisma.upload.create({
        data: {
          filename: "quota.txt",
          key: `uploads/${userId}/quota`,
          size: uploadConfig.totalQuotaBytes,
          userId,
        },
      });
      await expect(complete(key)).rejects.toMatchObject({
        code: "Quota exceeded",
      });
      const pending = await fixturePrisma.uploadPending.findUniqueOrThrow({
        where: { key },
      });
      expect(pending.phase).toBe("uploaded");
      expect(pending.leaseExpiresAt).toBeNull();
      expect(pending.expiresAt.getTime()).toBeLessThan(Date.now());
      expect(bucket.objects.get(key)).toBe(10);
      expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
    });
  });

  it("upload.oversized-put-retry", async ({ uploads, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { db: fixturePrisma, upload, put, complete } = uploads;
      const key = await upload();
      await expect(put(key, 2048)).rejects.toMatchObject({
        code: "File too large",
      });
      expect(
        await fixturePrisma.uploadPending.findUniqueOrThrow({ where: { key } }),
      ).toMatchObject({ phase: "uploaded", leaseExpiresAt: null });
      await put(key, 20);
      expect((await complete(key)).upload.size).toBe(20);
    });
  });
});

it("upload.pure-upload-reads", async ({ uploads, protocolRuntime }) => {
  await protocolRuntime.run(async () => {
    const {
      db: fixturePrisma,
      bucket,
      userId,
      run,
      upload,
      complete,
      list,
    } = uploads;
    const activeKey = await upload(10);
    await fixturePrisma.upload.create({
      data: {
        userId,
        filename: "completed.txt",
        key: crypto.randomUUID(),
        size: 7,
      },
    });
    const now = Date.now();
    const expired = Array.from({ length: 60 }, (_, i) => ({
      userId,
      key: `expired-${String(i).padStart(3, "0")}-${userId}`,
      filename: "expired.txt",
      attemptId: crypto.randomUUID(),
      size: 1000,
      expiresAt: new Date(now - 100000 + i * 1000),
      phase: i % 2 ? ("uploaded" as const) : ("reserved" as const),
    }));
    const protectedRows = [
      "uploading",
      "completing",
      "cleaning",
      "live-lease",
    ].map((name) => ({
      userId,
      key: `${name}-${userId}`,
      filename: "protected.txt",
      attemptId: crypto.randomUUID(),
      size: 1000,
      expiresAt: new Date(now - 200000),
      phase:
        name === "live-lease"
          ? ("uploaded" as const)
          : (name as "uploading" | "completing" | "cleaning"),
      leaseExpiresAt: new Date(now + 60000),
    }));
    await fixturePrisma.uploadPending.createMany({
      data: [...expired, ...protectedRows],
    });
    for (const row of [...expired, ...protectedRows])
      bucket.objects.set(row.key, 1000);
    const before = await fixturePrisma.uploadPending.findMany({
      where: { userId },
      orderBy: { key: "asc" },
    });
    const objects = new Map(bucket.objects);
    for (let i = 0; i < 2; i++) {
      const response = await list();
      expect(response.status).toBe(200);
      expect((await response.json()).meta.usedBytes).toBe(1031);
    }
    expect(
      await fixturePrisma.uploadPending.findMany({
        where: { userId },
        orderBy: { key: "asc" },
      }),
    ).toEqual(before);
    const created = await run(() =>
      createUploadSession({
        origin: "http://localhost:3000",
        userId,
        upload: { filename: "new.txt", size: 20, contentType: "text/plain" },
      }),
    );
    expect(created.usedBytes).toBe(1031);
    const keysAfterCreate = (
      await fixturePrisma.uploadPending.findMany({ where: { userId } })
    ).map((row) => row.key);
    for (const row of expired.slice(0, 25))
      expect(keysAfterCreate).not.toContain(row.key);
    for (const row of [...expired.slice(25), ...protectedRows])
      expect(keysAfterCreate).toContain(row.key);
    expect(keysAfterCreate).toHaveLength(before.length - 25 + 1);
    expect((await complete(activeKey)).usedBytes).toBe(37);
    const keysAfterComplete = (
      await fixturePrisma.uploadPending.findMany({ where: { userId } })
    ).map((row) => row.key);
    for (const row of expired.slice(0, 50))
      expect(keysAfterComplete).not.toContain(row.key);
    for (const row of [...expired.slice(50), ...protectedRows])
      expect(keysAfterComplete).toContain(row.key);
    expect(keysAfterComplete).toHaveLength(before.length - 50);
    expect(bucket.objects).toEqual(objects);
  });
});

it("upload.paginated-upload-list", async ({
  uploads,
  protocolRuntime,
  mcpSessions,
}) => {
  await protocolRuntime.run(async () => {
    const { db: fixturePrisma, userId, run, upload, list } = uploads;
    const storedUploads = [];
    const tiedAt = new Date("2035-09-01T00:00:00.437Z");
    for (let index = 0; index < 5; index++)
      storedUploads.push(
        await fixturePrisma.upload.create({
          data: {
            userId,
            filename: `${index}.txt`,
            key: crypto.randomUUID(),
            size: 10,
            id: `upload-list-${userId}-${index}`,
            createdAt: tiedAt,
          },
        }),
      );
    await upload();
    const client = await mcpSessions.createMcpHarness(userId);
    const rest = await list("?page=2&pageSize=2");
    expect(rest.status).toBe(200);
    const payload = await rest.json();
    expect(Object.keys(payload).sort()).toEqual(["data", "meta", "pagination"]);
    expect(payload.data.map((row: { id: string }) => row.id)).toEqual([
      storedUploads[2].id,
      storedUploads[1].id,
    ]);
    expect(payload.pagination).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 5,
    });
    expect(payload.meta).toEqual({
      usedBytes: 1074,
      quotaBytes: uploadConfig.totalQuotaBytes,
      maxFileSizeBytes: uploadConfig.maxFileSizeBytes,
    });
    expect(
      await run(() =>
        client.call("workspace_upload_list", {
          page: 2,
          limit: 2,
          mode: "full",
        }),
      ),
    ).toEqual({ ...payload, success: true });
    expect((await (await list()).json()).pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 5,
    });
    expect((await (await list("?page=4&pageSize=2")).json()).data).toEqual([]);
    for (const query of [
      "?limit=2",
      "?page=2&pageSize=2&limit=2",
      "?page=no",
      "?pageSize=101",
    ]) {
      const response = await list(query);
      expect(response.status, query).toBe(400);
      await response.text();
    }
    for (const input of [{ page: 0 }, { limit: 0 }, { limit: 101 }])
      await expect(
        run(() => client.call("workspace_upload_list", input)),
      ).rejects.toThrow();
  });
});
