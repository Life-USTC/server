import { describe, vi } from "vitest";
import { getRoomMapRoute } from "@/lib/api/routes/room-map-route";
import { createGraphqlYoga } from "@/lib/graphql/server";
import { cleanupMcpResources } from "../_harness/cleanup";
import { createAnonymousMcpHarness, type McpHarness } from "../_harness/client";
import { mcpTest } from "../_harness/context";

const contractTest = mcpTest
  .extend(
    "transportRuntime",
    { scope: "file", auto: true },
    ({ mcpConnections: _connections }, { onCleanup }) => {
      onCleanup(async () => {
        vi.unstubAllGlobals();
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url.endsWith("/room_maps.json"))
            return Response.json({
              rooms: [
                {
                  code: "3A204",
                  building: "第三教学楼",
                  floor: "2",
                  imagePath: "imgs/rooms/3A204.png",
                  sourceImagePath: "imgs/三教主_02.png",
                },
              ],
            });
          if (url.endsWith("/building_img_rules.json"))
            return Response.json([
              { regex: "3[AB]2\\d{2}", path: "./imgs/三教主_02.png" },
            ]);
          throw new Error(`Unexpected static request: ${url}`);
        }),
      );
      return true;
    },
  )
  .extend("state", async ({ mcpConnections: _connections }, { onCleanup }) => {
    let client: McpHarness;
    async function graphql({
      source,
      variableValues,
    }: {
      source: string;
      variableValues?: Record<string, string>;
    }) {
      const response = await createGraphqlYoga(false).fetch(
        "https://example.test/api/graphql",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: source, variables: variableValues }),
        },
        { locals: { locale: "zh-cn" }, principal: { kind: "anonymous" } },
      );
      return response.json();
    }
    onCleanup(async () => {
      await cleanupMcpResources([
        async () => {
          await client?.close();
        },
      ]);
    });
    client = await createAnonymousMcpHarness();

    return { client, graphql };
  });

describe("public room map transport parity", () => {
  contractTest("room-map.public", async ({ state, expect }) => {
    const { client, graphql } = state;

    for (const code of ["3A204", "3A299", "UNKNOWN", " ３ａ２０４ "]) {
      const response = await getRoomMapRoute(
        new Request("https://example.test/api/catalog/rooms/map"),
        { code },
      );
      expect(response.status).toBe(200);
      const rest = await response.json();
      expect(Object.keys(rest).sort()).toEqual([
        "building",
        "code",
        "floor",
        "imageUrl",
        "sourceImageUrl",
        "status",
      ]);
      const result = await graphql({
        source:
          "query($code: String!) { catalog { roomMap(code: $code) { code building floor status imageUrl sourceImageUrl } } }",
        variableValues: { code },
      });
      expect(result.errors).toBeUndefined();
      expect(result.data?.catalog).toEqual({ roomMap: rest });
      for (const mode of ["default", "full"]) {
        const mcp = await client.callTool("catalog_rooms_map", { code, mode });
        expect(mcp).toEqual({ ...rest, success: true });
      }
    }
  });
  contractTest("openapi.room-maps", async ({ state, expect }) => {
    const { client, graphql } = state;

    const response = await getRoomMapRoute(
      new Request("https://example.test/"),
      { code: "../invalid" },
    );
    expect(response.status).toBe(400);
    const result = await graphql({
      source: '{ catalog { roomMap(code: "../invalid") { code } } }',
    });
    expect(result.errors?.[0].extensions.code).toBe("BAD_USER_INPUT");
    expect(
      (await client.callToolResult("catalog_rooms_map", { code: "../invalid" }))
        .isError,
    ).toBe(true);
  });
});
