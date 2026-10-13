import { serializeDescriptionRecord } from "@/features/descriptions/server/description-payload";
import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";

/** Editable descriptions and lifecycle state must stay live across core-cache hits. */
export async function loadSectionPageMutableData(jwId: number) {
  const row = await withRuntimeDatabaseAdapter("app", async (adapter) => {
    const result = await adapter.queryRaw({
      sql: `SELECT s."retiredAt", d."id", d."content", d."updatedAt", d."lastEditedAt",
                   u."id", u."name", u."username", u."image"
            FROM "Section" s
            LEFT JOIN "Description" d ON d."sectionId" = s."id"
            LEFT JOIN "User" u ON u."id" = d."lastEditedById"
            WHERE s."jwId" = $1`,
      args: [jwId],
      argTypes: [{ scalarType: "int", arity: "scalar" }],
    });
    return result.rows[0] as
      | [
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
          string | null,
        ]
      | undefined;
  });
  const [
    retiredAt,
    id,
    content,
    updatedAt,
    lastEditedAt,
    editorId,
    name,
    username,
    image,
  ] = row ?? [];
  return {
    description: serializeDescriptionRecord(
      id
        ? {
            id,
            content,
            updatedAt,
            lastEditedAt,
            lastEditedBy: editorId
              ? {
                  id: editorId,
                  name: name ?? null,
                  username: username ?? null,
                  image: image ?? null,
                }
              : null,
          }
        : null,
    ),
    retiredAt: retiredAt ? new Date(retiredAt).toISOString() : null,
  };
}
