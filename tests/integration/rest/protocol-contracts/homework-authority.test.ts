import { expect } from "@playwright/test";
import { expectAuthorizationRejected } from "./_assertions";
import { noEffects, rejected, snapshot, successful, test } from "./_community";
import { homeworkCreate, homeworkUpdate } from "./_community-operations";
import type { ProtocolFixture } from "./_fixture";
import { type Transport, transports } from "./_transport";

test.use({ features: ["community.section-homework"] });
async function prepare(h: ProtocolFixture) {
  return h.db.homework.create({
    data: {
      sectionId: h.section.id,
      createdById: h.actors[0].id,
      title: "Original shared homework",
    },
  });
}
async function homeworkResult(
  h: ProtocolFixture,
  result: { homework: Record<string, unknown> },
  id: string,
  title: string,
  transport: Transport,
) {
  const row = await h.db.homework.findUniqueOrThrow({ where: { id } });
  expect(result.homework).toMatchObject({
    id,
    title,
    isMajor: false,
    requiresTeam: false,
    completionRequired: true,
    publishedAt: null,
    submissionStartAt: null,
    submissionDueAt: null,
  });
  if (transport === "graphql")
    expect(result.homework).toMatchObject({
      completed: false,
      completedAt: null,
    });
  else expect(result.homework.completion).toBeNull();
  expect(new Date(String(result.homework.createdAt)).getTime()).toBe(
    row.createdAt.getTime(),
  );
  expect(new Date(String(result.homework.updatedAt)).getTime()).toBe(
    row.updatedAt.getTime(),
  );
}
const queued = (sectionId: number) => ({
  purges: [],
  messages: [{ outcome: "fulfilled", value: { type: "section", sectionId } }],
  backgroundErrors: [],
});
for (const transport of transports) {
  for (const actorIndex of [0, 1])
    for (const action of ["create", "update"] as const) {
      test(`homework ${action} by editor ${actorIndex} through ${transport}`, async ({
        h,
        community: c,
      }) => {
        await c.run(async () => {
          const original = await prepare(h);
          const actor = h.actors[actorIndex];
          const title = "Collaborative homework";
          const op =
            action === "create"
              ? homeworkCreate(h.section.jwId, title)
              : homeworkUpdate(original.id, title);
          const result = successful(
            transport,
            await c.call(transport, op, actor.tokens[transport]),
            action === "create" ? 201 : 200,
          );
          await homeworkResult(
            h,
            result,
            action === "create" ? result.id : original.id,
            title,
            transport,
          );
          expect(
            await h.db.homework.findUnique({
              where: { id: action === "create" ? result.id : original.id },
            }),
          ).toMatchObject({
            title,
            createdById: action === "create" ? actor.id : h.actors[0].id,
            ...(action === "update" ? { updatedById: actor.id } : {}),
          });
          if (action === "create")
            expect(
              await h.db.homework.findUnique({ where: { id: original.id } }),
            ).toEqual(original);
          expect(
            await h.db.homework.count({ where: { sectionId: h.section.id } }),
          ).toBe(action === "create" ? 2 : 1);
          expect(await c.effects()).toEqual(queued(h.section.id));
        });
      });
    }
  for (const reason of ["deleted", "missing", "wrong-section"] as const)
    test(`homework ${reason} rejected through ${transport}`, async ({
      h,
      community: c,
    }) => {
      await c.run(async () => {
        const original = await prepare(h);
        if (reason === "deleted")
          await h.db.homework.update({
            where: { id: original.id },
            data: {
              deletedAt: new Date("2026-01-01T00:00:00Z"),
              deletedById: h.actors[0].id,
            },
          });
        const before = await snapshot(h);
        const op =
          reason === "wrong-section"
            ? homeworkCreate(h.section.id, "Wrong identifier")
            : homeworkUpdate(
                reason === "missing" ? crypto.randomUUID() : original.id,
                "Rejected update",
              );
        rejected(
          transport,
          await c.call(transport, op, h.actors[0].tokens[transport]),
          reason === "deleted" ? "deleted" : "not_found",
        );
        expect(await snapshot(h)).toEqual(before);
        expect(await c.effects()).toEqual(noEffects);
      });
    });
  for (const reason of ["anonymous", "read_scope", "suspended"] as const)
    for (const action of ["create", "update"] as const) {
      test(`homework ${action} ${reason} rejected through ${transport}`, async ({
        h,
        community: c,
      }) => {
        await c.run(async () => {
          const original = await prepare(h);
          const actor = h.actors[1];
          if (reason === "suspended")
            await h.db.userSuspension.create({
              data: { userId: actor.id, reason: h.marker },
            });
          const before = await snapshot(h);
          const op =
            action === "create"
              ? homeworkCreate(h.section.jwId, "Rejected create")
              : homeworkUpdate(original.id, "Rejected editor");
          const result = await c.call(
            transport,
            op,
            reason === "anonymous"
              ? undefined
              : reason === "read_scope"
                ? actor.readTokens[transport]
                : actor.tokens[transport],
          );
          if (reason === "suspended") rejected(transport, result, reason);
          else expectAuthorizationRejected(transport, result, reason);
          expect(await snapshot(h)).toEqual(before);
          expect(await c.effects()).toEqual(noEffects);
        });
      });
    }
}
for (const transport of ["rest", "graphql"] as const)
  for (const suspended of [false, true]) {
    test(`homework cookie collaborative edit suspended=${suspended} through ${transport}`, async ({
      h,
      community: c,
    }) => {
      await c.run(async () => {
        const original = await prepare(h);
        const actor = h.actors[1];
        if (suspended)
          await h.db.userSuspension.create({
            data: { userId: actor.id, reason: h.marker },
          });
        const before = await snapshot(h);
        const result = await c.cookie(
          transport,
          homeworkUpdate(original.id, "Session collaborative title"),
          actor,
        );
        if (suspended) {
          rejected(transport, result, "suspended");
          expect(await snapshot(h)).toEqual(before);
          expect(await c.effects()).toEqual(noEffects);
        } else {
          successful(transport, result);
          expect(
            await h.db.homework.findUnique({ where: { id: original.id } }),
          ).toMatchObject({
            title: "Session collaborative title",
            createdById: h.actors[0].id,
            updatedById: actor.id,
          });
          expect(await c.effects()).toEqual(queued(h.section.id));
        }
      });
    });
  }
