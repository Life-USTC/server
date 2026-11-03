import { Client } from "pg";
import { describe, expect } from "vitest";
import {
  deleteHomework,
  deleteHomeworkForModeration,
  updateHomework,
} from "@/features/homeworks/server/homework-mutations";
import { rlsTest as it } from "../shared/rls-fixture";

describe("Homework mutation actors", { tags: ["@Homework/Service"] }, () => {
  it("attributes collaborative edits to the service actor", async ({
    isolatedDatabase: { owner },
    rlsRuntime,
    rlsActors: { firstUserId, secondUserId },
    rlsHomework: { homeworkId },
  }) => {
    await rlsRuntime.run(async () => {
      expect(
        await updateHomework({
          homeworkId,
          userId: secondUserId,
          update: {
            homeworkUpdates: {
              title: "Collaborative edit",
              updatedBy: { connect: { id: firstUserId } },
            },
          },
        }),
      ).toEqual({ ok: true });
    });
    expect(
      await owner.homework.findUnique({
        where: { id: homeworkId },
        select: { title: true, createdById: true, updatedById: true },
      }),
    ).toEqual({
      title: "Collaborative edit",
      createdById: firstUserId,
      updatedById: secondUserId,
    });
  });

  it("joins concurrent deletion replays after the first tombstone commits", async ({
    isolatedDatabase: { owner, connections },
    rlsRuntime,
    rlsActors: { firstUserId, adminUserId },
    rlsHomework: { homeworkId },
  }) => {
    const blocker = new Client({ connectionString: connections.owner });
    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        'SELECT id FROM public."Homework" WHERE id = $1 FOR UPDATE',
        [homeworkId],
      );
      await rlsRuntime.run(async () => {
        const pending = [
          deleteHomework({ homeworkId, userId: firstUserId }),
          deleteHomeworkForModeration({ homeworkId, userId: adminUserId }),
        ];
        // Attach both error handlers before observing the blocked writers.
        const settled = Promise.allSettled(pending);
        try {
          await expect
            .poll(
              async () => {
                await blocker.query("SELECT pg_stat_clear_snapshot()");
                const result = await blocker.query<{ count: number }>(`
                SELECT count(*)::integer AS count FROM pg_stat_activity
                WHERE datname = current_database() AND usename = 'life_ustc_runtime'
                  AND wait_event_type = 'Lock' AND query LIKE '%UPDATE%Homework%'
              `);
                return result.rows[0].count;
              },
              { timeout: 10000 },
            )
            .toBe(2);
        } finally {
          await blocker.query("COMMIT");
        }
        const results = await settled;
        expect(results.every((result) => result.status === "fulfilled")).toBe(
          true,
        );
        const values = results.map((result) =>
          result.status === "fulfilled" ? result.value : null,
        );
        expect(values).toEqual(
          expect.arrayContaining([
            { ok: true, alreadyDeleted: false },
            { ok: true, alreadyDeleted: true },
          ]),
        );
        expect(
          await owner.auditLog.count({
            where: { action: "homework_delete" },
          }),
        ).toBe(1);
        const tombstone = await owner.homework.findUniqueOrThrow({
          where: { id: homeworkId },
        });
        expect(tombstone.deletedAt).toBeInstanceOf(Date);
        expect([firstUserId, adminUserId]).toContain(tombstone.deletedById);
      });
    } finally {
      await blocker.end();
    }
  });
});
