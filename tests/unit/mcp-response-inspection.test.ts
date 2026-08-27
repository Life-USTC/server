import { describe, expect, it, vi } from "vitest";
import {
  inspectMcpResponse,
  MCP_RESPONSE_INSPECTION_LIMITS,
} from "@/lib/api/routes/mcp-response-inspection";

const encoder = new TextEncoder();

function responseFromText(body: string, contentType: string) {
  return new Response(body, {
    headers: { "content-type": contentType },
    status: 200,
  });
}

describe("MCP bounded response inspection", () => {
  it("classifies JSON errors without consuming the original response", async () => {
    const response = responseFromText(
      JSON.stringify({ result: { isError: true } }),
      "application/json",
    );

    await expect(inspectMcpResponse(response)).resolves.toEqual({
      hasError: true,
      responseBytes: expect.any(Number),
      truncated: false,
    });
    await expect(response.json()).resolves.toEqual({
      result: { isError: true },
    });
  });

  it("truncates oversized JSON while leaving the original body readable", async () => {
    const body = JSON.stringify({ value: "x".repeat(70 * 1024) });
    const response = responseFromText(body, "application/json");

    await expect(inspectMcpResponse(response)).resolves.toEqual({
      hasError: false,
      responseBytes: expect.any(Number),
      truncated: true,
    });
    await expect(response.text()).resolves.toBe(body);
  });

  it("caps an untrusted Content-Length value used for telemetry", async () => {
    const response = new Response(JSON.stringify({ result: {} }), {
      headers: {
        "content-length": "999999999999",
        "content-type": "application/json",
      },
    });

    await expect(inspectMcpResponse(response)).resolves.toEqual({
      hasError: false,
      responseBytes: MCP_RESPONSE_INSPECTION_LIMITS.maxBytes + 1,
      truncated: true,
    });
    await expect(response.json()).resolves.toEqual({ result: {} });
  });

  it("bounds SSE inspection to eight events and preserves the response", async () => {
    const body = Array.from(
      { length: MCP_RESPONSE_INSPECTION_LIMITS.maxSseEvents + 2 },
      (_, index) =>
        `data: ${JSON.stringify(index === 0 ? { error: { code: "x" } } : { result: {} })}\n\n`,
    ).join("");
    const response = responseFromText(body, "text/event-stream");

    await expect(inspectMcpResponse(response)).resolves.toEqual({
      hasError: true,
      responseBytes: expect.any(Number),
      truncated: true,
    });
    await expect(response.text()).resolves.toBe(body);
  });

  it("cancels the bounded clone reader after a large streaming chunk", async () => {
    const body = `{"value":"${"x".repeat(70 * 1024)}"}`;
    let pulls = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      }),
      { headers: { "content-type": "application/json" } },
    );

    const result = await inspectMcpResponse(response);

    expect(result.truncated).toBe(true);
    expect(pulls).toBe(1);
    await expect(response.text()).resolves.toBe(body);
  });

  it("bounds a non-closing one-event SSE and keeps the original stream readable", async () => {
    const firstEvent = `data: ${JSON.stringify({ result: {} })}\n\n`;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(nextController) {
          nextController.enqueue(encoder.encode(firstEvent));
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );

    const inspection = inspectMcpResponse(response);
    const originalReader = response.body?.getReader();
    await expect(originalReader?.read()).resolves.toMatchObject({
      done: false,
      value: expect.any(Uint8Array),
    });
    await expect(inspection).resolves.toEqual({
      hasError: false,
      responseBytes: expect.any(Number),
      truncated: true,
    });

    await originalReader?.cancel();
  });

  it("does not clone or pull large bodies with an unsupported content type", async () => {
    const body = "x".repeat(128 * 1024);
    let pulls = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(nextController) {
          pulls += 1;
          nextController.enqueue(encoder.encode(body));
          nextController.close();
        },
      }),
      { headers: { "content-type": "application/octet-stream" } },
    );

    await Promise.resolve();
    const pullsBeforeInspection = pulls;
    await expect(inspectMcpResponse(response)).resolves.toEqual({
      hasError: false,
      responseBytes: undefined,
      truncated: false,
    });
    expect(pulls).toBe(pullsBeforeInspection);
    await expect(response.text()).resolves.toBe(body);
    expect(pulls).toBe(1);
  });

  it("marks a supported response as unknown when cloning fails", async () => {
    const body = JSON.stringify({ result: {} });
    const response = responseFromText(body, "application/json");
    const cloneSpy = vi.spyOn(response, "clone").mockImplementation(() => {
      throw new Error("clone failed");
    });

    try {
      await expect(inspectMcpResponse(response)).resolves.toEqual({
        hasError: false,
        responseBytes: undefined,
        truncated: true,
      });
      await expect(response.text()).resolves.toBe(body);
    } finally {
      cloneSpy.mockRestore();
    }
  });

  it("marks a supported response as unknown when clone reading fails", async () => {
    const body = JSON.stringify({ result: {} });
    const response = responseFromText(body, "application/json");
    const failedClone = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error("read failed"));
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
    const cloneSpy = vi.spyOn(response, "clone").mockReturnValue(failedClone);

    try {
      await expect(inspectMcpResponse(response)).resolves.toEqual({
        hasError: false,
        responseBytes: 0,
        truncated: true,
      });
      await expect(response.text()).resolves.toBe(body);
    } finally {
      cloneSpy.mockRestore();
    }
  });

  it("marks a supported response as unknown when the clone has no reader", async () => {
    const body = JSON.stringify({ result: {} });
    const response = responseFromText(body, "application/json");
    const cancel = vi.fn().mockResolvedValue(undefined);
    const cloneSpy = vi.spyOn(response, "clone").mockReturnValue({
      body: {
        cancel,
        getReader: () => {
          throw new Error("reader failed");
        },
      },
    } as unknown as Response);

    try {
      await expect(inspectMcpResponse(response)).resolves.toEqual({
        hasError: false,
        responseBytes: undefined,
        truncated: true,
      });
      expect(cancel).toHaveBeenCalledOnce();
      await expect(response.text()).resolves.toBe(body);
    } finally {
      cloneSpy.mockRestore();
    }
  });
});
