import { createHash } from "node:crypto";
import type { Prisma } from "../generated/prisma-node/client";
import { STATIC_IMPORT_TRANSFORM_REVISION } from "./import-state";

/** Hash mapped values, not SQLite row IDs, fetch receipts or timestamps. */
export function importGroupDigest(
  collections: readonly (readonly unknown[])[],
): string {
  const hash = createHash("sha256");
  for (const rows of collections) {
    hash.update("[");
    for (const row of rows.map((row) => JSON.stringify(row)).sort())
      hash.update(row).update("\n");
    hash.update("]");
  }
  return hash.digest("hex");
}

export async function changedImportGroups(
  tx: Prisma.TransactionClient,
  groups: ReadonlyMap<string, string>,
): Promise<Set<string>> {
  const previous = await tx.staticImportState.findMany({
    where: {
      id: { in: [...groups.keys()] },
      transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
    },
    select: { id: true, snapshotSha256: true },
  });
  const changed = new Set(groups.keys());
  for (const row of previous)
    if (groups.get(row.id) === row.snapshotSha256) changed.delete(row.id);
  return changed;
}

/** Older importers only updated the global row. Rebuild the section cache
 * generation once when resuming after such an import. */
export async function previousSectionRevisionTracked(
  tx: Prisma.TransactionClient,
): Promise<boolean> {
  const states = await tx.staticImportState.findMany({
    where: { id: { in: ["global", "section-page-core-source"] } },
    select: { id: true, snapshotSha256: true, transformRevision: true },
  });
  const global = states.find((row) => row.id === "global");
  const source = states.find((row) => row.id === "section-page-core-source");
  return Boolean(
    global &&
      source &&
      global.snapshotSha256 === source.snapshotSha256 &&
      global.transformRevision === source.transformRevision,
  );
}

export function semesterImportDigests(
  sections: readonly { jwId: number; semesterCode: number }[],
  examSemesters: ReadonlySet<number>,
  collections: readonly (readonly (
    | { lessonJwId: number }
    | { sectionJwId: number }
  )[])[],
): Map<string, string> {
  const terms = new Map(sections.map((row) => [row.jwId, row.semesterCode]));
  const grouped = new Map<number, unknown[][]>();
  for (const section of sections) {
    if (!grouped.has(section.semesterCode))
      grouped.set(
        section.semesterCode,
        Array.from({ length: collections.length + 1 }, () => []),
      );
    grouped.get(section.semesterCode)?.[0]?.push(section);
  }
  for (const [index, rows] of collections.entries()) {
    for (const row of rows) {
      const term = terms.get(
        "lessonJwId" in row ? row.lessonJwId : row.sectionJwId,
      );
      if (term === undefined)
        throw new Error("Import group references an unmapped section");
      grouped.get(term)?.[index + 1]?.push(row);
    }
  }
  return new Map(
    [...grouped].map(([term, rows]) => [
      `semester:${term}`,
      importGroupDigest([...rows, [examSemesters.has(term)]]),
    ]),
  );
}
