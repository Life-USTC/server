import { expect } from "@playwright/test";
import { createUploadBucket } from "../../../e2e/utils/upload-bucket";
import { expectSuccessfulOperation } from "./_assertions";
import {
  type Actor,
  type ProtocolFixture,
  test as protocolTest,
} from "./_fixture";
import {
  invokeOperation,
  type Operation,
  type OperationResult,
  type Transport,
} from "./_transport";

export type Rejection =
  | "forbidden"
  | "suspended"
  | "locked"
  | "deleted"
  | "not_found"
  | "target_not_found"
  | "parent_not_found"
  | "invalid_attachments";
export function rejected(
  transport: Transport,
  result: OperationResult,
  reason: Rejection,
) {
  const missing = [
    "not_found",
    "target_not_found",
    "parent_not_found",
  ].includes(reason);
  expect(result.response.status, JSON.stringify(result.payload)).toBe(
    transport === "mcp"
      ? 200
      : missing
        ? 404
        : reason === "invalid_attachments"
          ? 400
          : 403,
  );
  if (transport === "rest")
    expect(result.content.error).toEqual(expect.any(String));
  if (transport === "graphql") {
    expect(result.payload.errors).toHaveLength(1);
    expect(result.payload.errors[0].extensions.code).toBe(
      missing
        ? "NOT_FOUND"
        : reason === "invalid_attachments"
          ? "BAD_USER_INPUT"
          : "FORBIDDEN",
    );
  }
  if (transport === "mcp") {
    expect(result.payload.error).toBeUndefined();
    expect(result.payload.result.isError).not.toBe(true);
    expect(result.content).toMatchObject({ success: false, error: reason });
  }
}
export function successful(
  transport: Transport,
  result: OperationResult,
  restStatus = 200,
) {
  if (transport !== "rest") return expectSuccessfulOperation(transport, result);
  expect(result.response.status, JSON.stringify(result.payload)).toBe(
    restStatus,
  );
  return result.content;
}
export async function snapshot(h: ProtocolFixture) {
  return {
    comments: await h.db.comment.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: {
        reactions: { orderBy: { id: "asc" } },
        attachments: { orderBy: { id: "asc" } },
      },
    }),
    homeworks: await h.db.homework.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: { homeworkCompletions: { orderBy: { userId: "asc" } } },
    }),
    descriptions: await h.db.description.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: { edits: { orderBy: { id: "asc" } } },
    }),
    uploads: await h.db.upload.findMany({
      where: { userId: { in: h.actors.map((actor) => actor.id) } },
      orderBy: { id: "asc" },
    }),
    audits: await h.db.auditLog.findMany({
      where: {
        userId: { in: h.actors.map((actor) => actor.id) },
        action: {
          in: [
            "comment_create",
            "comment_edit",
            "comment_react",
            "description_edit",
            "homework_create",
            "homework_update",
          ],
        },
      },
      orderBy: { id: "asc" },
    }),
  };
}

