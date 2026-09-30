import { expect } from "@playwright/test";
import { noEffects, rejected, snapshot, successful, test } from "./_community";
import { commentCreate, commentUpdate } from "./_community-operations";
import { transports } from "./_transport";

test.use({ features: ["community.comment"] });
for (const transport of transports)
  for (const authorIndex of [0, 1]) {
    for (const action of ["create", "retain", "replace", "detach"] as const) {
      test(`comment attachment ${action} by author ${authorIndex} through ${transport}`, async ({
        h,
        community: c,
      }) => {
        await c.run(async () => {
          const actor = h.actors[authorIndex];
          const other = h.actors[1 - authorIndex];
          const own = await c.upload(actor),
            replacement = await c.upload(actor),
            foreign = await c.upload(other),
            occupied = await c.upload(actor);
          const occupiedComment = await h.db.comment.create({
            data: {
              sectionId: h.section.id,
              userId: actor.id,
              body: "Occupied comment",
              attachments: { create: { uploadId: occupied.id } },
            },
          });
          const original =
            action === "create"
              ? undefined
              : await h.db.comment.create({
                  data: {
                    sectionId: h.section.id,
                    userId: actor.id,
                    body: "Original attached comment",
                    attachments: { create: { uploadId: own.id } },
                  },
                });
          const uploads = await h.db.upload.findMany({
            where: {
              id: { in: [own.id, replacement.id, foreign.id, occupied.id] },
            },
            orderBy: { id: "asc" },
          });
          const attachmentIds =
            action === "detach"
              ? []
              : [action === "replace" ? replacement.id : own.id];
          const op = original
            ? commentUpdate(
                original.id,
                "Updated attached comment",
                attachmentIds,
              )
            : commentCreate(
                h.section.jwId,
                "Created attached comment",
                undefined,
                attachmentIds,
              );
          const result = successful(
            transport,
            await c.call(transport, op, actor.tokens[transport]),
            action === "create" ? 201 : 200,
          );
          const id = original?.id ?? result.id;
          expect(await h.db.comment.findUnique({ where: { id } })).toMatchObject({
            userId: actor.id,
            body: original
              ? "Updated attached comment"
              : "Created attached comment",
          });
          expect(
            await h.db.commentAttachment.findMany({
              where: { commentId: id },
              select: { uploadId: true },
            }),
          ).toEqual(attachmentIds.map((uploadId) => ({ uploadId })));
          expect(
            await h.db.comment.findUnique({ where: { id: occupiedComment.id } }),
          ).toEqual(occupiedComment);
          expect(
            await h.db.commentAttachment.findMany({
              where: { commentId: occupiedComment.id },
              select: { uploadId: true },
            }),
          ).toEqual([{ uploadId: occupied.id }]);
          expect(
            await h.db.upload.findMany({
              where: { id: { in: uploads.map((upload) => upload.id) } },
              orderBy: { id: "asc" },
            }),
          ).toEqual(uploads);
          expect(
            await h.db.comment.count({ where: { sectionId: h.section.id } }),
          ).toBe(2);
          await c.objectsUnchanged();
          expect(await c.effects()).toEqual(noEffects);
        });
      });
    }
    for (const action of ["create", "update"] as const)
      for (const invalid of ["foreign", "occupied", "missing"] as const) {
        test(`comment attachment ${invalid} ${action} by author ${authorIndex} rejected through ${transport}`, async ({
          h,
          community: c,
        }) => {
          await c.run(async () => {
            const actor = h.actors[authorIndex];
            const own = await c.upload(actor),
              replacement = await c.upload(actor),
              foreign = await c.upload(h.actors[1 - authorIndex]),
              occupied = await c.upload(actor);
            await h.db.comment.create({
              data: {
                sectionId: h.section.id,
                userId: actor.id,
                body: "Occupied comment",
                attachments: { create: { uploadId: occupied.id } },
              },
            });
            const original =
              action === "create"
                ? undefined
                : await h.db.comment.create({
                    data: {
                      sectionId: h.section.id,
                      userId: actor.id,
                      body: "Original attached comment",
                      attachments: { create: { uploadId: own.id } },
                    },
                  });
            const invalidId =
              invalid === "foreign"
                ? foreign.id
                : invalid === "occupied"
                  ? occupied.id
                  : crypto.randomUUID();
            // A valid item precedes the invalid item: rejection must not partially attach it.
            const ids = [original ? replacement.id : own.id, invalidId];
            const before = await snapshot(h);
            const op = original
              ? commentUpdate(original.id, "Rejected body change", ids)
              : commentCreate(
                  h.section.jwId,
                  "Rejected creation",
                  undefined,
                  ids,
                );
            rejected(
              transport,
              await c.call(transport, op, actor.tokens[transport]),
              "invalid_attachments",
            );
            expect(await snapshot(h)).toEqual(before);
            await c.objectsUnchanged();
            expect(await c.effects()).toEqual(noEffects);
          });
        });
      }
  }
