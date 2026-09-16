import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { getCloudflareR2PublicationsBucket } from "@/lib/ports/runtime";

const PUBLIC_PUBLICATION_TYPES = ["news", "notice"] as const;
const PUBLICATION_IMAGE_ORIGIN = "ustc.edu.cn";
const PUBLICATION_IMAGE_MAX_REDIRECTS = 5;
const PUBLICATION_IMAGE_FETCH_TIMEOUT_MS = 10_000;

/** Image URLs are mutable upstream resources, so responses use a finite
 * cache lifetime and do not advertise content-addressed immutability. The
 * R2 copy is an archival first successful fetch for this URL hash. */
export const PUBLICATION_IMAGE_CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, no-transform",
  "Cloudflare-CDN-Cache-Control":
    "public, max-age=86400, stale-while-revalidate=604800, no-transform",
} as const;

export const PUBLICATION_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const RASTER_CONTENT_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
};

type PublicationImageSourceOwner = {
  originalUrl: string;
  /** The exact public hostname derived from the trusted registry URL. */
  registeredHost: string;
  publication: {
    source: {
      allowedHosts: string[];
      blockedHosts: string[];
    };
  };
};

export class PublicationImageStorageUnavailableError extends Error {
  readonly code = "publication_image_storage_unavailable";
}

export class PublicationImageOriginError extends Error {
  readonly code = "publication_image_origin_error";
}

function normalizeHost(value: string) {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host.includes("/") || host.includes("\\")) return null;
  if (host.startsWith("[") || host.endsWith("]") || host.includes(":")) {
    return null;
  }
  if (isNumericIpv4(host)) return null;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "local" ||
    host.endsWith(".local") ||
    host === "internal" ||
    host.endsWith(".internal") ||
    host === "intranet" ||
    host.endsWith(".intranet") ||
    host === "home.arpa" ||
    host.endsWith(".home.arpa") ||
    host === "lan" ||
    host.endsWith(".lan")
  ) {
    return null;
  }
  return host;
}

function isNumericIpv4(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return false;
  }
  return parts.every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function hostMatches(hostname: string, configuredHost: string) {
  const host = normalizeHost(hostname);
  const configured = normalizeHost(configuredHost);
  if (!host || !configured) return false;
  return host === configured || host.endsWith(`.${configured}`);
}

function sourceAllowsHost(
  hostname: string,
  source: PublicationImageSourceOwner["publication"]["source"],
  registeredHost?: string,
) {
  const host = normalizeHost(hostname);
  if (!host) return false;
  if (source.blockedHosts.some((blocked) => hostMatches(host, blocked))) {
    return false;
  }
  const exactRegisteredHost = registeredHost
    ? normalizeHost(registeredHost)
    : null;
  if (exactRegisteredHost && host === exactRegisteredHost) return true;
  if (hostMatches(host, PUBLICATION_IMAGE_ORIGIN)) return true;
  return source.allowedHosts.some((allowed) => hostMatches(host, allowed));
}

/** Validate every URL before it is fetched, including after redirects. */
export function parsePublicationImageOrigin(
  value: string,
  source: PublicationImageSourceOwner["publication"]["source"],
  registeredHost?: string,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.port ||
    !sourceAllowsHost(url.hostname, source, registeredHost)
  ) {
    return null;
  }
  return url;
}

function imageUrlHash(value: string) {
  return globalThis.crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(value))
    .then((digest) =>
      Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
    );
}

