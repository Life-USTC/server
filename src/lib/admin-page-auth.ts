import { error, redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";

export async function getPrismaClient() {
  const { prisma } = await import("@/lib/db/prisma");
  return prisma;
}

export async function requireAdminPage(request: Request) {
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    const url = new URL(request.url);
    throw redirect(303, buildSignInPageUrl(`${url.pathname}${url.search}`));
  }

  const prisma = await getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isAdmin: true, name: true, username: true },
  });

  if (!user?.isAdmin) error(404, "Not found");
  return user;
}
