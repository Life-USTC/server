import { Prisma } from "../generated/prisma-node/client";
import type { CatalogProfiles } from "./catalog-profiles";
import { chunks } from "./database-writes";

/** A code owned by a different record or an explicit alias is not a fresh
 * identity. A rename for the same ID is safe when no other row claims it. */
export async function findOfficialCourseConflicts(
  tx: Prisma.TransactionClient,
  profiles: CatalogProfiles,
): Promise<Set<number>> {
  const conflicts = new Set<number>();
  for (const batch of chunks(profiles.courses, 500)) {
    const profilesByCode = new Map(
      batch.map((profile) => [profile.code, profile.jwId]),
    );
    const codeOwners = await tx.course.findMany({
      where: { code: { in: batch.map((profile) => profile.code) } },
      select: { jwId: true, code: true },
    });
    for (const owner of codeOwners) {
      const id = profilesByCode.get(owner.code);
      if (id != null && owner.jwId !== id) conflicts.add(id);
    }
    const aliases = await tx.courseAlias.findMany({
      where: { jwId: { in: batch.map((profile) => profile.jwId) } },
      select: { jwId: true },
    });
    for (const alias of aliases) conflicts.add(alias.jwId);
  }
  return conflicts;
}

type Update = { id: number; payloadJson: string };

async function writeProfiles(
  tx: Prisma.TransactionClient,
  target: "Course" | "Section",
  updates: Update[],
): Promise<void> {
  const table =
    target === "Course" ? Prisma.sql`"Course"` : Prisma.sql`"Section"`;
  for (const batch of chunks(updates, 250)) {
    const values = batch.map(
      ({ id, payloadJson }) =>
        Prisma.sql`(${id}::integer, ${payloadJson}::jsonb)`,
    );
    await tx.$executeRaw`
      UPDATE ${table} AS t
      SET "officialProfile" = incoming.payload
      FROM (VALUES ${Prisma.join(values)}) AS incoming(id, payload)
      WHERE t.id = incoming.id AND t."officialProfile" IS DISTINCT FROM incoming.payload
    `;
  }
}

export async function upsertOfficialProfiles(
  tx: Prisma.TransactionClient,
  profiles: CatalogProfiles,
  blocked?: ReadonlySet<number>,
) {
  const conflicts =
    blocked ?? (await findOfficialCourseConflicts(tx, profiles));
  const stats = {
    courses: 0,
    sections: 0,
    courseIdentityConflicts: profiles.courseIdentityConflicts,
    courseMissing: 0,
    sectionIdentityConflicts: profiles.sectionIdentityConflicts,
    sectionMissing: 0,
  };
  for (const batch of chunks(profiles.courses, 500)) {
    const candidates = batch.filter((profile) => !conflicts.has(profile.jwId));
    stats.courseIdentityConflicts += batch.length - candidates.length;
    if (candidates.length === 0) continue;
    const rows = await tx.course.findMany({
      where: { jwId: { in: candidates.map((profile) => profile.jwId) } },
      select: { id: true, jwId: true },
    });
    const ids = new Map(rows.map((row) => [row.jwId, row.id]));
    const updates = candidates.flatMap((profile) => {
      const id = ids.get(profile.jwId);
      return id == null ? [] : [{ id, payloadJson: profile.payloadJson }];
    });
    stats.courses += updates.length;
    stats.courseMissing += candidates.length - updates.length;
    await writeProfiles(tx, "Course", updates);
  }

  for (const batch of chunks(profiles.sections, 500)) {
    const rows = await tx.section.findMany({
      where: {
        OR: [
          { jwId: { in: batch.map((profile) => profile.jwId) } },
          {
            code: { in: batch.map((profile) => profile.code) },
            semester: {
              jwId: {
                in: [...new Set(batch.map((profile) => profile.semesterJwId))],
              },
            },
          },
        ],
      },
      select: {
        id: true,
        jwId: true,
        code: true,
        course: { select: { jwId: true } },
        semester: { select: { jwId: true } },
      },
    });
    const byId = new Map(rows.map((row) => [row.jwId, row]));
    const owners = new Map<string, Set<number>>();
    for (const row of rows) {
      if (!row.semester) continue;
      const key = `${row.semester.jwId}:${row.code}`;
      const ids = owners.get(key) ?? new Set<number>();
      ids.add(row.jwId);
      owners.set(key, ids);
    }
    const updates: Update[] = [];
    for (const profile of batch) {
      const target = byId.get(profile.jwId);
      const codeOwners = owners.get(`${profile.semesterJwId}:${profile.code}`);
      if (
        codeOwners != null &&
        (codeOwners.size > 1 || !codeOwners.has(profile.jwId))
      ) {
        stats.sectionIdentityConflicts++;
        continue;
      }
      if (!target) {
        stats.sectionMissing++;
        continue;
      }
      if (
        target.course.jwId !== profile.courseJwId ||
        target.semester?.jwId !== profile.semesterJwId
      ) {
        stats.sectionIdentityConflicts++;
        continue;
      }
      updates.push({ id: target.id, payloadJson: profile.payloadJson });
    }
    stats.sections += updates.length;
    await writeProfiles(tx, "Section", updates);
  }
  return stats;
}
