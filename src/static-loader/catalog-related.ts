import { createHash, type Hash } from "node:crypto";
import type { Prisma } from "../generated/prisma-node/client";
import { loadOfficialCourseGroups } from "./catalog-related-groups";
import { loadOfficialStudyPlans } from "./catalog-related-programs";
import {
  array,
  code,
  countedTables,
  integer,
  json,
  jsonDocument,
  object,
  type RelatedMetadata,
  type RelatedSnapshot,
  requireCatalogValue,
  unique,
} from "./catalog-related-values";
import { chunks } from "./database-writes";

const SUBSTITUTIONS = "catalog_teach_course_substitute_pool_list";

function memberCodes(value: unknown, label: string) {
  const codes = array(value, label).map((member) =>
    code(object(member, label).code, `${label}.code`),
  );
  requireCatalogValue(codes.length > 0, `${label} must be nonempty`);
  return codes;
}

function loadSubstitutions(
  snapshot: RelatedSnapshot,
  metadata: RelatedMetadata,
) {
  if (!countedTables(snapshot, metadata, [SUBSTITUTIONS])) return;
  const rules = unique(
    snapshot.iterateAll(SUBSTITUTIONS),
    (row) => {
      const jwId = integer(row.id, "substitution ID");
      const payload = object(
        json(row.payload_json, SUBSTITUTIONS),
        "substitution payload",
      );
      requireCatalogValue(payload.id === jwId, `substitution ${jwId} identity`);
      return {
        jwId,
        originalCodes: memberCodes(payload.originalCourses, "original courses"),
        substituteCodes: memberCodes(
          payload.substituteCourses,
          "substitute courses",
        ),
        payload: jsonDocument(payload),
      };
    },
    (rule) => rule.jwId,
  );
  requireCatalogValue(
    rules.size > 0,
    "complete substitution pool must be nonempty",
  );
  return [...rules.values()];
}

export function loadRelatedCatalog(
  snapshot: RelatedSnapshot,
  metadata: RelatedMetadata,
) {
  return {
    substitutions: loadSubstitutions(snapshot, metadata),
    groups: loadOfficialCourseGroups(snapshot, metadata),
    studyPlans: loadOfficialStudyPlans(snapshot, metadata),
  };
}

export type RelatedCatalog = ReturnType<typeof loadRelatedCatalog>;

async function insertBatches<Row>(
  rows: Row[],
  size: number,
  create: (batch: Row[]) => PromiseLike<unknown>,
) {
  for (const batch of chunks(rows, size)) await create(batch);
}

function digestTable<Row>(
  rows: readonly Row[],
  key: (row: Row) => string | number,
): (hash: Hash) => void {
  return (hash) => {
    hash.update(`${rows.length}\n`);
    const sorted = rows
      .map((row) => ({ row, key: String(key(row)) }))
      .sort((left, right) =>
        left.key < right.key ? -1 : Number(left.key > right.key),
      );
    for (const { row } of sorted) hash.update(`${JSON.stringify(row)}\n`);
  };
}

function sourceDigest(...tables: Array<(hash: Hash) => void>) {
  const hash = createHash("sha256").update("official-related-catalog-v1\n");
  for (const table of tables) table(hash);
  return hash.digest("hex");
}

async function replaceIfChanged(
  tx: Prisma.TransactionClient,
  source: string,
  digest: string,
  replace: () => Promise<void>,
) {
  const previous = await tx.officialRelatedCatalogState.findUnique({
    where: { source },
  });
  if (previous?.digest === digest) return;
  await replace();
  await tx.officialRelatedCatalogState.upsert({
    where: { source },
    create: { source, digest },
    update: { digest },
  });
}

/** Use the existing importer transaction to replace each complete source atomically. */
export async function replaceRelatedCatalog(
  tx: Prisma.TransactionClient,
  { substitutions, groups, studyPlans }: RelatedCatalog,
) {
  if (substitutions) {
    await replaceIfChanged(
      tx,
      "substitutions",
      sourceDigest(digestTable(substitutions, (row) => row.jwId)),
      async () => {
        await tx.courseSubstitutionRule.deleteMany();
        await insertBatches(substitutions, 250, (data) =>
          tx.courseSubstitutionRule.createMany({ data }),
        );
      },
    );
  }
  if (groups) {
    const digest = sourceDigest(
      digestTable(groups.sources, (row) =>
        JSON.stringify([row.sourceKind, row.sourceId]),
      ),
      digestTable(groups.entries, (row) =>
        JSON.stringify([row.routeKey, row.sourcePosition]),
      ),
      digestTable(groups.paths, (row) =>
        JSON.stringify([row.sourceKind, row.sourceId, row.path]),
      ),
      digestTable(groups.members, (row) =>
        JSON.stringify([row.sourceKind, row.sourceId, row.path, row.position]),
      ),
    );
    await replaceIfChanged(tx, "course-groups", digest, async () => {
      // Dependent route entries, group paths and memberships cascade from the source.
      await tx.officialCourseGroupSource.deleteMany();
      await insertBatches(groups.sources, 25, (data) =>
        tx.officialCourseGroupSource.createMany({ data }),
      );
      await insertBatches(groups.entries, 500, (data) =>
        tx.officialCourseGroupEntry.createMany({ data }),
      );
      await insertBatches(groups.paths, 500, (data) =>
        tx.officialCourseGroupPath.createMany({ data }),
      );
      await insertBatches(groups.members, 500, (data) =>
        tx.officialCourseGroupMember.createMany({ data }),
      );
    });
  }
  if (studyPlans) {
    const digest = sourceDigest(
      digestTable([studyPlans.tree], (row) => row.id),
      digestTable(studyPlans.plans, (row) => row.jwId),
      digestTable(studyPlans.modules, (row) => row.jwId),
    );
    await replaceIfChanged(tx, "study-plans", digest, async () => {
      await tx.officialStudyPlanTree.upsert({
        where: { id: studyPlans.tree.id },
        create: studyPlans.tree,
        update: { payload: studyPlans.tree.payload },
      });
      await tx.officialStudyPlan.deleteMany();
      await tx.officialStudyPlanModule.deleteMany();
      await insertBatches(studyPlans.plans, 25, (data) =>
        tx.officialStudyPlan.createMany({ data }),
      );
      await insertBatches(studyPlans.modules, 25, (data) =>
        tx.officialStudyPlanModule.createMany({ data }),
      );
    });
  }
  return {
    substitutions: substitutions?.length,
    groupSources: groups?.sources.length,
    groupPaths: groups?.paths.length,
    groupMembers: groups?.members.length,
    studyPlans: studyPlans?.plans.length,
    publicModules: studyPlans?.modules.length,
  };
}
