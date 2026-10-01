import { homeworkTransportTest as contractTest } from "../../../shared/homework-transport-contract-fixture";

contractTest(
  "homework.oauth-write-gates",
  async ({ state, expect, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const {
        db,
        routes,
        communityWrite,
        completionWrite,
        sectionJwId,
        gqlDelete,
        gqlCreate,
        gqlUpdate,
        gqlComplete,
        gqlBatch,
        fixtureHomework,
        request,
        graphql,
        httpMcp,
        httpCall,
      } = state;
      const id = await fixtureHomework();
      const input = { sectionJwId, title: "Denied create" };
      const snapshot = async () => ({
        homeworks: await db.homework.findMany({ orderBy: { id: "asc" } }),
        completions: await db.homeworkCompletion.findMany({
          orderBy: [{ homeworkId: "asc" }, { userId: "asc" }],
        }),
        audits: await db.auditLog.findMany({ orderBy: { id: "asc" } }),
      });
      const before = await snapshot();

      for (const reject of [
        async () =>
          routes.postHomeworkRoute(
            await request("POST", input, [completionWrite]),
          ),
        async () =>
          routes.patchHomeworkRoute(
            await request("PATCH", { title: "Denied" }, [completionWrite]),
            { id },
          ),
        async () =>
          routes.deleteHomeworkRoute(
            await request("DELETE", undefined, [completionWrite]),
            { id },
          ),
        async () =>
          routes.putHomeworkCompletionRoute(
            await request("PUT", { completed: true }, [communityWrite]),
            { id },
          ),
        async () =>
          routes.putHomeworkCompletionsRoute(
            await request(
              "PUT",
              { items: [{ homeworkId: id, completed: true }] },
              [communityWrite],
            ),
          ),
      ]) {
        expect((await reject()).status).toBe(401);
        expect(await snapshot()).toEqual(before);
      }

      for (const [query, variables, wrongScope] of [
        [gqlCreate, { input }, completionWrite],
        [gqlUpdate, { id }, completionWrite],
        [gqlDelete, { id }, completionWrite],
        [gqlComplete, { id }, communityWrite],
        [gqlBatch, { id }, communityWrite],
      ] as const) {
        const denied = await graphql(query, variables, [wrongScope]);
        expect(denied.errors).toHaveLength(1);
        expect(denied.data).toBeNull();
        expect(await snapshot()).toEqual(before);
      }

      const onlyCompletion = await httpMcp(completionWrite);
      for (const [tool, args] of [
        ["community_section_homework_create", input],
        [
          "community_section_homework_update",
          { homeworkId: id, title: "Denied" },
        ],
        ["community_section_homework_delete", { homeworkId: id }],
      ] as const) {
        await expect(httpCall(onlyCompletion, tool, args)).rejects.toThrow();
        expect(await snapshot()).toEqual(before);
      }
      const onlyCommunity = await httpMcp(communityWrite);
      await expect(
        httpCall(onlyCommunity, "workspace_homework_completion_set", {
          homeworkId: id,
          completed: true,
        }),
      ).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    });
  },
);

