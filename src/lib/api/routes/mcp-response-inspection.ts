const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_SSE_EVENTS = 8;
const MAX_INSPECTION_DURATION_MS = 100;

export type McpResponseInspection = {
  hasError: boolean;
  responseBytes?: number;
  truncated: boolean;
};

function mcpJsonValueHasError(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(mcpJsonValueHasError);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.error) return true;
  const result = record.result;
  return (
    !!result &&
    typeof result === "object" &&
    (result as Record<string, unknown>).isError === true
  );
}

export function boundedMcpContentLength(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const length = Number(value);
  return Number.isSafeInteger(length)
    ? Math.min(length, MAX_RESPONSE_BYTES + 1)
    : undefined;
}

function declaredContentLength(response: Response) {
  return boundedMcpContentLength(response.headers.get("content-length"));
}

function chunkBytes(value: Uint8Array) {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

/**
 * Inspect only a bounded clone. The returned Response is never read or
 * disturbed, and the clone reader is cancelled as soon as a cap is reached.
 */
export async function inspectMcpResponse(
  response: Response,
): Promise<McpResponseInspection> {
  if (response.status >= 400) {
    return {
      hasError: true,
      responseBytes: declaredContentLength(response),
      truncated: false,
    };
  }

  const contentType = (
    response.headers.get("content-type") ?? ""
  ).toLowerCase();
  const isSse = contentType.includes("text/event-stream");
  const isJson =
    contentType.includes("application/json") || contentType.includes("+json");

  // Do not clone unsupported content. Response.clone() tees the body and can
  // force the runtime to buffer an unbounded stream even though no
  // classification is possible from it.
  if (!isSse && !isJson) {
    return {
      hasError: false,
      responseBytes: declaredContentLength(response),
      truncated: false,
    };
  }

  const contentLength = declaredContentLength(response);
  if (contentLength !== undefined && contentLength > MAX_RESPONSE_BYTES) {
    return { hasError: false, responseBytes: contentLength, truncated: true };
  }

  let clone: Response;
  try {
    clone = response.clone();
  } catch {
    // A supported body that cannot be cloned has no reliable application
    // outcome. Mark it unknown so callers retain the response and avoid
    // treating an uninspected 2xx body as a successful tool call.
    return { hasError: false, responseBytes: contentLength, truncated: true };
  }
  const cloneBody = clone.body;
  if (!cloneBody) {
    return { hasError: false, responseBytes: contentLength, truncated: true };
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = cloneBody.getReader();
  } catch {
    // A supported clone whose stream cannot expose a reader is also
    // uninspectable. Best-effort cancellation prevents a custom stream from
    // continuing work while the untouched original remains readable.
    try {
      void cloneBody.cancel().catch(() => undefined);
    } catch {
      // Cleanup must not affect the original response path.
    }
    return { hasError: false, responseBytes: contentLength, truncated: true };
  }
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";
  let pendingLine = "";
  let sseEvents = 0;
  let hasError = false;
  let truncated = false;
  let readerDone = false;
  const deadlineToken = Symbol("mcp-inspection-deadline");
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  const inspectSseLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    sseEvents += 1;
    try {
      if (mcpJsonValueHasError(JSON.parse(line.slice(5).trim()))) {
        hasError = true;
      }
    } catch {
      // A malformed event is not an application error classification.
    }
    if (sseEvents >= MAX_SSE_EVENTS) truncated = true;
  };

  try {
    const deadline = new Promise<typeof deadlineToken>((resolve) => {
      deadlineTimer = setTimeout(
        () => resolve(deadlineToken),
        MAX_INSPECTION_DURATION_MS,
      );
    });
    while (!readerDone && !truncated) {
      // Keep the read promise observed when the deadline wins. Cancellation
      // below will settle the tee branch, but it must never delay the caller.
      const readPromise = reader.read();
      void readPromise.catch(() => undefined);
      const result = await Promise.race([readPromise, deadline]);
      if (result === deadlineToken) {
        truncated = true;
        break;
      }
      if (result.done || !result.value) {
        readerDone = true;
        break;
      }

      const bytes = chunkBytes(result.value);
      const remaining = MAX_RESPONSE_BYTES - bytesRead;
      if (remaining <= 0) {
        truncated = true;
        break;
      }

      const bounded =
        bytes.byteLength > remaining ? bytes.slice(0, remaining) : bytes;
      bytesRead += bounded.byteLength;
      text += decoder.decode(bounded, {
        stream: bytes.byteLength <= remaining,
      });

      if (isSse) {
        pendingLine += text;
        text = "";
        let newlineIndex = pendingLine.indexOf("\n");
        while (newlineIndex >= 0 && !truncated) {
          inspectSseLine(pendingLine.slice(0, newlineIndex).replace(/\r$/, ""));
          pendingLine = pendingLine.slice(newlineIndex + 1);
          newlineIndex = pendingLine.indexOf("\n");
        }
      }

      if (bytes.byteLength > remaining) truncated = true;
    }

    if (isSse && !truncated) {
      pendingLine += decoder.decode();
      inspectSseLine(pendingLine.replace(/\r$/, ""));
    } else if (isJson && !truncated) {
      text += decoder.decode();
      try {
        hasError = mcpJsonValueHasError(JSON.parse(text));
      } catch {
        // Preserve the HTTP outcome when the bounded body is not JSON.
      }
    }
  } catch {
    // Preserve the HTTP outcome, but do not claim a successful application
    // outcome when the supported clone failed during inspection.
    truncated = true;
  } finally {
    if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
    try {
      // A Response clone is backed by a tee. Waiting for cancellation can
      // block while the untouched original branch is still being consumed;
      // invoke cancellation and observe its rejection without delaying the
      // response path. Calling it even after EOF keeps the cleanup contract
      // uniform for custom streams and tests.
      void reader.cancel().catch(() => undefined);
    } catch {
      // Inspection cleanup must not affect the response path.
    }
    try {
      reader.releaseLock();
    } catch {
      // Cleanup must not affect the original response path.
    }
  }

  return {
    hasError,
    responseBytes: contentLength ?? bytesRead,
    truncated,
  };
}

export const MCP_RESPONSE_INSPECTION_LIMITS = {
  inspectionDeadlineMs: MAX_INSPECTION_DURATION_MS,
  maxBytes: MAX_RESPONSE_BYTES,
  maxSseEvents: MAX_SSE_EVENTS,
} as const;
