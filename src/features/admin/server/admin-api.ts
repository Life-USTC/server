export type AdminSession = {
  userId: string;
};

export async function resolveAdminByUserId(
  userId: string | null | undefined,
): Promise<AdminSession | null> {
  if (!userId) return null;

  const { prisma } = await import("@/lib/db/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isAdmin: true },
  });

  if (!user?.isAdmin) {
    return null;
  }

  return { userId: user.id };
}
