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
});
