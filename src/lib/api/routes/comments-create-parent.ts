import { badRequest, notFound } from "@/lib/api/helpers";

type CreateCommentParentPrisma = {
  comment: {
    findUnique: (input: { where: { id: string } }) => Promise<
      | ({
          id: string;
          rootId: string | null;
        } & Record<string, unknown>)
      | null
    >;
  };
};

export async function resolveCreateCommentParent(
  prisma: CreateCommentParentPrisma,
  parentId: string | null | undefined,
  whereTarget: Record<string, unknown>,
) {
  if (!parentId) {
    return { ok: true as const, parentId: null, rootId: null };
  }

  const parent = await prisma.comment.findUnique({
    where: { id: parentId },
  });
  if (!parent) {
    return { ok: false as const, response: notFound("Parent not found") };
  }

  const sameTarget = Object.entries(whereTarget).every(
    ([key, value]) => parent[key as keyof typeof parent] === value,
  );
  if (!sameTarget) {
    return {
      ok: false as const,
      response: badRequest("Parent target mismatch"),
    };
  }

  return {
    ok: true as const,
    parentId: parent.id,
    rootId: parent.rootId ?? parent.id,
  };
}
