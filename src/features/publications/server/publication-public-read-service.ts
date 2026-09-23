import type { PublicationsQuery } from "@/features/publications/lib/publication-read-request-schemas";
import {
  PUBLICATION_SOURCE_UNIVERSITY_LEVEL,
  type PublicationSourceOrganizationLevel,
} from "@/features/publications/lib/publication-source-levels";
import { Prisma } from "@/generated/prisma/client";
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

// Lists need revision metadata and object links, but never article bodies or
// raw crawler metadata. Keep the wide read for the detail endpoint only.
const PUBLICATION_LIST_SELECT = {
  id: true,
  canonicalUrl: true,
  publicationType: true,
  source: PUBLICATION_READ_INCLUDE.source,
  currentRevision: {
    select: {
      id: true,
      revisionHash: true,
      observedAt: true,
      isTombstone: true,
      publicationType: true,
      title: true,
      author: true,
      publishedAt: true,
      updatedAtSource: true,
      category: true,
      summary: true,
      sourcePageUrl: true,
      objectLinks: PUBLICATION_READ_INCLUDE.currentRevision.include.objectLinks,
    },
  },
} satisfies Prisma.PublicationSelect;

type PublicPublicationRecord = Prisma.PublicationGetPayload<{
  select: typeof PUBLICATION_LIST_SELECT;
}>;

type PublicPublicationRevision = NonNullable<
  PublicPublicationRecord["currentRevision"]
>;

type PublicPublicationObjectLink =
  PublicPublicationRevision["objectLinks"][number];

