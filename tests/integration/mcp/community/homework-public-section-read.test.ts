import { getOAuthMcpResourceUrl } from "@/lib/mcp/urls";
import { homeworkTransportTest as contractTest } from "../../../shared/homework-transport-contract-fixture";

contractTest(
  "homework.public-section-read",
  async ({ state, expect, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const {
        db,
        routes: { getHomeworksRoute, getHomeworkDetailRoute, handleMcpRequest },
      } = state;

      const { sectionJwId, publicId, title } = state;

      const response = await getHomeworksRoute(
        new Request(
          `https://example.test/api/community/section-homeworks?sectionJwId=${sectionJwId}`,
        ),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toMatchObject([
        { id: publicId, title, completion: null },
      ]);
      const detail = await getHomeworkDetailRoute(
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
      const denied = await handleMcpRequest(
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
        await db.homeworkCompletion.count({ where: { homeworkId: publicId } }),
      ).toBe(1);
    });
  },
);