async function findImageSource(hash: string) {
  const source = await prisma.publicationImageSource.findUnique({
    where: { id: hash },
    select: {
      id: true,
      url: true,
      revisions: {
        where: {
          revision: {
            isTombstone: false,
            publicationType: { in: [...PUBLIC_PUBLICATION_TYPES] },
            currentFor: { isNot: null },
            publication: {
              is: {
                deletedAt: null,
                publicationType: { in: [...PUBLIC_PUBLICATION_TYPES] },
              },
            },
          },
        },
        select: {
          revision: {
            select: {
              currentFor: { select: { id: true } },
              publication: {
                select: {
                  id: true,
                  source: {
                    select: {
                      allowedHosts: true,
                      blockedHosts: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!source) return null;
  let registeredHost: string | null;
  try {
    registeredHost = normalizeHost(new URL(source.url).hostname);
  } catch {
    registeredHost = null;
  }
  if (!registeredHost) return null;
  for (const candidate of source.revisions) {
    const revision = candidate.revision;
    if (revision.currentFor?.id !== revision.publication.id) continue;
    const owner = {
      originalUrl: source.url,
      registeredHost,
      publication: revision.publication,
    } satisfies PublicationImageSourceOwner;
    if (
      parsePublicationImageOrigin(
        source.url,
        owner.publication.source,
        owner.registeredHost,
      )
    ) {
      return owner;
    }
  }
  return null;
}

export function publicationImageR2Key(hash: string) {
  return `publications/images/url-sha256/${hash}`;
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

function imageContentTypeFromPath(value: string) {
  const path = value.split("?", 1)[0] ?? value;
  const dot = path.lastIndexOf(".");
  return dot < 0
    ? undefined
    : EXTENSION_CONTENT_TYPES[path.slice(dot).toLowerCase()];
}

function normalizeRasterContentType(value: string | null | undefined) {
  const type = value?.split(";", 1)[0]?.trim().toLowerCase();
  return type && RASTER_CONTENT_TYPES.has(type) ? type : undefined;
}

function imageResponseHeaders(etag?: string) {
  const headers = new Headers(PUBLICATION_IMAGE_CACHE_HEADERS);
  if (etag) headers.set("ETag", etag);
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

async function readLimitedBody(response: Response) {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength >= 0 &&
    declaredLength > PUBLICATION_IMAGE_MAX_BYTES
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new PublicationImageOriginError(
      `Publication image response exceeds ${PUBLICATION_IMAGE_MAX_BYTES} bytes`,
    );
  }
  if (!response.body) {
    throw new PublicationImageOriginError(
      "Publication image origin returned an empty body",
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > PUBLICATION_IMAGE_MAX_BYTES) {
        await reader.cancel();
        throw new PublicationImageOriginError(
          `Publication image response exceeds ${PUBLICATION_IMAGE_MAX_BYTES} bytes`,
        );
      }
      chunks.push(chunk.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof PublicationImageOriginError) throw error;
    throw new PublicationImageOriginError(
      "Failed to read publication image from origin",
      { cause: error },
    );
  }
  if (total === 0) {
    throw new PublicationImageOriginError(
      "Publication image origin returned an empty body",
    );
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchPublicationImage(
  initialUrl: URL,
  source: PublicationImageSourceOwner["publication"]["source"],
  registeredHost: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PUBLICATION_IMAGE_FETCH_TIMEOUT_MS,
  );
  let currentUrl = initialUrl;
  try {
    for (
      let redirect = 0;
      redirect <= PUBLICATION_IMAGE_MAX_REDIRECTS;
      redirect += 1
    ) {
      if (
        !parsePublicationImageOrigin(
          currentUrl.toString(),
          source,
          registeredHost,
        )
      ) {
        throw new PublicationImageOriginError(
          "Publication image redirect target is not allowed",
        );
      }
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
        });
      } catch (error) {
        throw new PublicationImageOriginError(
          "Failed to fetch publication image from origin",
          { cause: error },
        );
      }

      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        if (redirect === PUBLICATION_IMAGE_MAX_REDIRECTS) {
          throw new PublicationImageOriginError(
            "Publication image origin redirected too many times",
          );
        }
        const location = response.headers.get("Location");
        if (!location) {
          throw new PublicationImageOriginError(
            "Publication image origin returned a redirect without a location",
          );
        }
        try {
          currentUrl = new URL(location, currentUrl);
        } catch {
          throw new PublicationImageOriginError(
            "Publication image origin returned an invalid redirect",
          );
        }
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new PublicationImageOriginError(
          `Publication image origin responded ${response.status}`,
        );
      }

      const declaredContentType = response.headers.get("Content-Type");
      const contentType = declaredContentType
        ? normalizeRasterContentType(declaredContentType)
        : imageContentTypeFromPath(currentUrl.toString());
      if (!contentType || !RASTER_CONTENT_TYPES.has(contentType)) {
        await response.body?.cancel().catch(() => undefined);
        throw new PublicationImageOriginError(
          "Publication image origin returned a non-raster content type",
        );
      }
      return { bytes: await readLimitedBody(response), contentType };
    }
  } finally {
    clearTimeout(timeout);
  }
  throw new PublicationImageOriginError(
    "Publication image origin redirected too many times",
  );
}

function requirePublicationsBucket() {
  const bucket = getCloudflareR2PublicationsBucket();
  if (!bucket) {
    throw new PublicationImageStorageUnavailableError(
      "R2_PUBLICATIONS binding is required",
    );
  }
  return bucket;
}

export async function getPublicationImageResponse(input: {
  request: Request;
  hash: string;
  defer?: (promise: Promise<unknown>) => void;
}) {
  const record = await findImageSource(input.hash);
  if (!record) return null;
  const originalUrl = record.originalUrl;
  const source = record.publication.source;
  const originUrl = parsePublicationImageOrigin(
    originalUrl,
    source,
    record.registeredHost,
  );
  if (!originUrl || (await imageUrlHash(originalUrl)) !== input.hash) {
    return null;
  }

  const bucket = requirePublicationsBucket();
  const key = publicationImageR2Key(input.hash);
  const head = await bucket.head(key);
  const cachedContentType = normalizeRasterContentType(
    head?.httpMetadata?.contentType,
  );
  if (head && head.size <= PUBLICATION_IMAGE_MAX_BYTES && cachedContentType) {
    const etag = head.etag ? normalizeEtag(head.etag) : undefined;
    const headers = imageResponseHeaders(etag);
    if (etag && requestMatchesEtag(input.request, etag)) {
      return new Response(null, { status: 304, headers });
    }
    const object = await bucket.get(key);
    if (object?.body && object.size === head.size) {
      headers.set("Content-Type", cachedContentType);
      headers.set("Content-Length", String(object.size));
      return new Response(object.body, { headers });
    }
  }

  const { bytes, contentType } = await fetchPublicationImage(
    originUrl,
    source,
    record.registeredHost,
  );
  const store = bucket.put(key, bytes, { httpMetadata: { contentType } });
  const persist = store.catch((error: unknown) => {
    logAppEvent(
      "error",
      "Failed to cache publication image in R2",
      { source: "publication-image", hash: input.hash },
      error,
    );
  });
  if (input.defer) {
    input.defer(persist);
  } else {
    await persist;
  }

  const headers = imageResponseHeaders();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes, { headers });
}
