import {
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS,
  type PublicationSourceOrganizationLevel,
} from "@/features/publications/lib/publication-source-levels";
import { prisma } from "@/lib/db/prisma";
import { publicPublicationWhere } from "./publication-public-read-service";

/**
 * A registered source as the public directory shows it (issue #1069).
 *
 * `hosts` is the source's allowed-host list — the hostnames its canonical
 * URLs must live under — which is what makes a source identifiable to a
 * reader. Blocked hosts, seed URLs and crawler tuning stay internal.
 */
export type PublicPublicationSourceSummary = {
  id: string;
  name: string;
  organizationLevel: PublicationSourceOrganizationLevel;
  hosts: string[];
  publicationCount: number;
  lastPublishedAt: Date | null;
};

export type PublicPublicationSourceGroup = {
  organizationLevel: PublicationSourceOrganizationLevel;
  sourceCount: number;
  publicationCount: number;
  sources: PublicPublicationSourceSummary[];
};

export type PublicPublicationSourceDirectory = {
  groups: PublicPublicationSourceGroup[];
  totals: {
    sourceCount: number;
    publicationCount: number;
  };
};

/** A selectable source for the list page's filter. */
export type PublicPublicationSourceOption = {
  id: string;
  name: string;
  organizationLevel: PublicationSourceOrganizationLevel;
};

/**
 * The sources the list page offers as filter options.
 *
 * Deliberately a plain registry read with no publication aggregate: this runs
 * on every /news render, and the directory page already owns the per-source
 * counts. Same visibility rule as the directory, so a source can be picked
 * from either place.
 */
export async function listPublicationSourceOptions(): Promise<
  PublicPublicationSourceOption[]
> {
  return prisma.publicationSource.findMany({
    where: { enabled: true, discoveryOnly: false },
    select: { id: true, name: true, organizationLevel: true },
    orderBy: [{ organizationLevel: "asc" }, { name: "asc" }],
  });
}

/**
 * The public source registry, grouped by organization level.
 *
 * Only enabled sources are listed, and discovery-only sources are excluded
 * because ingestion refuses their items outright — they can never have a
 * readable article, so listing them would show a permanent zero. An enabled
 * source with no published article yet is still listed: the directory is the
 * registry, not a leaderboard.
 *
 * Counts come from the same `publicPublicationWhere()` the list and detail
 * reads use, so a source's count always matches what `/news?source=<id>`
 * actually shows.
 */
export async function listPublicationSourceDirectory(): Promise<PublicPublicationSourceDirectory> {
  const [sources, aggregates] = await Promise.all([
    prisma.publicationSource.findMany({
      where: { enabled: true, discoveryOnly: false },
      select: {
        id: true,
        name: true,
        organizationLevel: true,
        allowedHosts: true,
      },
    }),
    prisma.publication.groupBy({
      by: ["sourceId"],
      where: publicPublicationWhere(),
      _count: { _all: true },
      _max: { publishedAt: true },
    }),
  ]);

  const aggregateBySourceId = new Map(
    aggregates.map((aggregate) => [aggregate.sourceId, aggregate]),
  );

  const summaries = sources.map((source) => {
    const aggregate = aggregateBySourceId.get(source.id);
    return {
      id: source.id,
      name: source.name,
      organizationLevel: source.organizationLevel,
      hosts: source.allowedHosts,
      publicationCount: aggregate?._count._all ?? 0,
      lastPublishedAt: aggregate?._max.publishedAt ?? null,
    } satisfies PublicPublicationSourceSummary;
  });

  const byLevel = new Map<
    PublicationSourceOrganizationLevel,
    PublicPublicationSourceSummary[]
  >();
  for (const summary of summaries) {
    const bucket = byLevel.get(summary.organizationLevel);
    if (bucket) bucket.push(summary);
    else byLevel.set(summary.organizationLevel, [summary]);
  }

  // Ordered by the enum's declaration order (university first), which is the
  // directory's display order; a level with no registered source is omitted
  // rather than rendered as an empty group.
  const groups = PUBLICATION_SOURCE_ORGANIZATION_LEVELS.flatMap((level) => {
    const bucket = byLevel.get(level);
    if (!bucket || bucket.length === 0) return [];
    bucket.sort(
      (left, right) =>
        right.publicationCount - left.publicationCount ||
        left.name.localeCompare(right.name, "zh-Hans-CN") ||
        left.id.localeCompare(right.id),
    );
    return [
      {
        organizationLevel: level,
        sourceCount: bucket.length,
        publicationCount: bucket.reduce(
          (total, source) => total + source.publicationCount,
          0,
        ),
        sources: bucket,
      } satisfies PublicPublicationSourceGroup,
    ];
  });

  return {
    groups,
    totals: {
      sourceCount: summaries.length,
      publicationCount: groups.reduce(
        (total, group) => total + group.publicationCount,
        0,
      ),
    },
  };
}
