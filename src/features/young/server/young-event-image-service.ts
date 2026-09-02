import { getCloudflareR2PublicationsBucket } from "@/lib/adapters/cloudflare-runtime";
import { prisma } from "@/lib/db/prisma";

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

function requestMatchesEtag(request: Request, etag: string) {
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

/**
 * Lazily cache a poster image in R2 and serve it from our own origin.
 * Returns null when the event is unknown, has no image, or stores a value
 * that is not a safe relative pic path.
 */
export async function getYoungEventImageResponse(input: {
  request: Request;
  youngId: string;
  defer?: (promise: Promise<unknown>) => void;
}): Promise<Response | null> {
  const record = await prisma.youngEvent.findUnique({
    where: { youngId: input.youngId },
    select: { imageUrl: true },
  });
  const imagePath = record?.imageUrl
    ? normalizeYoungEventImagePath(record.imageUrl)
    : null;
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

  const head = await bucket.head(key);
  if (head) {
    const etag = head.etag ? normalizeEtag(head.etag) : undefined;
    const headers = imageResponseHeaders(etag);
    if (etag && requestMatchesEtag(input.request, etag)) {
      return new Response(null, { status: 304, headers });
    }
    const object = await bucket.get(key);
    if (object?.body) {
      headers.set(
        "Content-Type",
        object.httpMetadata?.contentType ??
          head.httpMetadata?.contentType ??
          contentTypeFallback,
      );
      headers.set("Content-Length", String(object.size));
      return new Response(object.body, { headers });
    }
  }

  // Cache miss (or a head/get race): fetch the origin once, stream the bytes
  // to the client, and persist the copy in R2 for subsequent requests.
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

  const declaredLength = Number(origin.headers.get("Content-Length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > YOUNG_EVENT_IMAGE_MAX_BYTES
  ) {
    throw new YoungEventImageOriginError(
      `Young event image origin response exceeds ${YOUNG_EVENT_IMAGE_MAX_BYTES} bytes`,
    );
  }
  const body = await origin.arrayBuffer().catch((error: unknown) => {
    throw new YoungEventImageOriginError(
      "Failed to read young event image from origin",
      { cause: error },
    );
  });
  if (body.byteLength > YOUNG_EVENT_IMAGE_MAX_BYTES) {
    throw new YoungEventImageOriginError(
      `Young event image origin response exceeds ${YOUNG_EVENT_IMAGE_MAX_BYTES} bytes`,
    );
  }

  const store = bucket.put(key, body, { httpMetadata: { contentType } });
  if (input.defer) {
    input.defer(store);
  } else {
    await store;
  }

  const headers = imageResponseHeaders();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", String(body.byteLength));
  return new Response(body, { headers });
}
