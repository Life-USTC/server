import { describe, vi } from "vitest";
import { getRoomMapRoute } from "@/lib/api/routes/room-map-route";
import { createGraphqlYoga } from "@/lib/graphql/server";
import { anonymousMcpTest } from "../_harness/anonymous-context";

const contractTest = anonymousMcpTest
  .extend(
    "transportRuntime",
    { scope: "file", auto: true },
    // biome-ignore lint/correctness/noEmptyPattern: Vitest parses fixture dependencies.
    ({}, { onCleanup }) => {
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
  .extend("state", async ({ signal, anonymousSession, protocolRuntime }) => {
    const setupResult = await protocolRuntime.run(async () => {
      async function graphql({
        source,
        variableValues,
      }: {
        source: string;
        variableValues?: Record<string, string>;
      }) {
        const response = await protocolRuntime.request(() =>
          createGraphqlYoga(false).fetch(
            "https://example.test/api/graphql",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                query: source,
                variables: variableValues,
              }),
            },
            { locals: { locale: "zh-cn" }, principal: { kind: "anonymous" } },
          ),
        );
        return response.json();
      }
      await anonymousSession.initialize();
      return {
        client: anonymousSession.client,
        graphql,
        request: protocolRuntime.request,
      };
    });
    signal.throwIfAborted();
    return setupResult;
  });

describe("public room map entry contracts", () => {
  const sourceImageUrl =
    "https://static.life-ustc.tiankaima.dev/imgs/三教主_02.png";
  const highlighted = {
    code: "3A204",
    building: "第三教学楼",
    floor: "2",
    status: "highlighted",
    imageUrl: "https://static.life-ustc.tiankaima.dev/imgs/rooms/3A204.png",
    sourceImageUrl,
  };
  const examples = [
    { code: "3A204", expected: highlighted },
    {
      code: "3A299",
      expected: {
        code: "3A299",
        building: null,
        floor: null,
        status: "overview",
        imageUrl: sourceImageUrl,
        sourceImageUrl,
      },
    },
    {
      code: "UNKNOWN",
      expected: {
        code: "UNKNOWN",
        building: null,
        floor: null,
        status: "unavailable",
        imageUrl: null,
        sourceImageUrl: null,
      },
    },
    { code: " ３ａ２０４ ", expected: highlighted },
  ];
  for (const method of ["REST", "GraphQL", "MCP"] as const) {
    contractTest(
      `room-map.public / ${method}`,
      { tags: [`@Catalog/${method}`] },
      async ({ protocolRuntime, state, expect }) =>
        protocolRuntime.run(async () => {
          const { client, graphql, request } = state;
          for (const { code, expected } of examples) {
            if (method === "REST") {
              const response = await request(() =>
                getRoomMapRoute(
                  new Request("https://example.test/api/catalog/rooms/map"),
                  { code },
                ),
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
              expect(rest).toEqual(expected);
            } else if (method === "GraphQL") {
              const result = await graphql({
                source:
                  "query($code: String!) { catalog { roomMap(code: $code) { code building floor status imageUrl sourceImageUrl } } }",
                variableValues: { code },
              });
              expect(result.errors).toBeUndefined();
              expect(result.data?.catalog).toEqual({ roomMap: expected });
            } else {
              for (const mode of ["default", "full"]) {
                const mcp = await client.callTool("catalog_rooms_map", {
                  code,
                  mode,
                });
                expect(mcp).toEqual({ ...expected, success: true });
              }
            }
          }
        }),
    );
    contractTest(
      `openapi.room-maps / ${method}`,
      { tags: [`@Catalog/${method}`] },
      async ({ protocolRuntime, state, expect }) =>
        protocolRuntime.run(async () => {
          const { client, graphql, request } = state;
          if (method === "REST") {
            const response = await request(() =>
              getRoomMapRoute(new Request("https://example.test/"), {
                code: "../invalid",
              }),
            );
            expect(response.status).toBe(400);
          } else if (method === "GraphQL") {
            const result = await graphql({
              source: '{ catalog { roomMap(code: "../invalid") { code } } }',
            });
            expect(result.errors?.[0].extensions.code).toBe("BAD_USER_INPUT");
          } else {
            expect(
              (
                await client.callToolResult("catalog_rooms_map", {
                  code: "../invalid",
                })
              ).isError,
            ).toBe(true);
          }
        }),
    );
  }
});
