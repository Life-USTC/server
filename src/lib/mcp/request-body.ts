export const MCP_REQUEST_BODY_LIMIT_BYTES = 64 * 1024;

function jsonRpcErrorResponse(status: number, code: number, message: string) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    }),
    {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}

export async function readMcpJsonBodyWithinLimit(
  request: Request,
): Promise<{ body: unknown } | { response: Response }> {
  if (
    request.method !== "POST" ||
    !request.headers.get("content-type")?.includes("application/json")
  ) {
    return { body: undefined };
  }

  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MCP_REQUEST_BODY_LIMIT_BYTES
  ) {
    return {
      response: jsonRpcErrorResponse(
        413,
        -32000,
        `Request body must not exceed ${MCP_REQUEST_BODY_LIMIT_BYTES} bytes`,
      ),
    };
  }

  if (!request.body) {
    return {
      response: jsonRpcErrorResponse(400, -32700, "Parse error: Invalid JSON"),
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MCP_REQUEST_BODY_LIMIT_BYTES) {
      await reader.cancel();
      return {
        response: jsonRpcErrorResponse(
          413,
          -32000,
          `Request body must not exceed ${MCP_REQUEST_BODY_LIMIT_BYTES} bytes`,
        ),
      };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return {
      response: jsonRpcErrorResponse(400, -32700, "Parse error: Invalid JSON"),
    };
  }
}
