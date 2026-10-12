import { describe, expect, it } from "vitest";
import {
  MCP_JSON_RPC_BATCH_LIMIT,
  MCP_REQUEST_BODY_LIMIT_BYTES,
  readMcpJsonBodyWithinLimit,
} from "@/lib/mcp/request-body";

function post(body: string, headers: HeadersInit = {}) {
  return new Request("https://life.example/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

describe("bounded MCP request bodies", () => {
  it("parses a valid JSON body once within the limit", async () => {
    const result = await readMcpJsonBodyWithinLimit(
      post(JSON.stringify({ jsonrpc: "2.0", method: "tools/list" })),
    );

    expect(result).toEqual({
      body: { jsonrpc: "2.0", method: "tools/list" },
    });
  });

  it("rejects a declared oversized body before reading it", async () => {
    const result = await readMcpJsonBodyWithinLimit(
      post("{}", {
        "content-length": String(MCP_REQUEST_BODY_LIMIT_BYTES + 1),
      }),
    );

    expect("response" in result && result.response.status).toBe(413);
  });

  it("rejects a streamed oversized body without content-length", async () => {
    const result = await readMcpJsonBodyWithinLimit(
      post(`"${"x".repeat(MCP_REQUEST_BODY_LIMIT_BYTES)}"`),
    );

    expect("response" in result && result.response.status).toBe(413);
  });

  it("returns the SDK-compatible parse error shape for invalid JSON", async () => {
    const result = await readMcpJsonBodyWithinLimit(post("{"));

    expect("response" in result && result.response.status).toBe(400);
    if ("response" in result) {
      await expect(result.response.json()).resolves.toMatchObject({
        error: { code: -32700, message: "Parse error: Invalid JSON" },
        id: null,
        jsonrpc: "2.0",
      });
    }
  });

  it("rejects an empty JSON-RPC batch as an invalid request", async () => {
    const result = await readMcpJsonBodyWithinLimit(post("[]"));

    expect("response" in result && result.response.status).toBe(400);
    if ("response" in result) {
      await expect(result.response.json()).resolves.toEqual({
        error: { code: -32600, message: "Invalid Request" },
        id: null,
        jsonrpc: "2.0",
      });
    }
  });

  it("rejects a JSON-RPC batch above the message limit", async () => {
    const result = await readMcpJsonBodyWithinLimit(
      post(
        JSON.stringify(
          Array.from({ length: MCP_JSON_RPC_BATCH_LIMIT + 1 }, (_, id) => ({
            id,
            jsonrpc: "2.0",
            method: "tools/list",
          })),
        ),
      ),
    );

    expect("response" in result && result.response.status).toBe(413);
    if ("response" in result) {
      await expect(result.response.json()).resolves.toMatchObject({
        error: {
          code: -32000,
          message: `JSON-RPC batch must not exceed ${MCP_JSON_RPC_BATCH_LIMIT} messages`,
        },
      });
    }
  });

  it("accepts a JSON-RPC batch at the message limit", async () => {
    const body = Array.from({ length: MCP_JSON_RPC_BATCH_LIMIT }, (_, id) => ({
      id,
      jsonrpc: "2.0",
      method: "tools/list",
    }));
    const result = await readMcpJsonBodyWithinLimit(post(JSON.stringify(body)));

    expect(result).toEqual({ body });
  });

  it.each([1, "request-1"])(
    "rejects duplicate typed request ID %s",
    async (id) => {
      const result = await readMcpJsonBodyWithinLimit(
        post(
          JSON.stringify([
            {
              jsonrpc: "2.0",
              id,
              method: "tools/call",
              params: { name: "workspace_todo_create" },
            },
            { jsonrpc: "2.0", id, method: "tools/list" },
          ]),
        ),
      );
      expect("response" in result && result.response.status).toBe(400);
      if ("response" in result) {
        await expect(result.response.json()).resolves.toEqual({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid Request" },
        });
      }
    },
  );

  it("keeps numeric and string request IDs distinct", async () => {
    const body = [
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { jsonrpc: "2.0", id: "1", method: "tools/list" },
    ];
    expect(
      await readMcpJsonBodyWithinLimit(post(JSON.stringify(body))),
    ).toEqual({ body });
  });

  it("does not reserve request IDs for notifications or responses", async () => {
    const body = [
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 1, result: {} },
      { jsonrpc: "2.0", id: 1, error: { code: -32603, message: "failed" } },
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
    ];
    expect(
      await readMcpJsonBodyWithinLimit(post(JSON.stringify(body))),
    ).toEqual({ body });
  });

  it("leaves malformed JSON-RPC entries for SDK validation", async () => {
    const body = [
      { jsonrpc: "invalid", id: 1, method: "tools/list" },
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
    ];
    expect(
      await readMcpJsonBodyWithinLimit(post(JSON.stringify(body))),
    ).toEqual({ body });
  });

  it("keeps the oversized batch error ahead of duplicate-ID validation", async () => {
    const body = Array.from({ length: MCP_JSON_RPC_BATCH_LIMIT + 1 }, () => ({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    }));
    const result = await readMcpJsonBodyWithinLimit(post(JSON.stringify(body)));
    expect("response" in result && result.response.status).toBe(413);
  });
});
