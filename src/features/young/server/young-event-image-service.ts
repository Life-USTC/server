import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { getCloudflareR2PublicationsBucket } from "@/lib/ports/runtime";

const YOUNG_EVENT_IMAGE_ORIGIN = "https://young.ustc.edu.cn/login/";
const YOUNG_EVENT_IMAGE_KEY_PREFIX = "young-events/images/";

export const YOUNG_EVENT_IMAGE_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable, no-transform",
  "Cloudflare-CDN-Cache-Control": "public, max-age=31536000, immutable",
} as const;

export class YoungEventImageStorageUnavailableError extends Error {
  readonly code = "young_event_image_storage_unavailable";
}

export class YoungEventImageOriginError extends Error {
  readonly code = "young_event_image_origin_error";
}

/** Posters are small; cap origin reads so a bad response cannot exhaust the
 * 128 MB Worker memory limit or flood the bucket. */
export const YOUNG_EVENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_PATH_SEGMENT = /^[A-Za-z0-9._~-]+$/;

/**
 * The stored imageUrl is a raw young.ustc.edu.cn `pic` path (for example
 * `group1/M00/31/B5/x.jpg`). Only accept strict relative segments so the value
 * can never escape the origin prefix or the R2 key prefix.
 */
export function normalizeYoungEventImagePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const segments = trimmed.split("/");
  for (const segment of segments) {
    if (segment === "." || segment === "..") return null;
    if (!IMAGE_PATH_SEGMENT.test(segment)) return null;
  }
  return trimmed;
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function guessImageContentType(imagePath: string) {
  const lastSegment = imagePath.slice(imagePath.lastIndexOf("/") + 1);
  const dot = lastSegment.lastIndexOf(".");
  if (dot < 0) return undefined;
  return EXTENSION_CONTENT_TYPES[lastSegment.slice(dot).toLowerCase()];
}

function normalizeEtag(etag: string) {
  const trimmed = etag.trim();
  if (trimmed.startsWith('W/"') || trimmed.startsWith('"')) return trimmed;
  return `"${trimmed.replaceAll('"', "")}"`;
}

