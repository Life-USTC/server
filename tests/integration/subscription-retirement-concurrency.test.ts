import { afterAll, describe, expect, it } from "vitest";
import { mutateUserSectionSubscriptionsInTransaction } from "@/features/subscriptions/server/subscription-write-model";
import { reconcileSectionSourceLifecycle } from "@/static-loader/section-lifecycle";
import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../shared/prisma";

const prisma = createTestPrisma();
let fixtureSequence = 0;

afterAll(() => disconnectTestPrisma(prisma));

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitForSignal(
  signal: Promise<void>,
  operation: Promise<unknown>,
  earlyCompletionMessage: string,
) {
  await Promise.race([
    signal,
    operation.then(() => {
      throw new Error(earlyCompletionMessage);
    }),
  ]);
}

async function settleOperations(
  ...operations: Array<Promise<unknown> | undefined>
) {
  await Promise.allSettled(
    operations.filter(
      (operation): operation is Promise<unknown> => operation !== undefined,
    ),
  );
}

async function waitForBackendLock(
  observer: TestPrismaClient,
  pid: number,
  failureMessage: string,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [activity] = await observer.$queryRaw<
      Array<{ waitEventType: string | null }>
    >`
      SELECT "wait_event_type" AS "waitEventType"
      FROM pg_stat_activity
      WHERE pid = ${pid}
    `;
    if (activity?.waitEventType === "Lock") return;
    if (attempt === 99) throw new Error(failureMessage);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function createFixture(options: { subscribedToFirst: boolean }) {
  fixtureSequence += 1;
  const numericMarker =
    2_120_000_000 + (Date.now() % 10_000_000) + fixtureSequence * 10;
  const marker = `[integration-test] subscription-lock-${numericMarker}`;
  return prisma.$transaction(async (tx) => {
    const semester = await tx.semester.create({
      data: {
        jwId: numericMarker,
        code: marker,
        nameCn: marker,
      },
    });
    const course = await tx.course.create({
      data: {
        jwId: numericMarker,
        code: marker,
        nameCn: marker,
      },
    });
    const sections = await Promise.all(
      [0, 1, 2].map((offset) =>
        tx.section.create({
          data: {
            jwId: numericMarker + offset,
            code: `${marker}-${offset}`,
            courseId: course.id,
            semesterId: semester.id,
          },
        }),
      ),
    );
    const user = await tx.user.create({
      data: {
        email: `${numericMarker}@subscription-lock.integration`,
        name: marker,
        subscribedSections: options.subscribedToFirst
          ? { connect: { id: sections[0].id } }
          : undefined,
      },
    });
    return { course, sections, semester, user };
  });
}

async function deleteFixture(
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: fixture.user.id } });
    await tx.section.deleteMany({
      where: { id: { in: fixture.sections.map((section) => section.id) } },
    });
    await tx.course.delete({ where: { id: fixture.course.id } });
    await tx.semester.delete({ where: { id: fixture.semester.id } });
  });
}

