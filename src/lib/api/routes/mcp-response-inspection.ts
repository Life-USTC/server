const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_SSE_EVENTS = 8;

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

function declaredContentLength(response: Response) {
  const value = response.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return undefined;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : undefined;
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

  const contentLength = declaredContentLength(response);
  if (contentLength !== undefined && contentLength > MAX_RESPONSE_BYTES) {
    return { hasError: false, responseBytes: contentLength, truncated: true };
  }

  let clone: Response;
  try {
    clone = response.clone();
  } catch {
    return { hasError: false, responseBytes: contentLength, truncated: false };
  }
  if (!clone.body) {
    return { hasError: false, responseBytes: contentLength, truncated: false };
  }

  const reader = clone.body.getReader();
  const isSse = (response.headers.get("content-type") ?? "").includes(
    "text/event-stream",
  );
  const isJson = (response.headers.get("content-type") ?? "").includes(
    "application/json",
  );
  if (!isSse && !isJson) {
    return { hasError: false, responseBytes: contentLength, truncated: false };
  }
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";
  let pendingLine = "";
  let sseEvents = 0;
  let hasError = false;
  let truncated = false;
  let readerDone = false;

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
    while (!readerDone && !truncated) {
      const result = await reader.read();
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
    // Preserve the HTTP outcome when the clone cannot be inspected.
  } finally {
    if (!readerDone) {
      try {
        // A Response clone is backed by a tee. Waiting for cancellation can
        // block while the untouched original branch is still being consumed;
        // invoke cancellation and observe its rejection without delaying the
        // response path.
        void reader.cancel().catch(() => undefined);
      } catch {
        // Inspection cleanup must not affect the response path.
      }
    }
    reader.releaseLock();
  }

  return {
    hasError,
    responseBytes: contentLength ?? bytesRead,
    truncated,
  };
}

export const MCP_RESPONSE_INSPECTION_LIMITS = {
  maxBytes: MAX_RESPONSE_BYTES,
  maxSseEvents: MAX_SSE_EVENTS,
} as const;
