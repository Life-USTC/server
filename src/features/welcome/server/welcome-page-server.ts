import { redirect, type ServerLoadEvent } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { getSessionFromHeaders } from "@/lib/auth/core";
import { findCurrentSemester } from "@/lib/current-semester";
import { completeWelcomeProfile } from "./welcome-complete-action";
import { getWelcomeCopy } from "./welcome-page-copy";

export const loadWelcomePage = async ({
  locals,
  request,
  url,
}: ServerLoadEvent) => {
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    throw redirect(303, buildSignInPageUrl(`${url.pathname}${url.search}`));
  }

  const { prisma } = await import("@/lib/db/prisma");
  const [user, semesters, currentSemester] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        profilePictures: true,
      },
    }),
    prisma.semester.findMany({
      select: { id: true, nameCn: true },
      orderBy: { jwId: "desc" },
      take: 20,
    }),
    findCurrentSemester(prisma.semester, new Date()),
  ]);

  if (!user) {
    throw redirect(303, buildSignInPageUrl(`${url.pathname}${url.search}`));
  }

  if (user.name && user.username) {
    throw redirect(303, "/");
  }

  return {
    user,
    semesters,
    defaultSemesterId: currentSemester?.id ?? null,
    locale: locals.locale,
    copy: getWelcomeCopy(locals.locale),
  };
};

export const welcomeActions = {
  complete: completeWelcomeProfile,
};
