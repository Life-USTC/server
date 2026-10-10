import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { commentTargetTest } from "../shared/comment-target-contract-fixture";

commentTargetTest(
  "comment.attached-to-object",
  { tags: ["@Comment/Service"] },
  async ({ commentTargets, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { db, userId, sectionId, postCommentRoute, request, marker, read } =
        commentTargets;
      const before = await db.comment.count({ where: { userId } });
      const inputs: Record<string, string | number>[] = [
        {},
        { targetType: "section" },
        { targetId: sectionId },
      ];
      for (const input of inputs) {
        expect(
          (await postCommentRoute(request({ ...input, body: marker }))).status,
        ).toBe(400);
        expect((await read(input)).status).toBe(400);
      }
      expect(await db.comment.count({ where: { userId } })).toBe(before);
    }),
);

commentTargetTest(
  "comment.attached-object-types",
  { tags: ["@Comment/Service"] },
  async ({ commentTargets, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { targets, create, db, userId, postCommentRoute, request, marker } =
        commentTargets;
      for (const target of targets) {
        const id = await create(target);
        const row = await db.comment.findUniqueOrThrow({ where: { id } });
        expect(row).toHaveProperty(target.column, target.id);
        expect(
          targets.filter(
            ({ column }) => row[column as keyof typeof row] !== null,
          ),
        ).toHaveLength(1);
      }
      const before = await db.comment.count({ where: { userId } });
      for (const type of ["user", "publication", "room", "unsupported"]) {
        expect(
          (
            await postCommentRoute(
              request({ targetType: type, targetId: 1, body: marker }),
            )
          ).status,
        ).toBe(400);
      }
      for (const target of targets) {
        const publicKey = Object.keys(target.public)[0];
        const missing =
          typeof target.public[publicKey] === "number"
            ? 2147483647
            : `missing-${marker}`;
        expect(
          (
            await postCommentRoute(
              request({
                targetType: target.type,
                [publicKey]: missing,
                body: marker,
              }),
            )
          ).status,
        ).toBe(404);
      }
      expect(await db.comment.count({ where: { userId } })).toBe(before);
    }),
);

commentTargetTest(
  "comment.target-identifiers",
  { tags: ["@Comment/Service"] },
  async ({ commentTargets, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { targets, create, read, postCommentRoute, request, marker } =
        commentTargets;
      for (const target of targets) {
        const id = await create(target);
        const byPublic = await read({
          targetType: target.type,
          ...target.public,
        });
        expect(byPublic.status).toBe(200);
        const publicBody = await byPublic.json();
        expect(
          publicBody.data.some((row: { id: string }) => row.id === id),
        ).toBe(true);
        const byCanonical = await read({
          targetType: target.type,
          targetId: target.id,
        });
        if (target.type === "young-event") {
          expect(byCanonical.status).toBe(400);
          expect(
            (
              await postCommentRoute(
                request({
                  targetType: target.type,
                  targetId: target.id,
                  ...target.public,
                  body: marker,
                }),
              )
            ).status,
          ).toBe(400);
        } else {
          expect(byCanonical.status).toBe(200);
          expect((await byCanonical.json()).data).toEqual(publicBody.data);
          const created = await postCommentRoute(
            request({
              targetType: target.type,
              targetId: target.id,
              body: marker,
            }),
          );
          expect(created.status, await created.clone().text()).toBe(201);
        }
      }
    }),
);

commentTargetTest(
  "comment.target-not-found",
  { tags: ["@Comment/Service"] },
  async ({ commentTargets, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { targets, marker, read } = commentTargets;
      for (const target of targets) {
        const publicKey = Object.keys(target.public)[0];
        const missing =
          typeof target.public[publicKey] === "number"
            ? 2147483647
            : `missing-${marker}`;
        const response = await read({
          targetType: target.type,
          [publicKey]: missing,
        });
        expect(response.status).toBe(404);
        expect(await response.json()).not.toHaveProperty("data");
      }
    }),
);

