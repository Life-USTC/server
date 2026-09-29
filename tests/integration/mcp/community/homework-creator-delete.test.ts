import { homeworkTransportTest as contractTest } from "../../../shared/homework-transport-contract-fixture";

contractTest(
  "homework.transport-creator-delete",
  async ({ state, expect, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const {
        db,
        routes: { deleteHomeworkRoute },
      } = state;

      const { users, clients, gqlDelete, fixtureHomework, request, graphql } =
        state;

      for (const transport of ["rest", "graphql", "mcp"] as const) {
        const id = await fixtureHomework();
        for (const foreign of [1, 2]) {
          if (transport === "rest")
            expect(
              (
                await deleteHomeworkRoute(await request(foreign, "DELETE"), {
                  id,
                })
              ).status,
            ).toBe(403);
          else if (transport === "graphql")
            expect(
              (await graphql(foreign, gqlDelete, { id })).errors[0].extensions
                .code,
            ).toBe("FORBIDDEN");
          else
            expect(
              await clients[foreign].call("community_section_homework_delete", {
                homeworkId: id,
              }),
            ).toMatchObject({ success: false, error: "forbidden" });
          expect(
            (await db.homework.findUniqueOrThrow({ where: { id } })).deletedAt,
          ).toBeNull();
        }
        if (transport === "rest")
          expect(
            (await deleteHomeworkRoute(await request(0, "DELETE"), { id }))
              .status,
          ).toBe(200);
        else if (transport === "graphql")
          expect(await graphql(0, gqlDelete, { id })).toMatchObject({
            data: { homeworkDelete: { success: true, id } },
          });
        else
          expect(
            await clients[0].call("community_section_homework_delete", {
              homeworkId: id,
            }),
          ).toMatchObject({ success: true, deletedId: id });
        expect(
          await db.homework.findUniqueOrThrow({ where: { id } }),
        ).toMatchObject({ deletedById: users[0], deletedAt: expect.any(Date) });
      }
    });
  },
);