type Effects = {
  purges: { outcome: string; result: { ok: boolean } }[];
  messages: { outcome: string; value: unknown }[];
  backgroundErrors: string[];
};
type Community = {
  call: (
    transport: Transport,
    operation: Operation,
    token?: string,
    cookie?: string,
  ) => Promise<OperationResult>;
  effects: () => Promise<Effects>;
  cookie: (
    transport: "rest" | "graphql",
    operation: Operation,
    actor: Actor,
  ) => Promise<OperationResult>;
  upload: (
    actor: Actor,
  ) => Promise<{ id: string; key: string; contents: string }>;
  objectsUnchanged: () => Promise<void>;
};
export const test = protocolTest.extend<{
  community: Community;
}>({
  community: async ({ h, request, isolatedWorker }, use) => {
    // Observe the same Worker as the protocol operations. Upload fixtures own a
    // separate runtime and must not provide this protocol's storage binding.
    const uploadBucket = createUploadBucket(request, h.origin);
    const probes: { id: string; created: boolean }[] = [];
    const pending = new Set<Promise<unknown>>();
    const operationErrors: unknown[] = [];
    const abort = new AbortController();
    let closing = false;
    const assertOpen = () => {
      if (closing) throw new Error("Community fixture resources disposed");
    };
    function own<T>(operation: () => Promise<T>): Promise<T> {
      assertOpen();
      const task = Promise.resolve().then(() => {
        assertOpen();
        return operation();
      });
      pending.add(task);
      void task.then(
        () => pending.delete(task),
        (error) => {
          pending.delete(task);
          operationErrors.push(error);
        },
      );
      return task;
    }
    const probeRequest = async (
      id: string,
      method: string,
      signal?: AbortSignal,
    ) =>
      fetch(`${h.origin}/__test/community-effects?id=${id}`, {
        method,
        signal,
        headers: { "x-test-storage-secret": "local-test-storage-observer" },
      });
    const call = async (
      transport: Transport,
      operation: Operation,
      token?: string,
      cookie?: string,
    ) => {
      assertOpen();
      const id = crypto.randomUUID();
      const probe = { id, created: false };
      probes.push(probe);
      expect((await probeRequest(id, "POST", abort.signal)).status).toBe(201);
      probe.created = true;
      assertOpen();
      return invokeOperation(
        h.origin,
        transport,
        operation,
        token,
        {
          "x-test-storage-secret": "local-test-storage-observer",
          "x-test-community-probe": id,
          ...(cookie ? { cookie } : {}),
        },
        abort.signal,
      );
    };
    const effects = async () => {
      const observed: Effects = {
        purges: [],
        messages: [],
        backgroundErrors: [],
      };
      for (const { id } of probes) {
        const response = await probeRequest(id, "GET", abort.signal);
        expect(response.status).toBe(200);
        const current: Effects = await response.json();
        observed.purges.push(...current.purges);
        observed.messages.push(...current.messages);
        observed.backgroundErrors.push(...current.backgroundErrors);
      }
      return observed;
    };
    const objects: { key: string; contents: string }[] = [];
    const cleanup = async () => {
      const results = await Promise.allSettled(
        probes.map(async ({ id, created }) => {
          const errors: unknown[] = [];
          try {
            const response = await probeRequest(id, "GET");
            if (created) expect(response.status).toBe(200);
            if (response.status !== 404) {
              expect(response.status).toBe(200);
              const state: Effects = await response.json();
              expect(state.backgroundErrors).toEqual([]);
              expect(state.purges.every((effect) => effect.result.ok)).toBe(
                true,
              );
              expect(
                [...state.purges, ...state.messages].every(
                  (effect) => effect.outcome === "fulfilled",
                ),
              ).toBe(true);
            }
          } catch (error) {
            errors.push(error);
          }
          try {
            expect(created ? [204] : [204, 404]).toContain(
              (await probeRequest(id, "DELETE")).status,
            );
          } catch (error) {
            errors.push(error);
          }
          if (errors.length)
            throw new AggregateError(errors, "Owned community probe failed");
        }),
      );
      results.push(
        ...(await Promise.allSettled(
          objects.map((object) => uploadBucket.delete(object.key)),
        )),
      );
      const errors = [
        ...operationErrors,
        ...results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        ),
      ];
      if (errors.length)
        throw new AggregateError(errors, "Community fixture cleanup failed");
    };
    try {
      await use({
        call: (...args) => own(() => call(...args)),
        effects: () => own(effects),
        cookie: (transport, operation, actor) =>
          own(async () => {
            const { cookie } = await isolatedWorker.createSession(actor.id);
            assertOpen();
            return call(
              transport,
              operation,
              undefined,
              `${cookie.name}=${cookie.value}`,
            );
          }),
        upload: (actor) =>
          own(async () => {
            const object = {
              key: `uploads/${actor.id}/${crypto.randomUUID()}`,
              contents: `Attachment owned by ${actor.id}`,
            };
            objects.push(object);
            await uploadBucket.put(object.key, object.contents, {
              httpMetadata: { contentType: "text/plain" },
            });
            assertOpen();
            const row = await h.db.upload.create({
              data: {
                userId: actor.id,
                key: object.key,
                filename: "attachment.txt",
                size: Buffer.byteLength(object.contents),
                contentType: "text/plain",
              },
            });
            return { ...object, id: row.id };
          }),
        objectsUnchanged: () =>
          own(async () => {
            for (const object of objects) {
              const stored = await uploadBucket.get(object.key);
              expect(stored).not.toBeNull();
              expect(Buffer.from(stored?.body ?? []).toString()).toBe(
                object.contents,
              );
              expect(await uploadBucket.head(object.key)).toMatchObject({
                size: Buffer.byteLength(object.contents),
                httpMetadata: { contentType: "text/plain" },
              });
            }
          }),
      });
    } finally {
      closing = true;
      abort.abort(new Error("Community fixture resources disposed"));
      // Settle full requests (including their bodies), session acquisition and
      // R2 writes before observing producers/deleting objects or releasing h.
      // Probe drain covers producer waitUntil/send/purge, not queue consumption.
      await Promise.allSettled([...pending]);
      await cleanup();
    }
  },
});

export const noEffects = { purges: [], messages: [], backgroundErrors: [] };
