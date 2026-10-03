import { type APIRequestContext, expect } from "@playwright/test";
import type {
  Comment,
  Prisma,
  Upload,
} from "../../../../src/generated/prisma-node/client";
import { test as ownedTest } from "../../../e2e/utils/owned-worker";
import {
  createUploadBucket,
  type UploadBucket,
} from "../../../e2e/utils/upload-bucket";
import {
  type CatalogContractFixture,
  createCatalogContractFixture,
} from "../../../shared/catalog-contract-fixture";
import type { TestPrismaClient } from "../../../shared/prisma";

type Actor = { id: string; request: APIRequestContext };
type CommentState = {
  db: TestPrismaClient;
  owner: Actor;
  other: Actor;
  anonymous: APIRequestContext;
  bucket: UploadBucket;
  knownUpload: (input: {
    filename: string;
    contents: string;
  }) => Promise<Upload>;
  admin: () => Promise<Actor>;
  catalog: CatalogContractFixture;
  section: CatalogContractFixture["sections"][number];
  course: CatalogContractFixture["courses"][number];
  teacher: CatalogContractFixture["teachers"][number];
  youngEvent: { id: number; youngId: string };
  comment: (
    data?: Partial<Prisma.CommentUncheckedCreateInput>,
  ) => Promise<Comment>;
};
type CommentEffects = {
  initialize: () => Promise<void>;
  run: <T>(work: () => Promise<T>) => Promise<T>;
  observe: (request: APIRequestContext) => APIRequestContext;
};

const requestMethods = new Set([
  "fetch",
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
]);

/** Each case owns its real Worker, database, queue runtime and R2 persistence.
 * The probe observes producer waitUntil/purge/send outcomes. It does not prove
 * queue consumption: native Worker teardown prevents deferred work reaching
 * another test's environment, including when setup or the body fails.
 */
export const test = ownedTest.extend<{
  commentState: CommentState;
  _commentEffects: CommentEffects;
}>({
  _commentEffects: async ({ request }, use, testInfo) => {
    const probeId = crypto.randomUUID();
    const pending = new Set<Promise<unknown>>();
    const requestErrors: unknown[] = [];
    let closing = false;
    let probeCreated = false;
    const probe = (method: "post" | "get" | "delete") =>
      request[method](`/__test/community-effects?id=${probeId}`, {
        headers: { "x-test-storage-secret": "local-test-storage-observer" },
      });
    function observe(context: APIRequestContext): APIRequestContext {
      return new Proxy(context, {
        get(target, property) {
          const value = Reflect.get(target, property);
          if (!requestMethods.has(String(property)))
            return typeof value === "function" ? value.bind(target) : value;
          return (
            url: unknown,
            options?: { headers?: Record<string, string> },
          ) => {
            if (closing) throw new Error("Comment fixture is closing");
            const operation: Promise<unknown> = value.call(target, url, {
              ...options,
              headers: {
                ...options?.headers,
                "x-test-storage-secret": "local-test-storage-observer",
                "x-test-community-probe": probeId,
              },
            });
            pending.add(operation);
            void operation.then(
              () => pending.delete(operation),
              (error) => {
                pending.delete(operation);
                requestErrors.push(error);
              },
            );
            return operation;
          };
        },
      });
    }
    const failures: unknown[] = [];
    // Register teardown before a dependent fixture creates the probe or data.
    try {
      await use({
        observe,
        run: (work) => {
          if (closing)
            return Promise.reject(new Error("Comment fixture is closing"));
          // Admit the complete setup/body before its first await. The probe's
          // native teardown must join DB and body continuations as well as HTTP.
          const operation = Promise.resolve().then(work);
          pending.add(operation);
          void operation.then(
            () => pending.delete(operation),
            (error) => {
              pending.delete(operation);
              failures.push(error);
            },
          );
          return operation;
        },
        initialize: async () => {
          expect((await probe("post")).status()).toBe(201);
          probeCreated = true;
        },
      });
    } catch (error) {
      failures.push(error);
    }
    closing = true;
    await Promise.allSettled([...pending]);
    failures.push(...requestErrors);
    try {
      await testInfo.attach("comment-effect-probe", {
        body: JSON.stringify({ probeId }),
        contentType: "application/json",
      });
      const response = await probe("get");
      if (probeCreated) expect(response.status()).toBe(200);
      if (response.status() !== 404) {
        expect(response.status()).toBe(200);
        const effects = (await response.json()) as {
          backgroundErrors: string[];
          purges: { outcome: string; result: { ok: boolean } }[];
          messages: { outcome: string }[];
        };
        expect(effects.backgroundErrors).toEqual([]);
        expect(
          [...effects.purges, ...effects.messages].every(
            (effect) => effect.outcome === "fulfilled",
          ),
        ).toBe(true);
        expect(effects.purges.every((effect) => effect.result.ok)).toBe(true);
      }
    } catch (error) {
      failures.push(error);
    }
    try {
      expect(probeCreated ? [204] : [204, 404]).toContain(
        (await probe("delete")).status(),
      );
    } catch (error) {
      failures.push(error);
    }
    if (failures.length)
      throw new AggregateError(failures, "Comment effect observation failed");
  },
  run: async ({ run, _commentEffects }, use) => {
    await use((work) => _commentEffects.run(() => run(work)));
  },
  commentState: async (
    { isolatedWorker, request, _commentEffects, run },
    use,
  ) => {
    const state = await run<CommentState>(async () => {
      await _commentEffects.initialize();
      const db = isolatedWorker.database.owner;
      const actor = async (options?: { isAdmin: boolean }) => {
        const created = await isolatedWorker.createActor(options);
        return {
          ...created,
          request: _commentEffects.observe(created.request),
        };
      };
      const owner = await actor();
      const other = await actor();
      const anonymous = _commentEffects.observe(request);
      const catalog = await createCatalogContractFixture(db);
      const youngEvent = await db.youngEvent.create({
        data: {
          youngId: `comment-event-${crypto.randomUUID()}`,
          name: "Private comment event",
          isActive: true,
          rawJson: {},
        },
      });
      const section = catalog.sections[0];
      const bucket = createUploadBucket(anonymous, isolatedWorker.origin);
      return {
        db,
        owner,
        other,
        anonymous,
        bucket,
        knownUpload: async ({ filename, contents }) => {
          const key = `uploads/${owner.id}/${crypto.randomUUID()}`;
          await bucket.put(key, contents, {
            httpMetadata: { contentType: "text/plain" },
          });
          return db.upload.create({
            data: {
              userId: owner.id,
              key,
              filename,
              contentType: "text/plain",
              size: Buffer.byteLength(contents),
            },
          });
        },
        catalog,
        section,
        course: catalog.courses[0],
        teacher: catalog.teachers[0],
        youngEvent,
        admin: () => actor({ isAdmin: true }),
        comment: (data = {}) =>
          db.comment.create({
            data: {
              userId: owner.id,
              sectionId: section.id,
              body: "Prepared root comment",
              createdAt: new Date("2026-01-01T00:00:00Z"),
              ...data,
            },
          }),
      };
    });
    await use(state);
  },
});