export function requestMatchesEtag(request: Request, etag: string) {
  const value = request.headers.get("If-None-Match");
  if (!value) return false;
  return value.split(",").some((candidate) => {
    const normalized = candidate.trim().replace(/^W\//, "");
    return normalized === "*" || normalized === etag;
  });
}

function imageResponseHeaders(etag?: string) {
  const headers = new Headers(YOUNG_EVENT_IMAGE_CACHE_HEADERS);
  if (etag) headers.set("ETag", etag);
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

async function readImageBytes(origin: Response): Promise<ArrayBuffer> {
  const tooLarge = () =>
    new YoungEventImageOriginError(
      `Young event image origin response exceeds ${YOUNG_EVENT_IMAGE_MAX_BYTES} bytes`,
    );
  if (
    Number(origin.headers.get("Content-Length")) > YOUNG_EVENT_IMAGE_MAX_BYTES
  ) {
    await origin.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  if (!origin.body) return new ArrayBuffer(0);

  const reader = origin.body.getReader();
  let bytes = new Uint8Array(0);
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const nextSize = size + value.byteLength;
      if (nextSize > YOUNG_EVENT_IMAGE_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      if (nextSize > bytes.length) {
        const capacity = Math.min(
          YOUNG_EVENT_IMAGE_MAX_BYTES,
          Math.max(nextSize, bytes.length * 2),
        );
        const buffer = new Uint8Array(capacity);
        buffer.set(bytes);
        bytes = buffer;
      }
      bytes.set(value, size);
      size = nextSize;
    }
    return bytes.length === size ? bytes.buffer : bytes.buffer.slice(0, size);
  } catch (error) {
    if (error instanceof YoungEventImageOriginError) throw error;
    throw new YoungEventImageOriginError(
      "Failed to read young event image from origin",
      { cause: error },
    );
  } finally {
    reader.releaseLock();
  }
}

/**
 * Lazily cache an upstream image in R2 and serve it from our own origin.
 * Returns null when the path is not a safe relative pic path.
 *
 * Image bytes are addressed by their upstream path, not by the event that
 * happens to embed them, so poster images and rich-text inline images share
 * one R2 object and one cache entry.
 */
export async function getYoungEventImageByPathResponse(input: {
  request: Request;
  imagePath: string;
  /** Only used to correlate log lines back to the event that embedded it. */
  youngId?: string;
  defer?: (promise: Promise<unknown>) => void;
}): Promise<Response | null> {
  const imagePath = normalizeYoungEventImagePath(input.imagePath);
  if (!imagePath) return null;

  const bucket = getCloudflareR2PublicationsBucket();
  if (!bucket) {
    throw new YoungEventImageStorageUnavailableError(
      "R2_PUBLICATIONS binding is required",
    );
  }

  const key = `${YOUNG_EVENT_IMAGE_KEY_PREFIX}${imagePath}`;
  const contentTypeFallback =
    guessImageContentType(imagePath) ?? "application/octet-stream";

  if (input.request.headers.has("If-None-Match")) {
    const head = await bucket.head(key);
    const etag = head?.etag && normalizeEtag(head.etag);
    if (etag && requestMatchesEtag(input.request, etag)) {
      return new Response(null, {
        status: 304,
        headers: imageResponseHeaders(etag),
      });
    }
  }

  const object = await bucket.get(key);
  if (object) {
    const etag = object.etag ? normalizeEtag(object.etag) : undefined;
    const headers = imageResponseHeaders(etag);
    if (etag && requestMatchesEtag(input.request, etag)) {
      // A replacement may have landed since the conditional metadata check.
      await object.body.cancel();
      return new Response(null, { status: 304, headers });
    }
    headers.set(
      "Content-Type",
      object.httpMetadata?.contentType ?? contentTypeFallback,
    );
    headers.set("Content-Length", String(object.size));
    return new Response(object.body, { headers });
  }

  let origin: globalThis.Response;
  try {
    origin = await fetch(`${YOUNG_EVENT_IMAGE_ORIGIN}${imagePath}`);
  } catch (error) {
    throw new YoungEventImageOriginError(
      "Failed to fetch young event image from origin",
      { cause: error },
    );
  }
  if (!origin.ok) {
    throw new YoungEventImageOriginError(
      `Young event image origin responded ${origin.status}`,
    );
  }

  // Never persist non-image bytes under an immutable year-long cache: an
  // upstream error page would become same-origin content on our domain.
  const declaredType = origin.headers
    .get("Content-Type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (declaredType && !declaredType.startsWith("image/")) {
    throw new YoungEventImageOriginError(
      `Young event image origin returned non-image content type ${declaredType}`,
    );
  }
  const contentType = declaredType ?? contentTypeFallback;
  if (!contentType.startsWith("image/")) {
    throw new YoungEventImageOriginError(
      "Young event image origin content type is not an image",
    );
  }

  const body = await readImageBytes(origin);

  const store = bucket.put(key, body, { httpMetadata: { contentType } });
  if (input.defer) {
    // The deferred write outlives the response; log failures instead of
    // dropping the rejection silently.
    input.defer(
      store.catch((error: unknown) => {
        logAppEvent(
          "error",
          "Failed to cache young event image in R2",
          { source: "young-event-image", imagePath, youngId: input.youngId },
          error,
        );
      }),
    );
  } else {
    await store;
  }

  const headers = imageResponseHeaders();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", String(body.byteLength));
  return new Response(body, { headers });
}

/** Resolve the current poster without caching the event-to-representation mapping. */
export async function getYoungEventPosterUrl(
  youngId: string,
): Promise<string | null> {
  const record = await prisma.youngEvent.findUnique({
    where: { youngId },
    select: { imageUrl: true },
  });
  return record?.imageUrl ? youngEventImageUrl(record.imageUrl) : null;
}

export function youngEventImageUrl(imagePath: string): string | null {
  const normalized = normalizeYoungEventImagePath(imagePath);
  return normalized ? `/api/catalog/young-events/images/${normalized}` : null;
}
