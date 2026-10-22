import { describe, expect, it } from "vitest";
import * as z from "zod";
import {
  RouteBodyTooLargeError,
  readJsonBodyWithinLimit,
} from "@/lib/api/route-body-limit";
import {
  parseRouteJsonBody,
  ROUTE_JSON_BODY_DEFAULT_MAX_BYTES,
} from "@/lib/api/route-request-parsing";
import { matchSectionCodesRequestSchema } from "@/lib/api/schemas/request-schemas";

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

describe("openapi.json-body-limit", () => {
  const schema = z.object({ codes: z.array(z.string()) });
  const bodyOf = (bytes: number) => {
    const envelope = '{"codes":[""]}'.length;
    return `{"codes":["${"a".repeat(bytes - envelope)}"]}`;
  };

  it("parses a body at the default budget", async () => {
    const body = bodyOf(ROUTE_JSON_BODY_DEFAULT_MAX_BYTES);
    expect(new TextEncoder().encode(body).byteLength).toBe(
      ROUTE_JSON_BODY_DEFAULT_MAX_BYTES,
    );

    await expect(
      parseRouteJsonBody(jsonRequest(body), schema, "Invalid payload"),
    ).resolves.toMatchObject({ codes: [expect.any(String)] });
  });

  it("refuses an oversized body with 413 without a route opting in", async () => {
    // The schema would reject this payload too, but only after the whole body
    // is buffered and parsed. The budget has to decide first.
    const response = await parseRouteJsonBody(
      jsonRequest(bodyOf(ROUTE_JSON_BODY_DEFAULT_MAX_BYTES + 1)),
      schema,
      "Invalid payload",
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(413);
  });

  it("stops an endless anonymous body instead of exhausting the isolate", async () => {
    const { enqueuedBytes, request } = endlessRequest(64 * 1_024);

    const response = await parseRouteJsonBody(
      request,
      matchSectionCodesRequestSchema,
      "Invalid match-codes payload",
    );

    expect((response as Response).status).toBe(413);
    expect(enqueuedBytes()).toBeLessThan(ROUTE_JSON_BODY_DEFAULT_MAX_BYTES * 2);
  });

  it("lets a bulk route raise its own budget", async () => {
    const body = bodyOf(ROUTE_JSON_BODY_DEFAULT_MAX_BYTES + 1);

    await expect(
      parseRouteJsonBody(jsonRequest(body), schema, "Invalid payload", {
        maxBytes: ROUTE_JSON_BODY_DEFAULT_MAX_BYTES * 2,
      }),
    ).resolves.toMatchObject({ codes: [expect.any(String)] });
  });
});
