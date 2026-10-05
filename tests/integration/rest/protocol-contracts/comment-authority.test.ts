import { expect } from "@playwright/test";
import { expectAuthorizationRejected } from "./_assertions";
import { noEffects, rejected, snapshot, successful, test } from "./_community";
import {
  commentCreate,
  commentUpdate,
  reaction,
} from "./_community-operations";
import type { ProtocolFixture } from "./_fixture";
import { transports } from "./_transport";

test.use({ features: ["community.comment"] });
async function prepare(h: ProtocolFixture) {
  return h.db.$transaction(
    h.actors.map((actor, index) =>
      h.db.comment.create({
        data: {
          sectionId: h.section.id,
          userId: actor.id,
          body: `Original author ${index}`,
        },
      }),
    ),
  );
}
const actions = ["create", "update", "reply", "react", "unreact"] as const;
function operation(
  action: (typeof actions)[number],
  h: ProtocolFixture,
  ownId: string,
  foreignId: string,
) {
  if (action === "create") return commentCreate(h.section.jwId, "New comment");
  if (action === "update") return commentUpdate(ownId, "Edited comment");
  if (action === "reply")
    return commentCreate(h.section.jwId, "New reply", foreignId);
  return reaction(foreignId, action === "react");
}

for (const transport of transports) {
  for (const authorIndex of [0, 1])
    for (const action of actions) {
      test(`comment ${action} by author ${authorIndex} through ${transport}`, {
        tag: `@Comment/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
      }, async ({ h, community: c }) => {
        await c.run(async () => {
          const rows = await prepare(h);
          const actor = h.actors[authorIndex];
          const own = rows[authorIndex],
            foreign = rows[1 - authorIndex];
          if (action === "unreact")
            await h.db.commentReaction.create({
              data: { commentId: foreign.id, userId: actor.id, type: "heart" },
            });
          const result = successful(
            transport,
            await c.call(
              transport,
              operation(action, h, own.id, foreign.id),
              actor.tokens[transport],
            ),
            action === "create" || action === "reply" ? 201 : 200,
          );
          if (action === "create" || action === "reply") {
            expect(
              await h.db.comment.findUnique({ where: { id: result.id } }),
            ).toMatchObject({
              sectionId: h.section.id,
              body: action === "create" ? "New comment" : "New reply",
              userId: actor.id,
              parentId: action === "reply" ? foreign.id : null,
            });
            expect(
              await h.db.comment.count({ where: { sectionId: h.section.id } }),
            ).toBe(3);
          } else if (action === "update") {
            const row = await h.db.comment.findUniqueOrThrow({
              where: { id: own.id },
            });
            expect(row).toMatchObject({
              body: "Edited comment",
              userId: actor.id,
            });
            if (transport === "graphql") expect(result).toEqual({ id: own.id });
            else {
              expect(result.comment).toMatchObject({
                id: own.id,
                body: "Edited comment",
                author: { id: actor.id },
              });
              expect(new Date(result.comment.updatedAt).getTime()).toBe(
                row.updatedAt.getTime(),
              );
            }
          } else {
            if (transport === "rest") expect(result).toEqual({ success: true });
            else expect(result.changed).toBe(true);
            if (transport === "graphql")
              expect(result.active).toBe(action === "react");
            const reactions = await h.db.commentReaction.findMany({
              where: { commentId: foreign.id },
              select: { userId: true, type: true },
            });
            expect(reactions).toEqual(
              action === "react" ? [{ userId: actor.id, type: "heart" }] : [],
            );
          }
          expect(
            await h.db.comment.findUnique({ where: { id: foreign.id } }),
          ).toEqual(foreign);
          if (action !== "update")
            expect(
              await h.db.comment.findUnique({ where: { id: own.id } }),
            ).toEqual(own);
          expect(await c.effects()).toEqual(noEffects);
        });
      });
    }
  for (const authorIndex of [0, 1])
    test(`comment foreign edit by author ${authorIndex} rejected through ${transport}`, {
      tag: `@Comment/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ h, community: c }) => {
      await c.run(async () => {
        const rows = await prepare(h);
        const before = await snapshot(h);
        rejected(
          transport,
          await c.call(
            transport,
            commentUpdate(rows[1 - authorIndex].id, "Rejected foreign edit"),
            h.actors[authorIndex].tokens[transport],
          ),
          "forbidden",
        );
        expect(await snapshot(h)).toEqual(before);
        expect(await c.effects()).toEqual(noEffects);
      });
    });
  for (const status of ["deleted", "softbanned"] as const)
    for (const action of ["update", "reply", "react", "unreact"] as const) {
      test(`comment ${status} ${action} rejected through ${transport}`, {
        tag: `@Comment/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
      }, async ({ h, community: c }) => {
        await c.run(async () => {
          const actor = h.actors[0];
          const row = await h.db.comment.create({
            data: {
              sectionId: h.section.id,
              userId: actor.id,
              body: "Locked original",
              status,
            },
          });
          if (action === "unreact")
            await h.db.commentReaction.create({
              data: { commentId: row.id, userId: actor.id, type: "heart" },
            });
          const before = await snapshot(h);
          rejected(
            transport,
            await c.call(
              transport,
              operation(action, h, row.id, row.id),
              actor.tokens[transport],
            ),
            "locked",
          );
          expect(await snapshot(h)).toEqual(before);
          expect(await c.effects()).toEqual(noEffects);
        });
      });
    }
  for (const action of ["update", "reply"] as const)
    test(`comment missing ${action} rejected through ${transport}`, {
      tag: `@Comment/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ h, community: c }) => {
      await c.run(async () => {
        await prepare(h);
        const before = await snapshot(h);
        const id = crypto.randomUUID();
        rejected(
          transport,
          await c.call(
            transport,
            operation(action, h, id, id),
            h.actors[0].tokens[transport],
          ),
          action === "reply" ? "parent_not_found" : "not_found",
        );
        expect(await snapshot(h)).toEqual(before);
        expect(await c.effects()).toEqual(noEffects);
      });
    });
  for (const reason of ["anonymous", "read_scope", "suspended"] as const)
    for (const action of actions) {
      test(`comment ${action} ${reason} rejected through ${transport}`, {
        tag: `@Comment/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
      }, async ({ h, community: c }) => {
        await c.run(async () => {
          const rows = await prepare(h);
          const actor = h.actors[0];
          if (action === "unreact")
            await h.db.commentReaction.create({
              data: { commentId: rows[1].id, userId: actor.id, type: "heart" },
            });
          if (reason === "suspended")
            await h.db.userSuspension.create({
              data: { userId: actor.id, reason: h.marker },
            });
          const before = await snapshot(h);
          const result = await c.call(
            transport,
            operation(action, h, rows[0].id, rows[1].id),
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
    test(`comment cookie edit suspended=${suspended} through ${transport}`, {
      tag: `@Comment/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ h, community: c }) => {
      await c.run(async () => {
        const rows = await prepare(h);
        const actor = h.actors[0];
        if (suspended)
          await h.db.userSuspension.create({
            data: { userId: actor.id, reason: h.marker },
          });
        const before = await snapshot(h);
        const result = await c.cookie(
          transport,
          commentUpdate(rows[0].id, "Session edit"),
          actor,
        );
        if (suspended) {
          rejected(transport, result, "suspended");
          expect(await snapshot(h)).toEqual(before);
        } else {
          successful(transport, result);
          expect(
            await h.db.comment.findUnique({ where: { id: rows[0].id } }),
          ).toMatchObject({ userId: actor.id, body: "Session edit" });
          expect(
            await h.db.comment.findUnique({ where: { id: rows[1].id } }),
          ).toEqual(rows[1]);
        }
        expect(await c.effects()).toEqual(noEffects);
      });
    });
  }
