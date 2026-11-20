import { Prisma } from "../generated/prisma-node/client";
import type { CatalogProfiles } from "./catalog-profiles";
import { chunks } from "./database-writes";

/** Aliases and codes owned by a different course cannot claim a new identity. */
export async function findOfficialCourseConflicts(
  tx: Prisma.TransactionClient,
  profiles: CatalogProfiles,
) {
  const conflicts = new Set<number>();
  for (const batch of chunks(profiles.courses, 500)) {
    const keys = batch.map(
      ({ jwId, code }) => Prisma.sql`(${jwId}::int, ${code}::text)`,
    );
    const rows = await tx.$queryRaw<{ jwId: number }[]>`
      SELECT p.id AS "jwId" FROM (VALUES ${Prisma.join(keys)}) AS p(id, code)
      WHERE EXISTS (SELECT FROM "CourseAlias" WHERE "jwId" = p.id)
         OR EXISTS (SELECT FROM "Course" WHERE code = p.code AND "jwId" <> p.id)
    `;
    for (const { jwId } of rows) conflicts.add(jwId);
  }
  return conflicts;
}

async function writeMatchedProfiles(
  tx: Prisma.TransactionClient,
  table: "Course" | "Section",
  candidates: Prisma.Sql,
) {
  const [counts] = await tx.$queryRaw<
    { matched: number; missing: number; conflicts: number }[]
  >`
    WITH candidates AS (${candidates}), updated AS (
      UPDATE ${Prisma.raw(`"${table}"`)} AS target SET "officialProfile" = c.payload
      FROM candidates c WHERE target.id = c.id AND NOT c.conflict
        AND target."officialProfile" IS DISTINCT FROM c.payload
    )
    SELECT count(id) FILTER (WHERE NOT conflict)::int AS matched,
           count(*) FILTER (WHERE id IS NULL AND NOT conflict)::int AS missing,
           count(*) FILTER (WHERE conflict)::int AS conflicts
    FROM candidates
  `;
  return counts;
}

export async function upsertOfficialProfiles(
  tx: Prisma.TransactionClient,
  profiles: CatalogProfiles,
  conflicts: ReadonlySet<number>,
) {
  const stats = {
    courses: 0,
    sections: 0,
    courseIdentityConflicts: profiles.courseIdentityConflicts + conflicts.size,
    courseMissing: 0,
    sectionIdentityConflicts: profiles.sectionIdentityConflicts,
    sectionMissing: 0,
  };
  const courses = profiles.courses.filter(({ jwId }) => !conflicts.has(jwId));
  for (const batch of chunks(courses, 250)) {
    const values = batch.map(
      ({ jwId, payloadJson }) =>
        Prisma.sql`(${jwId}::int, ${payloadJson}::jsonb)`,
    );
    const counts = await writeMatchedProfiles(
      tx,
      "Course",
      Prisma.sql`
      SELECT c.id, p.payload, false AS conflict
      FROM (VALUES ${Prisma.join(values)}) AS p(jw_id, payload)
      LEFT JOIN "Course" c ON c."jwId" = p.jw_id
    `,
    );
    stats.courses += counts.matched;
    stats.courseMissing += counts.missing;
  }
  for (const batch of chunks(profiles.sections, 250)) {
    const values = batch.map(
      ({ jwId, code, courseJwId, semesterJwId, payloadJson }) =>
        Prisma.sql`(${jwId}::int, ${code}::text, ${courseJwId}::int, ${semesterJwId}::int, ${payloadJson}::jsonb)`,
    );
    const counts = await writeMatchedProfiles(
      tx,
      "Section",
      Prisma.sql`
      SELECT s.id, p.payload,
        (s.id IS NOT NULL AND (
          s."courseId" IS DISTINCT FROM c.id OR term.id IS NULL OR s."semesterId" IS DISTINCT FROM term.id
        )) OR EXISTS (
          SELECT FROM "Section" owner
          WHERE owner."semesterId" = term.id AND owner.code = p.code AND owner."jwId" <> p.jw_id
        ) AS conflict
      FROM (VALUES ${Prisma.join(values)}) AS p(jw_id, code, course_id, semester_id, payload)
      LEFT JOIN "Section" s ON s."jwId" = p.jw_id
      LEFT JOIN "Semester" term ON term."jwId" = p.semester_id
      LEFT JOIN "Course" c ON c."jwId" = p.course_id
    `,
    );
    stats.sections += counts.matched;
    stats.sectionMissing += counts.missing;
    stats.sectionIdentityConflicts += counts.conflicts;
  }
  return stats;
}
