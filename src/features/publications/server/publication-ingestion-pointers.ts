import { Prisma } from "@/generated/prisma/client";

export type PendingPublicationPointers = Map<
  string,
  { revisionId: string; updatedAt: Date }
>;

/** Only newly created rows are deferred; item decisions use batch state. */
export async function flushPublicationPointers(
  tx: Prisma.TransactionClient,
  pointers: PendingPublicationPointers,
) {
  if (pointers.size === 0) return;
  const values = [...pointers].map(
    ([publicationId, { revisionId, updatedAt }]) =>
      Prisma.sql`(${publicationId}::text, ${revisionId}::text, ${updatedAt}::timestamp)`,
  );
  // Raw SQL does not apply Prisma's @updatedAt. Use each item's captured time,
  // not the flush time, so later items do not move an earlier row's timestamp.
  const count = await tx.$executeRaw(Prisma.sql`
    UPDATE "Publication" AS publication
    SET "currentRevisionId" = pending.revision_id,
        "updatedAt" = pending.updated_at
    FROM (VALUES ${Prisma.join(values)}) AS pending(publication_id, revision_id, updated_at)
    WHERE publication.id = pending.publication_id
  `);
  if (count !== pointers.size) {
    throw new Error("Not all new publication revision pointers were written");
  }
}
