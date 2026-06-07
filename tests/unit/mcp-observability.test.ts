import { afterEach, describe, expect, it } from "vitest";
import {
  recordMcpToolResultMetrics,
  summarizeMcpJsonRpcRequest,
} from "@/lib/mcp/observability";
import {
  renderPrometheusMetrics,
  resetRuntimeMetricsForTest,
} from "@/lib/metrics/runtime-metrics";

describe("MCP observability", () => {
  afterEach(() => {
    resetRuntimeMetricsForTest();
  });

  it("summarizes initialize requests without sensitive values", async () => {
    const request = new Request("https://example.test/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          clientInfo: { name: "ChatGPT", version: "1.0" },
        },
      }),
    });

    await expect(summarizeMcpJsonRpcRequest(request)).resolves.toEqual({
      bodyKind: "jsonrpc-single",
      rpcCount: 1,
      methods: ["initialize"],
      toolNames: [],
      toolCalls: [],
      argumentKeys: [],
      clientInfo: { name: "ChatGPT", version: "1.0" },
      protocolVersion: "2025-06-18",
    });
  });

  it("records tool call names and argument keys, not argument values", async () => {
    const request = new Request("https://example.test/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "create_my_todo",
          arguments: {
            title: "private title",
            dueAt: "2026-06-07T10:00:00+08:00",
          },
        },
      }),
    });

    const summary = await summarizeMcpJsonRpcRequest(request);

    expect(summary).toMatchObject({
      bodyKind: "jsonrpc-single",
      rpcCount: 1,
      methods: ["tools/call"],
      toolNames: ["create_my_todo"],
      toolCalls: [
        { toolName: "create_my_todo", argumentKeys: ["dueAt", "title"] },
      ],
      argumentKeys: ["dueAt", "title"],
    });
    expect(JSON.stringify(summary)).not.toContain("private title");
  });

  it("summarizes JSON-RPC batches", async () => {
    const request = new Request("https://example.test/api/mcp", {
      method: "POST",
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "get_my_profile", arguments: {} },
        },
      ]),
    });

    await expect(summarizeMcpJsonRpcRequest(request)).resolves.toMatchObject({
      bodyKind: "jsonrpc-batch",
      rpcCount: 2,
      methods: ["tools/list", "tools/call"],
      toolNames: ["get_my_profile"],
      toolCalls: [{ toolName: "get_my_profile", argumentKeys: [] }],
    });
  });

  it("does not parse oversized bodies for observability", async () => {
    const request = new Request("https://example.test/api/mcp", {
      method: "POST",
      headers: { "content-length": String(65 * 1024) },
      body: JSON.stringify({ method: "tools/list" }),
    });

    await expect(summarizeMcpJsonRpcRequest(request)).resolves.toMatchObject({
      bodyKind: "body-too-large",
      rpcCount: 0,
    });
  });

  it("records tool result status and duration metrics", async () => {
    const summary = await summarizeMcpJsonRpcRequest(
      new Request("https://example.test/api/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "get_my_profile", arguments: {} },
        }),
      }),
    );

    recordMcpToolResultMetrics(summary, new Set(["get_my_profile"]), {
      durationMs: 25,
      status: 200,
    });

    const metrics = renderPrometheusMetrics();
    expect(metrics).toContain(
      'life_ustc_mcp_tool_call_results_total{status="success",tool="get_my_profile"} 1',
    );
    expect(metrics).toContain(
      'life_ustc_mcp_tool_call_duration_ms_sum{tool="get_my_profile"} 25',
    );
  });
});
