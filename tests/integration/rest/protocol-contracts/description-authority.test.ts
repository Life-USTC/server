import { expect } from "@playwright/test";
import { expectAuthorizationRejected } from "./_assertions";
import { noEffects, rejected, snapshot, successful, test } from "./_community";
import { descriptionSet } from "./_community-operations";
import type { ProtocolFixture } from "./_fixture";
import { transports } from "./_transport";

test.use({ features: ["community.description"] });
const onePurge = {
  purges: [{ outcome: "fulfilled", result: { ok: true, tags: [] } }],
  messages: [],
  backgroundErrors: [],
};
async function prepare(h: ProtocolFixture, editorIndex = 1) {
  return h.db.description.create({
    data: {
      sectionId: h.section.id,
      content: "Original shared content",
      lastEditedById: h.actors[editorIndex].id,
      edits: {
        create: {
          editorId: h.actors[editorIndex].id,
          previousContent: null,
          nextContent: "Original shared content",
        },
      },
    },
  });
}
for (const transport of transports) {
  for (const authorIndex of [0, 1])
    for (const action of ["create", "edit"] as const) {
      test(`description ${action} by editor ${authorIndex} through ${transport}`, {
        tag: `@Description/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
      }, async ({ h, community: c }) => {
        await c.run(async () => {
          const actor = h.actors[authorIndex];
          const previous =
            action === "edit" ? await prepare(h, 1 - authorIndex) : undefined;
          const result = successful(
            transport,
            await c.call(
              transport,
              descriptionSet(h.section.jwId, "Updated shared content"),
              actor.tokens[transport],
            ),
          );
          expect(result.updated).toBe(true);
          if (previous) expect(result.id).toBe(previous.id);
          const row = await h.db.description.findUniqueOrThrow({
            where: { id: result.id },
          });
          expect(row).toMatchObject({
            sectionId: h.section.id,
            content: "Updated shared content",
            lastEditedById: actor.id,
          });
          if (transport === "mcp") {
            expect(result.description.content).toBe("Updated shared content");
            expect(new Date(result.description.updatedAt).getTime()).toBe(
              row.updatedAt.getTime(),
            );
          }
          const edits = await h.db.descriptionEdit.findMany({
            where: { descriptionId: row.id },
            orderBy: { createdAt: "asc" },
            select: {
              editorId: true,
              previousContent: true,
              nextContent: true,
            },
          });
          expect(edits).toEqual([
            ...(previous
              ? [
                  {
                    editorId: h.actors[1 - authorIndex].id,
                    previousContent: null,
                    nextContent: "Original shared content",
                  },
                ]
              : []),
            {
              editorId: actor.id,
              previousContent: previous ? "Original shared content" : null,
              nextContent: "Updated shared content",
            },
          ]);
          expect(
            await h.db.description.count({
              where: { sectionId: h.section.id },
            }),
          ).toBe(1);
          expect(await c.effects()).toEqual(onePurge);
        });
      });
    }
  test(`description internal section ID rejected through ${transport}`, {
    tag: `@Description/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ h, community: c }) => {
    await c.run(async () => {
      await prepare(h);
      const before = await snapshot(h);
      rejected(
        transport,
        await c.call(
          transport,
          descriptionSet(h.section.id, "Wrong identifier"),
          h.actors[0].tokens[transport],
        ),
        "target_not_found",
      );
      expect(await snapshot(h)).toEqual(before);
      expect(await c.effects()).toEqual(noEffects);
    });
  });
  for (const reason of ["anonymous", "read_scope", "suspended"] as const) {
    test(`description ${reason} rejected through ${transport}`, {
      tag: `@Description/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ h, community: c }) => {
      await c.run(async () => {
        await prepare(h);
        const actor = h.actors[1];
        if (reason === "suspended")
          await h.db.userSuspension.create({
            data: { userId: actor.id, reason: h.marker },
          });
        const before = await snapshot(h);
        const result = await c.call(
          transport,
          descriptionSet(h.section.jwId, "Rejected editor"),
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
    test(`description cookie collaborative edit suspended=${suspended} through ${transport}`, {
      tag: `@Description/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ h, community: c }) => {
      await c.run(async () => {
        const original = await prepare(h, 0);
        const actor = h.actors[1];
        if (suspended)
          await h.db.userSuspension.create({
            data: { userId: actor.id, reason: h.marker },
          });
        const before = await snapshot(h);
        const result = await c.cookie(
          transport,
          descriptionSet(h.section.jwId, "Session collaborative content"),
          actor,
        );
        if (suspended) {
          rejected(transport, result, "suspended");
          expect(await snapshot(h)).toEqual(before);
          expect(await c.effects()).toEqual(noEffects);
        } else {
          expect(successful(transport, result).id).toBe(original.id);
          expect(
            await h.db.description.findUnique({ where: { id: original.id } }),
          ).toMatchObject({
            content: "Session collaborative content",
            lastEditedById: actor.id,
          });
          expect(
            await h.db.descriptionEdit.count({
              where: { descriptionId: original.id },
            }),
          ).toBe(2);
          expect(await c.effects()).toEqual(onePurge);
        }
      });
    });
  }

for (const transport of transports)
  test(`description history retains six collaborative edits through ${transport}`, {
    tag: `@Description/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ h, community: c }) => {
    await c.run(async () => {
      const expected = [];
      let descriptionId: string | undefined;
      let previousContent: string | null = null;
      for (const revision of [0, 1, 2])
        for (const [index, actor] of h.actors.entries()) {
          const content = `${transport} revision ${revision} by editor ${index}`;
          const result = successful(
            transport,
            await c.call(
              transport,
              descriptionSet(h.section.jwId, content),
              actor.tokens[transport],
            ),
          );
          expect(result.updated).toBe(true);
          if (descriptionId) expect(result.id).toBe(descriptionId);
          else descriptionId = result.id;
          expected.push({
            editorId: actor.id,
            previousContent,
            nextContent: content,
          });
          previousContent = content;
        }
      expect(
        await h.db.descriptionEdit.findMany({
          where: { descriptionId },
          orderBy: { createdAt: "asc" },
          select: { editorId: true, previousContent: true, nextContent: true },
        }),
      ).toEqual(expected);
      expect(expected).toHaveLength(6);
      expect(await c.effects()).toEqual({
        purges: Array.from({ length: 6 }, () => ({
          outcome: "fulfilled",
          result: { ok: true, tags: [] },
        })),
        messages: [],
        backgroundErrors: [],
      });
    });
  });
