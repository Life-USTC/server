import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, expect, it, vi } from "vitest";
import * as z from "zod";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  classifyMcpFeatureResult,
  observeMcpFeature,
} from "@/lib/mcp/feature-observability";
import { installMcpToolDescriptorDefaults } from "@/lib/mcp/tool-descriptors";

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));
const writeDataPoint = vi.fn();
beforeEach(() => {
  writeDataPoint.mockReset();
});

it("records actual SDK tool callbacks separately, including public reads and output failures", async () => {
  const server = new McpServer({ name: "test", version: "1" });
  installMcpToolDescriptorDefaults(server);
  const outputSchema = z.object({ success: z.boolean() });
  server.registerTool(
    "catalog_course_search",
    { inputSchema: { search: z.string().optional() }, outputSchema },
    async () => ({ content: [], structuredContent: { success: true } }),
  );
  server.registerTool(
    "catalog_section_get",
    { inputSchema: { jwId: z.number() }, outputSchema },
    async () => {
      throw Object.assign(new Error("private failure"), { status: 503 });
    },
  );
  server.registerTool(
    "catalog_teacher_get",
    { inputSchema: { jwId: z.number() }, outputSchema },
    async () => ({ content: [], structuredContent: { success: "invalid" } }),
  );
  const client = new Client({ name: "test", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    await runWithCloudflareRuntimeEnv(
      { ANALYTICS: { writeDataPoint } },
      async () => {
        const results = await Promise.all([
          client.callTool({
            name: "catalog_course_search",
            arguments: { search: "private input" },
          }),
          client.callTool({
            name: "catalog_section_get",
            arguments: { jwId: 1 },
          }),
          client.callTool({
            name: "catalog_teacher_get",
            arguments: { jwId: 1 },
          }),
        ]);
        expect(results[0].isError).not.toBe(true);
        expect(results[1].isError).toBe(true);
        expect(results[2].isError).toBe(true);
      },
    );
    const events = writeDataPoint.mock.calls.map(([point]) => point.blobs);
    expect(events).toHaveLength(3);
    expect(
      events.find((row) => row[1] === "catalog.course")?.slice(2, 8),
    ).toEqual(["search", "mcp", "mcp", "anonymous", "success", "none"]);
    expect(
      events.find((row) => row[1] === "catalog.section")?.slice(6, 8),
    ).toEqual(["error", "dependency"]);
    expect(
      events.find((row) => row[1] === "catalog.teacher")?.slice(6, 8),
    ).toEqual(["error", "internal"]);
    expect(JSON.stringify(events)).not.toContain("private");
  } finally {
    await client.close();
    await server.close();
  }
});

it("does not double count the GraphQL envelope or listTools and uses authenticated SDK context", async () => {
  await runWithCloudflareRuntimeEnv(
    { ANALYTICS: { writeDataPoint } },
    async () => {
      await observeMcpFeature("graphql_operation_run", {}, {}, () => ({
        content: [],
      }));
      await observeMcpFeature("tools/list", {}, {}, () => ({}));
      await observeMcpFeature(
        "catalog_course_search",
        {},
        { authInfo: { token: "private" } },
        () => ({ structuredContent: { success: true } }),
      );
    },
  );
  expect(writeDataPoint).toHaveBeenCalledTimes(1);
  expect(writeDataPoint.mock.calls[0][0].blobs.slice(2, 6)).toEqual([
    "list",
    "mcp",
    "mcp",
    "oauth",
  ]);
});

it.each([
  [{ isError: true }, "unknown", "unknown"],
  [{ structuredContent: { success: false } }, "unknown", "unknown"],
  [{ structuredContent: { found: false } }, "rejected", "not_found"],
  [{ structuredContent: { unmatchedCodes: ["secret"] } }, "unknown", "unknown"],
  [{ content: [] }, "unknown", "unknown"],
])(
  "classifies only known structured outcomes",
  (value, outcome, errorClass) => {
    expect(classifyMcpFeatureResult(value)).toEqual({ outcome, errorClass });
  },
);