describe("Section subscription retirement linearization", () => {
  it("rejects a newly retired candidate while preserving one explicit existing relation once", async () => {
    const fixture = await createFixture({ subscribedToFirst: true });
    const importerPrisma = createTestPrisma();
    const subscriberPrisma = createTestPrisma();
    const importerLocked = deferred();
    const releaseImporter = deferred();
    const subscriberPidReady = deferred();
    const retiredAt = new Date("2026-07-18T04:00:00.000Z");
    let subscriberPid = 0;
    let importer: Promise<void> | undefined;
    let subscriber:
      | Promise<
          Awaited<
            ReturnType<typeof mutateUserSectionSubscriptionsInTransaction>
          >
        >
      | undefined;

    try {
      importer = importerPrisma.$transaction(async (tx) => {
        await reconcileSectionSourceLifecycle(tx, {
          observedAt: retiredAt,
          retirementEnabled: true,
          expectedRetirementCandidateCount: 2,
          scopedSemesterIds: [fixture.semester.id],
          seenSectionJwIds: [fixture.sections[2].jwId],
          snapshotSha256: "importer-first",
        });
        importerLocked.resolve();
        await releaseImporter.promise;
      });
      await waitForSignal(
        importerLocked.promise,
        importer,
        "Lifecycle transaction completed before acquiring its advisory locks",
      );

      subscriber = subscriberPrisma.$transaction(async (tx) => {
        const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_backend_pid()::integer AS pid
        `;
        subscriberPid = backend.pid;
        subscriberPidReady.resolve();
        return mutateUserSectionSubscriptionsInTransaction(tx as never, {
          candidateSectionIds: [
            fixture.sections[0].id,
            fixture.sections[0].id,
            fixture.sections[1].id,
            fixture.sections[1].id,
          ],
          mode: "replace",
          preserveRetiredSectionIds: [
            fixture.sections[0].id,
            fixture.sections[0].id,
            fixture.sections[1].id,
          ],
          userId: fixture.user.id,
        });
      });
      await waitForSignal(
        subscriberPidReady.promise,
        subscriber,
        "Subscription transaction completed before exposing its backend PID",
      );
      await waitForBackendLock(
        prisma,
        subscriberPid,
        "Subscription mutation did not wait for the lifecycle advisory lock",
      );

      releaseImporter.resolve();
      await importer;
      const result = await subscriber;

      expect(result).toEqual({
        activeCandidateSectionIds: [],
        addedSectionIds: [],
        effectiveSectionIds: [fixture.sections[0].id],
        preservedRetiredSectionIds: [fixture.sections[0].id],
        removedSectionIds: [],
        unchangedSectionIds: [fixture.sections[0].id],
      });
      await expect(
        prisma.user.findUnique({
          where: { id: fixture.user.id },
          select: {
            subscribedSections: {
              orderBy: { id: "asc" },
              select: { id: true, retiredAt: true },
            },
          },
        }),
      ).resolves.toEqual({
        subscribedSections: [{ id: fixture.sections[0].id, retiredAt }],
      });
    } finally {
      releaseImporter.resolve();
      await settleOperations(importer, subscriber);
      await Promise.all([
        disconnectTestPrisma(importerPrisma),
        disconnectTestPrisma(subscriberPrisma),
      ]);
      await deleteFixture(fixture);
    }
  });

  it("lets a subscriber that owns the advisory lock commit before retirement", async () => {
    const fixture = await createFixture({ subscribedToFirst: false });
    const importerPrisma = createTestPrisma();
    const subscriberPrisma = createTestPrisma();
    const subscriberMutated = deferred();
    const releaseSubscriber = deferred();
    const importerPidReady = deferred();
    const retiredAt = new Date("2026-07-18T05:00:00.000Z");
    let importerPid = 0;
    let subscriber: Promise<void> | undefined;
    let importer: Promise<void> | undefined;

    try {
      let mutationResult:
        | Awaited<
            ReturnType<typeof mutateUserSectionSubscriptionsInTransaction>
          >
        | undefined;
      subscriber = subscriberPrisma.$transaction(async (tx) => {
        mutationResult = await mutateUserSectionSubscriptionsInTransaction(
          tx as never,
          {
            candidateSectionIds: [fixture.sections[0].id],
            mode: "connect",
            userId: fixture.user.id,
          },
        );
        subscriberMutated.resolve();
        await releaseSubscriber.promise;
      });
      await waitForSignal(
        subscriberMutated.promise,
        subscriber,
        "Subscription transaction completed before acquiring its advisory lock",
      );

      importer = importerPrisma.$transaction(async (tx) => {
        const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_backend_pid()::integer AS pid
        `;
        importerPid = backend.pid;
        importerPidReady.resolve();
        await reconcileSectionSourceLifecycle(tx, {
          observedAt: retiredAt,
          retirementEnabled: true,
          expectedRetirementCandidateCount: 1,
          scopedSemesterIds: [fixture.semester.id],
          seenSectionJwIds: [
            fixture.sections[1].jwId,
            fixture.sections[2].jwId,
          ],
          snapshotSha256: "subscriber-first",
        });
      });
      await waitForSignal(
        importerPidReady.promise,
        importer,
        "Lifecycle transaction completed before exposing its backend PID",
      );
      await waitForBackendLock(
        prisma,
        importerPid,
        "Retirement did not wait for the subscription advisory lock",
      );

      releaseSubscriber.resolve();
      await subscriber;
      await importer;

      expect(mutationResult).toEqual({
        activeCandidateSectionIds: [fixture.sections[0].id],
        addedSectionIds: [fixture.sections[0].id],
        effectiveSectionIds: [fixture.sections[0].id],
        preservedRetiredSectionIds: [],
        removedSectionIds: [],
        unchangedSectionIds: [],
      });
      await expect(
        prisma.user.findUnique({
          where: { id: fixture.user.id },
          select: {
            subscribedSections: {
              select: { id: true, retiredAt: true },
            },
          },
        }),
      ).resolves.toEqual({
        subscribedSections: [{ id: fixture.sections[0].id, retiredAt }],
      });
    } finally {
      releaseSubscriber.resolve();
      await settleOperations(subscriber, importer);
      await Promise.all([
        disconnectTestPrisma(importerPrisma),
        disconnectTestPrisma(subscriberPrisma),
      ]);
      await deleteFixture(fixture);
    }
  });
});
