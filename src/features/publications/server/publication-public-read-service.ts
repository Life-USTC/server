import type { Prisma } from "@/generated/prisma/client";
import type { PublicationsQuery } from "@/features/publications/lib/publication-read-request-schemas";
import { prisma } from "@/lib/db/prisma";
import { normalizePagination, type PaginationInput } from "@/lib/pagination";
import { getCloudflareR2PublicationsBucket } from "@/lib/ports/runtime";
import { publicationObjectKey } from "./publication-ingestion-service";

const PUBLIC_PUBLICATION_TYPES = ["news", "notice"] as const;
const PUBLIC_OBJECT_STATUSES = ["verified", "linked"] as const;

function isPublicObjectStatus(
  status: string,
): status is (typeof PUBLIC_OBJECT_STATUSES)[number] {
  return PUBLIC_OBJECT_STATUSES.includes(
    status as (typeof PUBLIC_OBJECT_STATUSES)[number],
  );
}

function isPublicPublicationType(
  type: string,
): type is (typeof PUBLIC_PUBLICATION_TYPES)[number] {
  return PUBLIC_PUBLICATION_TYPES.includes(
    type as (typeof PUBLIC_PUBLICATION_TYPES)[number],
  );
}

const PUBLICATION_READ_INCLUDE = {
  source: {
    select: {
      id: true,
      name: true,
      organizationLevel: true,
    },
  },
  currentRevision: {
    include: {
      objectLinks: {
        include: {
          object: {
            select: {
              kind: true,
              sha256: true,
              size: true,
              contentType: true,
              r2Key: true,
              status: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  },
} satisfies Prisma.PublicationInclude;

type PublicPublicationRecord = Prisma.PublicationGetPayload<{
  include: typeof PUBLICATION_READ_INCLUDE;
}>;

type PublicPublicationRevision = NonNullable<
  PublicPublicationRecord["currentRevision"]
>;

type PublicPublicationObjectLink =
  PublicPublicationRevision["objectLinks"][number];

export type PublicationReadFilters = {
  type?: PublicationsQuery["type"];
  source?: PublicationsQuery["source"];
  query?: PublicationsQuery["query"];
};

export type PublicationReadPagination = Pick<
  ReturnType<typeof normalizePublicationPagination>,
  "page" | "pageSize" | "skip"
>;

export type PublicPublicationObject = {
  kind: PublicPublicationObjectLink["object"]["kind"];
  sha256: string;
  size: number;
  contentType: string;
  status: "verified" | "linked";
  url: string;
  sortOrder: number | null;
  altText: string | null;
};

export type PublicPublicationSource = {
  id: string;
  name: string;
  organizationLevel: string;
};

export type PublicPublicationRevisionSummary = {
  id: string;
  revisionHash: string;
  observedAt: Date;
  title: string;
  author: string | null;
  publishedAt: Date | null;
  updatedAtSource: Date | null;
  category: string | null;
  summary: string | null;
  sourcePageUrl: string | null;
};

export type PublicPublicationListItem = {
  id: string;
  canonicalUrl: string;
  publicationType: "news" | "notice";
  source: PublicPublicationSource;
  revision: PublicPublicationRevisionSummary;
  objects: PublicPublicationObject[];
};

export type PublicPublicationDetail = {
  id: string;
  canonicalUrl: string;
  publicationType: "news" | "notice";
  source: PublicPublicationSource;
  revision: PublicPublicationRevisionSummary & {
    bodyText: string | null;
    extractionMethod: string | null;
    classifierVersion: string | null;
    objects: PublicPublicationObject[];
  };
};

export type PublicPublicationList = {
  data: PublicPublicationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export class PublicationReadStorageUnavailableError extends Error {
  readonly code = "publication_read_storage_unavailable";
}

const PUBLICATION_READ_CACHE_CONTROL =
  "public, max-age=0, s-maxage=120, stale-while-revalidate=300";

export const PUBLICATION_READ_CACHE_HEADERS = {
  "Cache-Control": PUBLICATION_READ_CACHE_CONTROL,
  "Cloudflare-CDN-Cache-Control":
    "public, max-age=120, stale-while-revalidate=300",
} as const;

const PUBLICATION_OBJECT_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable, no-transform",
  "Cloudflare-CDN-Cache-Control":
    "public, max-age=31536000, immutable, no-transform",
} as const;

function normalizePublicationPagination(input: PaginationInput = {}) {
  return normalizePagination({
    ...input,
    defaultPage: 1,
    defaultPageSize: 20,
    maxPageSize: 50,
  });
}

function publicPublicationWhere(
  filters: PublicationReadFilters = {},
): Prisma.PublicationWhereInput {
  const typeFilter = filters.type ?? { in: [...PUBLIC_PUBLICATION_TYPES] };
  const where: Prisma.PublicationWhereInput = {
    deletedAt: null,
    publicationType: typeFilter,
    currentRevision: {
      is: {
        isTombstone: false,
        publicationType: typeFilter,
      },
    },
  };

  if (filters.source) {
    where.sourceId = filters.source;
  }

  if (filters.query) {
    const contains = { contains: filters.query, mode: "insensitive" as const };
    where.OR = [
      { canonicalUrl: contains },
      { title: contains },
      { summary: contains },
    ];
  }

  return where;
}

function objectReadUrl(kind: string, sha256: string) {
  return `/api/publications/objects/${kind}/${sha256}`;
}

function mapObjectLink(link: PublicPublicationObjectLink) {
  const object = link.object;
  if (
    !object ||
    !isPublicObjectStatus(object.status) ||
    object.kind !== link.role ||
    object.r2Key !== publicationObjectKey(object.kind, object.sha256)
  ) {
    return null;
  }

  return {
    kind: object.kind,
    sha256: object.sha256,
    size: object.size,
    contentType: object.contentType,
    status: object.status,
    url: objectReadUrl(object.kind, object.sha256),
    sortOrder: link.sortOrder,
    altText: link.altText,
  } satisfies PublicPublicationObject;
}

function mapObjects(revision: PublicPublicationRevision) {
  return revision.objectLinks.flatMap((link) => {
    const object = mapObjectLink(link);
    return object ? [object] : [];
  });
}

function mapRevisionSummary(revision: PublicPublicationRevision) {
  return {
    id: revision.id,
    revisionHash: revision.revisionHash,
    observedAt: revision.observedAt,
    title: revision.title ?? "",
    author: revision.author,
    publishedAt: revision.publishedAt,
    updatedAtSource: revision.updatedAtSource,
    category: revision.category,
    summary: revision.summary,
    sourcePageUrl: revision.sourcePageUrl,
  } satisfies PublicPublicationRevisionSummary;
}

function mapPublication(
  record: PublicPublicationRecord,
): PublicPublicationListItem | null {
  const revision = record.currentRevision;
  if (
    !revision ||
    revision.isTombstone ||
    !isPublicPublicationType(record.publicationType) ||
    !isPublicPublicationType(revision.publicationType)
  ) {
    return null;
  }

  return {
    id: record.id,
    canonicalUrl: record.canonicalUrl,
    publicationType: record.publicationType,
    source: record.source,
    revision: mapRevisionSummary(revision),
    objects: mapObjects(revision),
  };
}

export async function listPublications(
  input: {
    filters?: PublicationReadFilters;
    pagination?: PaginationInput;
  } = {},
): Promise<PublicPublicationList> {
  const pagination = normalizePublicationPagination(input.pagination);
  const where = publicPublicationWhere(input.filters);
  const [records, total] = await prisma.$transaction([
    prisma.publication.findMany({
      where,
      include: PUBLICATION_READ_INCLUDE,
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { lastSeenAt: "desc" },
        { id: "asc" },
      ],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.publication.count({ where }),
  ]);

  const data = records.flatMap((record) => {
    const mapped = mapPublication(record);
    return mapped ? [mapped] : [];
  });

  return {
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    },
  };
}

export async function getPublicPublicationById(id: string) {
  const record = await prisma.publication.findFirst({
    where: { id, ...publicPublicationWhere() },
    include: PUBLICATION_READ_INCLUDE,
  });
  if (!record) return null;
  const publication = mapPublication(record);
  if (!publication) return null;

  const revision = record.currentRevision;
  if (!revision) return null;
  return {
    id: publication.id,
    canonicalUrl: publication.canonicalUrl,
    publicationType: publication.publicationType,
    source: publication.source,
    revision: {
      ...publication.revision,
      bodyText: revision.bodyText,
      extractionMethod: revision.extractionMethod,
      classifierVersion: revision.classifierVersion,
      objects: publication.objects,
    },
  } satisfies PublicPublicationDetail;
}

function requirePublicationsBucket() {
  const bucket = getCloudflareR2PublicationsBucket();
  if (!bucket) {
    throw new PublicationReadStorageUnavailableError(
      "R2_PUBLICATIONS binding is required",
    );
  }
  return bucket;
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

function objectFilename(
  kind: PublicPublicationObject["kind"],
  sha256: string,
  contentType: string,
) {
  const extension =
    contentType === "application/pdf"
      ? ".pdf"
      : contentType === "text/plain"
        ? ".txt"
        : contentType === "image/jpeg"
          ? ".jpg"
          : contentType === "image/png"
            ? ".png"
            : contentType === "image/webp"
              ? ".webp"
              : contentType === "image/gif"
                ? ".gif"
                : contentType === "video/mp4"
                  ? ".mp4"
                  : contentType === "audio/mpeg"
                    ? ".mp3"
                    : "";
  return `publication-${kind}-${sha256.slice(0, 16)}${extension}`;
}

function objectContentDisposition(
  kind: PublicPublicationObject["kind"],
  sha256: string,
  contentType: string,
) {
  const canRenderInline =
    kind === "media" &&
    /^(image|audio|video)\//.test(contentType) &&
    contentType !== "text/html";
  if (canRenderInline) return "inline";
  return `attachment; filename="${objectFilename(kind, sha256, contentType)}"`;
}

export async function getPublicPublicationObjectResponse(input: {
  request: Request;
  kind: PublicPublicationObject["kind"];
  sha256: string;
}) {
  const record = await prisma.publicationObject.findUnique({
    where: { kind_sha256: { kind: input.kind, sha256: input.sha256 } },
    include: {
      links: {
        include: {
          revision: {
            include: {
              publication: {
                select: {
                  id: true,
                  deletedAt: true,
                  publicationType: true,
                },
              },
              currentFor: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!record || !isPublicObjectStatus(record.status)) {
    return null;
  }

  const hasPublicCurrentRevisionLink = record.links.some((link) => {
    const revision = link.revision;
    const publication = revision.publication;
    return (
      link.role === input.kind &&
      revision.isTombstone === false &&
      revision.currentFor?.id === publication.id &&
      publication.deletedAt === null &&
      isPublicPublicationType(revision.publicationType) &&
      isPublicPublicationType(publication.publicationType)
    );
  });
  if (!hasPublicCurrentRevisionLink) return null;
  if (record.r2Key !== publicationObjectKey(input.kind, input.sha256)) {
    return null;
  }

  const bucket = requirePublicationsBucket();
  const head = await bucket.head(record.r2Key);
  if (!head) return null;
  if (
    head.size !== record.size ||
    (head.httpMetadata?.contentType !== undefined &&
      head.httpMetadata.contentType !== record.contentType)
  ) {
    return null;
  }

  const headers = new Headers(PUBLICATION_OBJECT_CACHE_HEADERS);
  const etag = head.etag ? normalizeEtag(head.etag) : undefined;
  if (etag) headers.set("ETag", etag);
  if (requestMatchesEtag(input.request, etag ?? "")) {
    return new Response(null, { status: 304, headers });
  }

  const object = await bucket.get(record.r2Key);
  if (!object?.body || object.size !== record.size) return null;

  headers.set("Content-Type", record.contentType);
  headers.set("Content-Length", String(object.size));
  headers.set(
    "Content-Disposition",
    objectContentDisposition(input.kind, input.sha256, record.contentType),
  );
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}
