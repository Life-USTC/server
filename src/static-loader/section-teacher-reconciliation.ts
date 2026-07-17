import type { Prisma } from "../generated/prisma-node/client";

type SectionTeacherTransaction = Pick<
  Prisma.TransactionClient,
  "$executeRawUnsafe" | "sectionTeacher"
>;

type ResolvedSectionTeacher = {
  sectionId: number;
  teacherId: number;
};

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function reconcileSectionTeacherRows(
  tx: SectionTeacherTransaction,
  resolved: readonly ResolvedSectionTeacher[],
  sectionDbIds: readonly number[],
): Promise<void> {
  for (const sectionChunk of chunks(sectionDbIds, 1000)) {
    await tx.$executeRawUnsafe(
      `DELETE FROM "_SectionTeachers" WHERE "A" IN (${sectionChunk.join(",")})`,
    );
  }

  for (const chunk of chunks(resolved, 1000)) {
    const values = chunk
      .map((pair) => `(${pair.sectionId},${pair.teacherId})`)
      .join(",");
    await tx.$executeRawUnsafe(
      `INSERT INTO "_SectionTeachers" ("A","B") VALUES ${values} ON CONFLICT DO NOTHING`,
    );
  }

  const now = new Date();
  for (const chunk of chunks(resolved, 1000)) {
    const tuples = chunk
      .map((pair) => `(${pair.sectionId},${pair.teacherId})`)
      .join(",");
    await tx.$executeRawUnsafe(
      `UPDATE "SectionTeacher" SET "retiredAt" = NULL, "updatedAt" = $1 WHERE ("sectionId","teacherId") IN (${tuples})`,
      now,
    );
  }

  if (resolved.length > 0) {
    await tx.sectionTeacher.createMany({
      data: resolved.map((pair) => ({
        sectionId: pair.sectionId,
        teacherId: pair.teacherId,
        retiredAt: null,
      })),
      skipDuplicates: true,
    });
  }

  for (const sectionChunk of chunks(sectionDbIds, 1000)) {
    const sectionIds = sectionChunk.join(",");
    await tx.$executeRawUnsafe(
      `UPDATE "SectionTeacher" SET "retiredAt" = $1, "updatedAt" = $2 WHERE "sectionId" IN (${sectionIds}) AND "retiredAt" IS NULL AND ("sectionId","teacherId") NOT IN (SELECT "A","B" FROM "_SectionTeachers" WHERE "A" IN (${sectionIds}))`,
      now,
      now,
    );
  }
}
