import { type APIRequestContext, expect } from "@playwright/test";
import type {
  Comment,
  Prisma,
} from "../../../../src/generated/prisma-node/client";
import {
  type CatalogContractFixture,
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../../shared/catalog-contract-fixture";
import type { TestPrismaClient } from "../../../shared/prisma";
import { test as uploadTest } from "../uploads/_fixture";

type Actor = { id: string; request: APIRequestContext };
type CommentState = {
  db: TestPrismaClient;
  owner: Actor;
  other: Actor;
  anonymous: APIRequestContext;
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

const requestMethods = new Set([
  "fetch",
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
]);

/** Arrange known data independently of the route under test. Every API call
 * still uses the real Worker, and uploads use the existing real R2 fixture.
 */
export const test = uploadTest.extend<{ commentState: CommentState }>({
  commentState: async (
    { uploadState, createActor, request },
    use,
    testInfo,
  ) => {
    const { db } = uploadState;
    const probeId = crypto.randomUUID();
    const youngId = `comment-event-${crypto.randomUUID()}`;
    const contexts = new Set<APIRequestContext>();
    const pending = new Set<Promise<unknown>>();
    const requestErrors: unknown[] = [];
    let closing = false;
    let probeCreated = false;
    let catalog: CatalogContractFixture | undefined;
    const actorIds = [uploadState.owner.id, uploadState.other.id];
    const probe = (method: "post" | "get" | "delete") =>
      request[method](`/__test/community-effects?id=${probeId}`, {
        headers: { "x-test-storage-secret": "local-test-storage-observer" },
      });
    function observe(context: APIRequestContext): APIRequestContext {
      contexts.add(context);
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
    const owner = {
      ...uploadState.owner,
      request: observe(uploadState.owner.request),
    };
    const other = {
      ...uploadState.other,
      request: observe(uploadState.other.request),
    };
    const anonymous = observe(request);
    async function cleanup() {
      closing = true;
      // Do not abort a request and then race its still-running server mutation.
      await Promise.allSettled([...pending]);
      const failures = [...requestErrors];
      try {
        await testInfo.attach("comment-fixture-state", {
          body: JSON.stringify({
            actorIds,
            probeId,
            youngId,
            catalog: catalog?.cleanupIds,
          }),
          contentType: "application/json",
        });
      } catch (error) {
        failures.push(error);
      }
      try {
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
      const closed = await Promise.allSettled(
        [...contexts].map((context) => context.dispose()),
      );
      failures.push(
        ...closed.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        ),
      );
      // Actor-owned records include mutations whose response could not be decoded.
      for (const remove of [
        () => db.comment.deleteMany({ where: { userId: { in: actorIds } } }),
        () => db.youngEvent.deleteMany({ where: { youngId } }),
      ]) {
        try {
          await remove();
        } catch (error) {
          failures.push(error);
        }
      }
      if (catalog) {
        try {
          await cleanupCatalogContractFixture(db, catalog);
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length)
        throw new AggregateError(failures, "Comment fixture cleanup failed");
    }
    let setupFailure: unknown;
    try {
      expect((await probe("post")).status()).toBe(201);
      probeCreated = true;
      catalog = await createCatalogContractFixture(db);
      const youngEvent = await db.youngEvent.create({
        data: {
          youngId,
          name: "Private comment event",
          isActive: true,
          rawJson: {},
        },
      });
      const section = catalog.sections[0];
      await use({
        db,
        owner,
        other,
        anonymous,
        catalog,
        section,
        course: catalog.courses[0],
        teacher: catalog.teachers[0],
        youngEvent,
        admin: async () => {
          const actor = await createActor({ isAdmin: true });
          actorIds.push(actor.id);
          return { ...actor, request: observe(actor.request) };
        },
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
      });
    } catch (error) {
      setupFailure = error;
    }
    try {
      await cleanup();
    } catch (error) {
      if (setupFailure)
        throw new AggregateError(
          [setupFailure, error],
          "Comment setup and cleanup failed",
        );
      throw error;
    }
    if (setupFailure) throw setupFailure;
  },
});
