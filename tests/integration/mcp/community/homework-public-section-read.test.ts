import { getHomeworkDetailRoute } from "@/lib/api/routes/homework-detail-read-route";
import { getHomeworksRoute } from "@/lib/api/routes/homework-list-read-route";
import { handleMcpRequest } from "@/lib/api/routes/mcp-request-handler";
import { getOAuthMcpResourceUrl } from "@/lib/mcp/urls";
import { ownProtocolRoute } from "../../../shared/mcp-protocol-fixture";
import { nodeProtocolTest as contractTest } from "../../../shared/node-protocol-fixture";

contractTest(
  "homework.public-section-read",
  async ({ isolatedDatabase: { owner: db }, expect, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const userId = crypto.randomUUID();
      const sectionJwId = 1;
      const title = "Public homework";
      const { homework, completion } = await db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            name: "Completion owner",
            email: `${userId}@test.invalid`,
          },
        });
        const section = await tx.section.create({
          data: {
            jwId: sectionJwId,
            code: "PUBLIC-HOMEWORK.01",
            course: {
              create: {
                jwId: 1,
                code: "PUBLIC-HOMEWORK",
                nameCn: "Public homework course",
              },
            },
          },
        });
        const homework = await tx.homework.create({
          data: {
            sectionId: section.id,
            title,
            createdById: userId,
            description: { create: { content: "Public assignment details" } },
          },
        });
        const completion = await tx.homeworkCompletion.create({
          data: { userId, homeworkId: homework.id },
        });
        return { homework, completion };
      });
      const publicId = homework.id;

      const response = await ownProtocolRoute(
        protocolRuntime,
        getHomeworksRoute,
      )(
        new Request(
          `https://example.test/api/community/section-homeworks?sectionJwId=${sectionJwId}`,
        ),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toMatchObject([
        { id: publicId, title, completion: null },
      ]);
      const detail = await ownProtocolRoute(
        protocolRuntime,
        getHomeworkDetailRoute,
      )(
        new Request(
          `https://example.test/api/community/section-homeworks/${publicId}`,
        ),
        { id: publicId },
      );
      expect(detail.status).toBe(200);
      expect(await detail.json()).toMatchObject({
        homework: {
          id: publicId,
          title,
          completion: null,
          description: { content: "Public assignment details" },
        },
      });
      const denied = await ownProtocolRoute(
        protocolRuntime,
        handleMcpRequest,
      )(
        new Request(getOAuthMcpResourceUrl(), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "community_section_homework_list",
              arguments: { sectionJwId, mode: "full" },
            },
          }),
        }),
      );
      expect(denied.status).toBe(401);
      expect(
        await db.homeworkCompletion.findMany({
          where: { homeworkId: publicId },
        }),
      ).toEqual([completion]);
    });
  },
);
