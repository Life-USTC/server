import { homeworkTransportTest as contractTest } from "../../../shared/homework-transport-contract-fixture";

contractTest(
  "homework.oauth-write-gates",
  async ({ state, expect, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const {
        db,
        routes: {
          postHomeworkRoute,
          patchHomeworkRoute,
          deleteHomeworkRoute,
          putHomeworkCompletionRoute,
          putHomeworkCompletionsRoute,
        },
      } = state;

      const {
        users,
        communityWrite,
        completionWrite,
        onlyCommunity,
        onlyCompletion,
        sectionId,
        sectionJwId,
        gqlDelete,
        gqlCreate,
        gqlUpdate,
        gqlComplete,
        gqlBatch,
        fixtureHomework,
        request,
        graphql,
        httpCall,
      } = state;

      for (const transport of ["rest", "graphql", "mcp"] as const) {
        const id = await fixtureHomework();
        const input = { sectionJwId, title: `Scope-gated ${transport}` };
        const before = await db.homework.count({ where: { sectionId } });
        const rowBefore = await db.homework.findUniqueOrThrow({
          where: { id },
        });
        if (transport === "rest") {
          expect(
            (
              await postHomeworkRoute(
                await request(0, "POST", input, [completionWrite]),
              )
            ).status,
          ).toBe(401);
          expect(
            (
              await patchHomeworkRoute(
                await request(0, "PATCH", { title: "Denied" }, [
                  completionWrite,
                ]),
                { id },
              )
            ).status,
          ).toBe(401);
          expect(
            (
              await deleteHomeworkRoute(
                await request(0, "DELETE", undefined, [completionWrite]),
                { id },
              )
            ).status,
          ).toBe(401);
          expect(
            (
              await putHomeworkCompletionRoute(
                await request(0, "PUT", { completed: true }, [communityWrite]),
                { id },
              )
            ).status,
          ).toBe(401);
          expect(
            (
              await putHomeworkCompletionsRoute(
                await request(
                  0,
                  "PUT",
                  { items: [{ homeworkId: id, completed: true }] },
                  [communityWrite],
                ),
              )
            ).status,
          ).toBe(401);
        } else if (transport === "graphql") {
          for (const [query, variables, wrongScope] of [
            [gqlCreate, { input }, completionWrite],
            [gqlUpdate, { id }, completionWrite],
            [gqlDelete, { id }, completionWrite],
            [gqlComplete, { id }, communityWrite],
            [gqlBatch, { id }, communityWrite],
          ] as const) {
            const denied = await graphql(0, query, variables, [wrongScope]);
            expect(denied.errors).toHaveLength(1);
            expect(denied.data).toBeNull();
          }
        } else {
          for (const [tool, args] of [
            ["community_section_homework_create", input],
            [
              "community_section_homework_update",
              { homeworkId: id, title: "Denied" },
            ],
            ["community_section_homework_delete", { homeworkId: id }],
          ] as const)
            await expect(
              httpCall(onlyCompletion, tool, args),
            ).rejects.toThrow();
          await expect(
            httpCall(onlyCommunity, "workspace_homework_completion_set", {
              homeworkId: id,
              completed: true,
            }),
          ).rejects.toThrow();
        }
        expect(await db.homework.count({ where: { sectionId } })).toBe(before);
        expect(await db.homework.findUniqueOrThrow({ where: { id } })).toEqual(
          rowBefore,
        );
        expect(
          await db.homeworkCompletion.count({ where: { homeworkId: id } }),
        ).toBe(0);
        if (transport === "rest") {
          expect(
            (
              await postHomeworkRoute(
                await request(0, "POST", input, [communityWrite]),
              )
            ).status,
          ).toBe(201);
          expect(
            (
              await patchHomeworkRoute(
                await request(
                  0,
                  "PATCH",
                  { title: "Updated through transport" },
                  [communityWrite],
                ),
                { id },
              )
            ).status,
          ).toBe(200);
          expect(
            (
              await putHomeworkCompletionRoute(
                await request(0, "PUT", { completed: true }, [completionWrite]),
                { id },
              )
            ).status,
          ).toBe(200);
          expect(
            await db.homeworkCompletion.count({ where: { homeworkId: id } }),
          ).toBe(1);
          expect(
            (
              await putHomeworkCompletionsRoute(
                await request(
                  0,
                  "PUT",
                  { items: [{ homeworkId: id, completed: false }] },
                  [completionWrite],
                ),
              )
            ).status,
          ).toBe(200);
          expect(
            (
              await deleteHomeworkRoute(
                await request(0, "DELETE", undefined, [communityWrite]),
                { id },
              )
            ).status,
          ).toBe(200);
        } else if (transport === "graphql") {
          for (const [query, variables, scope] of [
            [gqlCreate, { input }, communityWrite],
            [gqlUpdate, { id }, communityWrite],
            [gqlComplete, { id }, completionWrite],
            [gqlBatch, { id }, completionWrite],
            [gqlDelete, { id }, communityWrite],
          ] as const) {
            const allowed = await graphql(0, query, variables, [scope]);
            expect(allowed.errors).toBeUndefined();
            expect(allowed.data).not.toBeNull();
            if (query === gqlComplete)
              expect(
                await db.homeworkCompletion.count({
                  where: { homeworkId: id },
                }),
              ).toBe(1);
          }
        } else {
          expect(
            await httpCall(
              onlyCommunity,
              "community_section_homework_create",
              input,
            ),
          ).toHaveProperty("id");
          expect(
            await httpCall(onlyCommunity, "community_section_homework_update", {
              homeworkId: id,
              title: "Updated through transport",
            }),
          ).toMatchObject({ success: true });
          expect(
            await httpCall(
              onlyCompletion,
              "workspace_homework_completion_set",
              {
                homeworkId: id,
                completed: true,
              },
            ),
          ).toMatchObject({ success: true, completion: { completed: true } });
          expect(
            await db.homeworkCompletion.count({ where: { homeworkId: id } }),
          ).toBe(1);
          expect(
            await httpCall(
              onlyCompletion,
              "workspace_homework_completion_set",
              {
                homeworkId: id,
                completed: false,
              },
            ),
          ).toMatchObject({ success: true, completion: { completed: false } });
          expect(
            await httpCall(onlyCommunity, "community_section_homework_delete", {
              homeworkId: id,
            }),
          ).toMatchObject({ success: true });
        }
        expect(await db.homework.count({ where: { sectionId } })).toBe(
          before + 1,
        );
        expect(
          await db.homework.findUniqueOrThrow({ where: { id } }),
        ).toMatchObject({
          title: "Updated through transport",
          deletedById: users[0],
          deletedAt: expect.any(Date),
        });
        expect(
          await db.homeworkCompletion.count({ where: { homeworkId: id } }),
        ).toBe(0);
      }
    });
  },
);
