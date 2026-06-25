import { prisma } from "@/lib/db/prisma";

export type AdminSession = {
  userId: string;
};

export async function resolveAdminByUserId(
  userId: string | null | undefined,
): Promise<AdminSession | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isAdmin: true },
  });

  if (!user?.isAdmin) {
    return null;
  }

  return { userId: user.id };
}
