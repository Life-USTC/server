import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, expect, it, vi } from "vitest";
import * as z from "zod";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { runWithObservability } from "@/lib/db/observability-context";
import {
  classifyMcpFeatureResult,
  observeMcpFeature,
} from "@/lib/mcp/feature-observability";
import { installMcpToolDescriptorDefaults } from "@/lib/mcp/tool-descriptors";

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));
const { writeObservabilityBatchMock } = vi.hoisted(() => ({
  writeObservabilityBatchMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/db/feature-event-store", () => ({
  writeObservabilityBatch: writeObservabilityBatchMock,
}));

function featureEvents() {
  return writeObservabilityBatchMock.mock.calls.flatMap(
    ([batch]) => batch.features ?? [],
  );
}

async function flushObservability() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  writeObservabilityBatchMock.mockReset().mockResolvedValue(undefined);
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
    await runWithCloudflareRuntimeEnv({}, async () => {
      await runWithObservability(async () => {
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
      });
    });
    await flushObservability();
    const events = featureEvents();
    expect(events).toHaveLength(3);
    expect(
      events.find((row) => row.feature === "catalog.course"),
    ).toMatchObject({
      feature: "catalog.course",
      operation: "search",
      protocol: "mcp",
      surface: "mcp",
      authMode: "anonymous",
      outcome: "success",
      errorClass: "none",
    });
    expect(
      events.find((row) => row.feature === "catalog.section"),
    ).toMatchObject({
      feature: "catalog.section",
      operation: "get",
      outcome: "error",
      errorClass: "dependency",
    });
    expect(
      events.find((row) => row.feature === "catalog.teacher"),
    ).toMatchObject({
      feature: "catalog.teacher",
      operation: "get",
      outcome: "error",
      errorClass: "internal",
    });
    expect(JSON.stringify(events)).not.toContain("private");
  } finally {
    await client.close();
    await server.close();
  }
});

it("does not double count the GraphQL envelope or listTools and uses authenticated SDK context", async () => {
  await runWithCloudflareRuntimeEnv({}, async () => {
    await runWithObservability(async () => {
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
    });
  });
  await flushObservability();
  expect(featureEvents()).toHaveLength(1);
  expect(featureEvents()[0]).toMatchObject({
    feature: "catalog.course",
    operation: "list",
    protocol: "mcp",
    surface: "mcp",
    authMode: "oauth",
  });
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
