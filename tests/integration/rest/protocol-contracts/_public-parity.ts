import { expect } from "@playwright/test";
import { nativeEnvelope } from "./_transport";

/** Anonymous public reads through the real Worker, with native response checks. */
export function createPublicParityClient(origin: string) {
  const headers = { "accept-language": "zh-CN", origin };
  async function json(path: string, data?: Record<string, unknown>) {
    const response = await fetch(`${origin}${path}`, {
      method: data ? "POST" : "GET",
      headers: { ...headers, "content-type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    return body;
  }

  async function graph(document: string, variables: Record<string, unknown>) {
    const body = await json("/api/graphql", {
      query: document,
      variables,
    });
    expect(body.errors).toBeUndefined();
    return body.data.catalog;
  }

  async function mcp(name: string, args: Record<string, unknown>) {
    const response = await fetch(`${origin}/api/mcp`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: { ...args, mode: "full", locale: "zh-cn" } },
      }),
    });
    const body = await nativeEnvelope(response);
    expect(response.status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.result.isError).not.toBe(true);
    return JSON.parse(
      body.result.content.find((part: { type: string }) => part.type === "text")
        .text,
    );
  }

  return { rest: (path: string) => json(path), graph, mcp };
}