commentTargetTest(
  "comment.public-id-validation",
  { tags: ["@Comment/Service"] },
  async ({ commentTargets, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { targets, read, postCommentRoute, request, marker } =
        commentTargets;
      for (const target of targets.filter((t) =>
        ["section", "course"].includes(t.type),
      )) {
        const key = Object.keys(target.public)[0];
        for (const value of ["0", "-1", "1.5", "abc", "", "9007199254740992"]) {
          const params = {
            targetType: target.type,
            targetId: target.id,
            [key]: value,
          };
          expect((await read(params)).status, `${key}=${value}`).toBe(400);
          expect(
            (await postCommentRoute(request({ ...params, body: marker })))
              .status,
          ).toBe(400);
        }
      }
    }),
);

commentTargetTest(
  "comment.visibility-input",
  { tags: ["@Comment/Service"] },
  async ({ commentTargets, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const {
        targets,
        create,
        db,
        patchCommentRoute,
        request,
        marker,
        postCommentRoute,
      } = commentTargets;
      const target = targets[1];
      for (const visibility of ["public", "logged_in_only"])
        for (const isAnonymous of [true, false]) {
          const id = await create(target, { visibility, isAnonymous });
          expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
            visibility,
            isAnonymous,
          });
          const nextVisibility =
            visibility === "public" ? "logged_in_only" : "public";
          const updated = await patchCommentRoute(
            request(
              {
                body: marker,
                visibility: nextVisibility,
                isAnonymous: !isAnonymous,
              },
              "PATCH",
            ),
            { id },
          );
          expect(updated.status, await updated.clone().text()).toBe(200);
          expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
            visibility: nextVisibility,
            isAnonymous: !isAnonymous,
          });
          for (const invalid of ["anonymous", "private", "", null, 7]) {
            expect(
              (
                await postCommentRoute(
                  request({
                    targetType: target.type,
                    ...target.public,
                    body: marker,
                    visibility: invalid,
                  }),
                )
              ).status,
            ).toBe(400);
            expect(
              (
                await patchCommentRoute(
                  request(
                    { body: "must not persist", visibility: invalid },
                    "PATCH",
                  ),
                  { id },
                )
              ).status,
            ).toBe(400);
          }
          expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
            body: marker,
            visibility: nextVisibility,
            isAnonymous: !isAnonymous,
          });
        }
    }),
);

commentTargetTest(
  "comment.section-teacher-target-lifecycle",
  { tags: ["@Comment/Service"] },
  async ({ commentTargets, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { db, sectionId, teacherId, marker, postCommentRoute, request } =
        commentTargets;
      await db.sectionTeacher.deleteMany({ where: { sectionId, teacherId } });
      const pair = {
        targetType: "section-teacher",
        sectionId,
        teacherId,
        body: marker,
      };
      const response = await postCommentRoute(request(pair));
      expect(response.status, await response.clone().text()).toBe(201);
      const target = await db.sectionTeacher.findUniqueOrThrow({
        where: { sectionId_teacherId: { sectionId, teacherId } },
      });
      expect(target.retiredAt).toBeNull();
      await db.sectionTeacher.update({
        where: { id: target.id },
        data: { retiredAt: new Date() },
      });
      expect((await postCommentRoute(request(pair))).status).toBe(201);
      expect(
        await db.sectionTeacher.findUnique({ where: { id: target.id } }),
      ).toMatchObject({ retiredAt: null, sectionId, teacherId });
      await expect(
        runtimePrisma.sectionTeacher.update({
          where: { id: target.id },
          data: { sectionId },
        }),
      ).rejects.toThrow();
      await expect(
        runtimePrisma.sectionTeacher.delete({ where: { id: target.id } }),
      ).rejects.toThrow();
      await db.section.update({
        where: { id: sectionId },
        data: { teachers: { disconnect: { id: teacherId } } },
      });
      await db.sectionTeacher.update({
        where: { id: target.id },
        data: { retiredAt: new Date() },
      });
      expect((await postCommentRoute(request(pair))).status).toBe(404);
      expect(
        (
          await db.sectionTeacher.findUniqueOrThrow({
            where: { id: target.id },
          })
        ).retiredAt,
      ).not.toBeNull();
    }),
);