for (const transport of ["rest", "graphql", "mcp"] as const) {
  for (const operation of [
    "create",
    "update",
    "delete",
    "complete",
    "clear",
  ] as const) {
    contractTest(
      `homework OAuth ${operation} through ${transport} accepts only its required scope`,
      async ({ state, expect, protocolRuntime }) => {
        await protocolRuntime.run(async () => {
          const {
            db,
            userId,
            sectionId,
            sectionJwId,
            routes,
            fixtureHomework,
            communityWrite,
            completionWrite,
            request,
            graphql,
            httpMcp,
            httpCall,
            gqlCreate,
            gqlUpdate,
            gqlDelete,
            gqlComplete,
            gqlBatch,
          } = state;
          // Create uses this row as an unchanged witness; all other operations own their target.
          const id = await fixtureHomework();
          if (operation === "clear") {
            await db.homeworkCompletion.create({
              data: { userId, homeworkId: id },
            });
          }
          const before = await db.homework.findUniqueOrThrow({ where: { id } });
          const input = { sectionJwId, title: "Created with community scope" };
          const scope =
            operation === "complete" || operation === "clear"
              ? completionWrite
              : communityWrite;
          let createdId: unknown;

          if (transport === "rest") {
            const actions = {
              create: async () =>
                routes.postHomeworkRoute(await request("POST", input, [scope])),
              update: async () =>
                routes.patchHomeworkRoute(
                  await request(
                    "PATCH",
                    { title: "Updated through transport" },
                    [scope],
                  ),
                  { id },
                ),
              delete: async () =>
                routes.deleteHomeworkRoute(
                  await request("DELETE", undefined, [scope]),
                  { id },
                ),
              complete: async () =>
                routes.putHomeworkCompletionRoute(
                  await request("PUT", { completed: true }, [scope]),
                  { id },
                ),
              clear: async () =>
                routes.putHomeworkCompletionsRoute(
                  await request(
                    "PUT",
                    { items: [{ homeworkId: id, completed: false }] },
                    [scope],
                  ),
                ),
            };
            const response = await actions[operation]();
            expect(response.status).toBe(operation === "create" ? 201 : 200);
            const body = await response.json();
            if (operation === "create") createdId = body.id;
            else if (operation === "update")
              expect(body).toMatchObject({
                success: true,
                homework: { id, title: "Updated through transport" },
              });
            else if (operation === "delete")
              expect(body).toEqual({ success: true });
            else if (operation === "complete")
              expect(body).toMatchObject({ completed: true });
            else
              expect(body).toMatchObject({
                results: [{ success: true, homeworkId: id, completed: false }],
              });
          } else if (transport === "graphql") {
            const actions = {
              create: [gqlCreate, { input }],
              update: [gqlUpdate, { id }],
              delete: [gqlDelete, { id }],
              complete: [gqlComplete, { id }],
              clear: [gqlBatch, { id }],
            } as const;
            const [query, variables] = actions[operation];
            const allowed = await graphql(query, variables, [scope]);
            expect(allowed.errors).toBeUndefined();
            const fields = {
              create: "homeworkCreate",
              update: "homeworkUpdate",
              delete: "homeworkDelete",
              complete: "homeworkCompletionSet",
              clear: "homeworkCompletionsSet",
            } as const;
            const body = allowed.data[fields[operation]];
            if (operation === "create") createdId = body.id;
            else if (operation === "update") expect(body).toEqual({ id });
            else if (operation === "delete")
              expect(body).toEqual({ success: true, id });
            else if (operation === "complete")
              expect(body).toEqual({ completed: true });
            else
              expect(body).toEqual({
                results: [{ success: true, completed: false }],
              });
          } else {
            const actions = {
              create: ["community_section_homework_create", input],
              update: [
                "community_section_homework_update",
                { homeworkId: id, title: "Updated through transport" },
              ],
              delete: ["community_section_homework_delete", { homeworkId: id }],
              complete: [
                "workspace_homework_completion_set",
                { homeworkId: id, completed: true },
              ],
              clear: [
                "workspace_homework_completion_set",
                { homeworkId: id, completed: false },
              ],
            } as const;
            const [tool, args] = actions[operation];
            const client = await httpMcp(scope);
            const body = await httpCall(client, tool, args);
            expect(body).toMatchObject({ success: true });
            if (operation === "create") createdId = body.id;
            else if (operation === "update")
              expect(body).toMatchObject({
                homework: { id, title: "Updated through transport" },
              });
            else if (operation === "delete")
              expect(body).toMatchObject({ deletedId: id });
            else if (operation === "complete" || operation === "clear")
              expect(body).toMatchObject({
                completion: { completed: operation === "complete" },
              });
          }

          const stored = await db.homework.findUniqueOrThrow({ where: { id } });
          if (operation === "create") {
            const created = await db.homework.findMany({
              where: { sectionId, id: { not: id } },
            });
            expect(createdId).toEqual(expect.any(String));
            expect(created).toEqual([
              expect.objectContaining({
                id: createdId,
                title: input.title,
                sectionId,
                createdById: userId,
                deletedAt: null,
              }),
            ]);
            expect(stored).toEqual(before);
          } else if (operation === "update") {
            expect(stored).toEqual({
              ...before,
              title: "Updated through transport",
              updatedById: userId,
              updatedAt: expect.any(Date),
            });
          } else if (operation === "delete") {
            expect(stored).toEqual({
              ...before,
              deletedAt: expect.any(Date),
              deletedById: userId,
              updatedById: userId,
              updatedAt: expect.any(Date),
            });
          } else {
            expect(stored).toEqual(before);
          }
          expect(await db.homework.count({ where: { sectionId } })).toBe(
            operation === "create" ? 2 : 1,
          );
          expect(
            await db.homeworkCompletion.findMany({ where: { homeworkId: id } }),
          ).toEqual(
            operation === "complete"
              ? [
                  expect.objectContaining({
                    userId,
                    homeworkId: id,
                    completedAt: expect.any(Date),
                  }),
                ]
              : [],
          );
        });
      },
    );
  }
}