export type PublicationReadFilters = {
  type?: PublicationsQuery["type"];
  /**
   * Source ids to include (issue #1069). Named for its `source` query
   * parameter rather than pluralized so a validated `publicationsQuerySchema`
   * output is still a `PublicationReadFilters` and can be passed straight
   * through by the REST route and the page loader.
   */
  source?: PublicationsQuery["source"];
  /** Source organization levels to include; ANDs with `source`. */
  organizationLevel?: PublicationsQuery["organizationLevel"];
  query?: PublicationsQuery["query"];
  /**
   * Opt-in reprint folding (issue #1068). When true, the list groups
   * same-article reprints across news.ustc.edu.cn sections/columns by
   * (normalized title, published date) and returns one representative row
   * per group. Defaults to false (unfolded) — this is an explicit product
   * choice, not yet a settled default; see the PR description.
   */
  fold?: boolean;
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
  organizationLevel: PublicationSourceOrganizationLevel;
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

/**
 * Present when the list was requested with fold=1 and this row represents a
 * group of 2+ reprints (same normalized title + published date). Absent
 * (rather than `{ siblingCount: 0 }`) for singleton groups and always absent
 * when fold was not requested, so the unfolded response shape is unchanged.
 */
export type PublicPublicationFoldSummary = {
  siblingCount: number;
};

export type PublicPublicationListItem = {
  id: string;
  canonicalUrl: string;
  publicationType: "news" | "notice";
  source: PublicPublicationSource;
  revision: PublicPublicationRevisionSummary;
  objects: PublicPublicationObject[];
  foldGroup?: PublicPublicationFoldSummary;
};

/** A sibling reprint of the same article surfaced on the detail page. */
export type PublicPublicationSibling = {
  id: string;
  canonicalUrl: string;
  source: PublicPublicationSource;
  publishedAt: Date | null;
};

export type PublicPublicationDetail = {
  id: string;
  canonicalUrl: string;
  publicationType: "news" | "notice";
  source: PublicPublicationSource;
  revision: PublicPublicationRevisionSummary & {
    bodyText: string | null;
    bodyMarkdown: string | null;
    extractionMethod: string | null;
    classifierVersion: string | null;
    objects: PublicPublicationObject[];
  };
  /**
   * Other publications sharing this article's normalized title and
   * published date (see issue #1068) — i.e. the same article reprinted
   * under another news.ustc.edu.cn section/column. Always computed
   * (independent of the list `fold` parameter) and empty when there are no
   * siblings.
   */
  alsoPublishedIn: PublicPublicationSibling[];
};

const PUBLICATION_BODY_MARKDOWN_MAX_BYTES = 32 * 1024 * 1024;

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

/**
 * Visibility filter shared by the list, the detail read and the source
 * directory's aggregate, so a source's article count can never disagree with
 * the list it links to.
 */
export function publicPublicationWhere(
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

  if (filters.source && filters.source.length > 0) {
    where.sourceId = { in: filters.source };
  }

  if (filters.organizationLevel && filters.organizationLevel.length > 0) {
    where.source = {
      is: { organizationLevel: { in: filters.organizationLevel } },
    };
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

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Raw-SQL WHERE fragment mirroring publicPublicationWhere(), used by the
 * fold query below (Prisma's query builder has no window-function support,
 * so folding is expressed as $queryRaw). The current-revision join
 * intentionally requires isTombstone = false and a matching publicationType
 * so a tombstoned or "other" current revision drops the row from fold
 * groups exactly as it does from the unfolded list.
 */
function foldPublicationWhereSql(filters: PublicationReadFilters = {}) {
  const types = filters.type ? [filters.type] : [...PUBLIC_PUBLICATION_TYPES];
  const conditions = [
    Prisma.sql`p."deletedAt" IS NULL`,
    Prisma.sql`p."publicationType"::text = ANY(${types})`,
    Prisma.sql`cr."isTombstone" = false`,
    Prisma.sql`cr."publicationType"::text = ANY(${types})`,
  ];

  if (filters.source && filters.source.length > 0) {
    conditions.push(Prisma.sql`p."sourceId" = ANY(${filters.source})`);
  }

  if (filters.organizationLevel && filters.organizationLevel.length > 0) {
    conditions.push(
      Prisma.sql`s."organizationLevel"::text = ANY(${filters.organizationLevel})`,
    );
  }

  if (filters.query) {
    const pattern = `%${escapeLikePattern(filters.query)}%`;
    conditions.push(Prisma.sql`(
      p."canonicalUrl" ILIKE ${pattern}
      OR p."title" ILIKE ${pattern}
      OR p."summary" ILIKE ${pattern}
    )`);
  }

  return Prisma.join(conditions, " AND ");
}

/**
 * Folded (issue #1068) representative-row query. Partitions non-deleted,
 * public-type publications by (normalizedTitle, publishedDateShanghai) and
 * keeps one row per group: prefer a `university` organizationLevel source,
 * then the most recently seen copy, then the lowest id as a deterministic
 * tie-breaker. Returns representative ids in final list order plus each
 * group's total member count, so pagination and total counts operate on
 * groups rather than raw rows.
 */
async function queryFoldedPublicationPage(
  filters: PublicationReadFilters,
  pagination: { skip: number; pageSize: number },
) {
  const whereSql = foldPublicationWhereSql(filters);
  const rows = await prisma.$queryRaw<
    { id: string; groupSize: bigint }[]
  >(Prisma.sql`
    WITH filtered AS (
      SELECT
        p.id,
        p."normalizedTitle",
        p."publishedDateShanghai",
        p."publishedAt",
        p."lastSeenAt",
        (s."organizationLevel"::text = ${PUBLICATION_SOURCE_UNIVERSITY_LEVEL}) AS "isUniversity"
      FROM "Publication" p
      JOIN "PublicationSource" s ON s.id = p."sourceId"
      JOIN "PublicationRevision" cr ON cr.id = p."currentRevisionId"
      WHERE ${whereSql}
    ),
    ranked AS (
      SELECT
        filtered.*,
        ROW_NUMBER() OVER (
          PARTITION BY "normalizedTitle", "publishedDateShanghai"
          ORDER BY "isUniversity" DESC, "lastSeenAt" DESC, id ASC
        ) AS "rowNumber",
        count(*) OVER (
          PARTITION BY "normalizedTitle", "publishedDateShanghai"
        ) AS "groupSize"
      FROM filtered
    )
    SELECT id, "groupSize"
    FROM ranked
    WHERE "rowNumber" = 1
    ORDER BY "publishedAt" DESC NULLS LAST, "lastSeenAt" DESC, id ASC
    LIMIT ${pagination.pageSize}
    OFFSET ${pagination.skip}
  `);

  const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    WITH filtered AS (
      SELECT
        p.id,
        p."normalizedTitle",
        p."publishedDateShanghai"
      FROM "Publication" p
      JOIN "PublicationSource" s ON s.id = p."sourceId"
      JOIN "PublicationRevision" cr ON cr.id = p."currentRevisionId"
      WHERE ${whereSql}
    )
    SELECT count(*)::bigint AS total
    FROM (SELECT DISTINCT "normalizedTitle", "publishedDateShanghai" FROM filtered) groups
  `);

  return {
    ids: rows.map((row) => row.id),
    groupSizeById: new Map(rows.map((row) => [row.id, Number(row.groupSize)])),
    total: Number(total),
  };
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

async function readBodyMarkdown(revision: PublicPublicationRevision) {
  const link = revision.objectLinks.find((candidate) => {
    const object = mapObjectLink(candidate);
    return object?.kind === "body_markdown";
  });
  const object = link?.object;
  if (!link || !object || object.size > PUBLICATION_BODY_MARKDOWN_MAX_BYTES) {
    return null;
  }

  const bucket = requirePublicationsBucket();
  const stored = await bucket.get(object.r2Key);
  if (!stored?.body || stored.size !== object.size) return null;

  const reader = stored.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > PUBLICATION_BODY_MARKDOWN_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return null;
  }

  if (total !== object.size) return null;

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
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

  if (input.filters?.fold) {
    const folded = await queryFoldedPublicationPage(input.filters, pagination);
    const records =
      folded.ids.length === 0
        ? []
        : await prisma.publication.findMany({
            where: { id: { in: folded.ids } },
            select: PUBLICATION_LIST_SELECT,
          });
    const recordById = new Map(records.map((record) => [record.id, record]));
    const data = folded.ids.flatMap((id) => {
      const record = recordById.get(id);
      const mapped = record ? mapPublication(record) : null;
      if (!mapped) return [];
      const groupSize = folded.groupSizeById.get(id) ?? 1;
      return [
        groupSize > 1
          ? { ...mapped, foldGroup: { siblingCount: groupSize - 1 } }
          : mapped,
      ];
    });

    return {
      data,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: folded.total,
        totalPages: Math.max(1, Math.ceil(folded.total / pagination.pageSize)),
      },
    };
  }

  const where = publicPublicationWhere(input.filters);
  const [records, total] = await prisma.$transaction([
    prisma.publication.findMany({
      where,
      select: PUBLICATION_LIST_SELECT,
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

async function findAlsoPublishedIn(record: {
  id: string;
  normalizedTitle: string;
  publishedDateShanghai: Date;
}) {
  const siblings = await prisma.publication.findMany({
    where: {
      ...publicPublicationWhere(),
      id: { not: record.id },
      normalizedTitle: record.normalizedTitle,
      publishedDateShanghai: record.publishedDateShanghai,
    },
    select: {
      id: true,
      canonicalUrl: true,
      publishedAt: true,
      source: { select: { id: true, name: true, organizationLevel: true } },
    },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: 20,
  });

  return siblings.map(
    (sibling) =>
      ({
        id: sibling.id,
        canonicalUrl: sibling.canonicalUrl,
        source: sibling.source,
        publishedAt: sibling.publishedAt,
      }) satisfies PublicPublicationSibling,
  );
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
      bodyMarkdown: await readBodyMarkdown(revision),
      extractionMethod: revision.extractionMethod,
      classifierVersion: revision.classifierVersion,
      objects: publication.objects,
    },
    alsoPublishedIn: await findAlsoPublishedIn(record),
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
