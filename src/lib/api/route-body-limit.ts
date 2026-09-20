/**
 * Bounded JSON request-body reading for REST adapters.
 *
 * Workers enforce a hard per-isolate memory ceiling. `request.json()` buffers
 * and parses the whole body first, so an oversized payload exhausts the isolate
 * (`exceededMemory`) before any schema can reject it. Reading through the body
 * stream with a byte budget turns that crash into a deterministic 413.
 */
export class RouteBodyTooLargeError extends Error {
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    super(`Request body must not exceed ${maxBytes} bytes`);
    this.name = "RouteBodyTooLargeError";
    this.maxBytes = maxBytes;
  }
}

function concatChunks(chunks: Uint8Array[], total: number) {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Read and parse a JSON body, refusing anything above `maxBytes`.
 *
 * A declared `content-length` above the budget is refused before the body is
 * touched at all; otherwise the stream is cancelled as soon as the budget is
 * exceeded, so the oversized remainder is never buffered.
 *
 * @throws {RouteBodyTooLargeError} when the body exceeds `maxBytes`.
 * @throws {SyntaxError} when the received bytes are not valid JSON.
 */
export async function readJsonBodyWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxBytes
  ) {
    throw new RouteBodyTooLargeError(maxBytes);
  }

  // Runtimes that materialize the body eagerly expose no stream to meter.
  if (!request.body) return await request.json();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RouteBodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  return JSON.parse(new TextDecoder().decode(concatChunks(chunks, total)));
}
