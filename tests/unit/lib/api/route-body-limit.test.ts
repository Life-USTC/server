import { describe, expect, it } from "vitest";
import {
  RouteBodyTooLargeError,
  readJsonBodyWithinLimit,
} from "@/lib/api/route-body-limit";

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://life.example/api/probe", {
    body,
    headers: { "Content-Type": "application/json", ...headers },
    method: "POST",
  });
}

/**
 * A body that never ends. Any reader that buffers the whole request before
 * enforcing a budget hangs on it — which is exactly how the unbounded handler
 * exhausted the Workers isolate instead of answering.
 */
function endlessRequest(
  chunkBytes: number,
  headers: Record<string, string> = {},
) {
  const chunk = new TextEncoder().encode("a".repeat(chunkBytes));
  let enqueued = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      enqueued += chunkBytes;
      controller.enqueue(chunk);
    },
  });
  const request = new Request("https://life.example/api/probe", {
    body: stream,
    // Node's fetch implementation requires an explicit duplex for stream bodies.
    duplex: "half",
    headers: { "Content-Type": "application/json", ...headers },
    method: "POST",
  } as RequestInit);
  return { enqueuedBytes: () => enqueued, request };
}

describe("readJsonBodyWithinLimit", () => {
  it("parses a body inside the budget", async () => {
    await expect(
      readJsonBodyWithinLimit(jsonRequest('{"ok":true}'), 1_024),
    ).resolves.toEqual({ ok: true });
  });

  it("refuses a declared content-length above the budget untouched", async () => {
    const { enqueuedBytes, request } = endlessRequest(1_024, {
      "content-length": "9999999",
    });

    await expect(readJsonBodyWithinLimit(request, 64)).rejects.toBeInstanceOf(
      RouteBodyTooLargeError,
    );
    // The declared length alone must decide it; the stream stays unconsumed.
    expect(request.bodyUsed).toBe(false);
    expect(enqueuedBytes()).toBeLessThanOrEqual(1_024);
  });

  it("stops reading an undeclared body once it exceeds the budget", async () => {
    const { enqueuedBytes, request } = endlessRequest(1_024);

    await expect(
      readJsonBodyWithinLimit(request, 4_096),
    ).rejects.toBeInstanceOf(RouteBodyTooLargeError);
    // Reading is abandoned a chunk past the budget, not at end of stream.
    expect(enqueuedBytes()).toBeLessThan(64 * 1_024);
  });

  it("reports the configured budget without echoing the body", async () => {
    const error = await readJsonBodyWithinLimit(
      jsonRequest('"x"', { "content-length": "4096" }),
      128,
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RouteBodyTooLargeError);
    expect((error as RouteBodyTooLargeError).maxBytes).toBe(128);
    expect((error as RouteBodyTooLargeError).message).toBe(
      "Request body must not exceed 128 bytes",
    );
  });

  it("surfaces malformed JSON inside the budget as a syntax error", async () => {
    await expect(
      readJsonBodyWithinLimit(jsonRequest("{not json"), 1_024),
    ).rejects.toBeInstanceOf(SyntaxError);
  });
});
