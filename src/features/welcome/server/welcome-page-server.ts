import { redirect, type ServerLoadEvent } from "@sveltejs/kit";
import { getCurrentSemester } from "@/features/catalog/server/academic-metadata-read-model";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { getSessionFromHeaders } from "@/lib/auth/core";
import { resolveWelcomeCallbackUrl } from "./welcome-callback-url";
import { completeWelcomeProfile } from "./welcome-complete-action";
import { getWelcomeCopy } from "./welcome-page-copy";

export const loadWelcomePage = async ({
  locals,
  request,
  url,
}: ServerLoadEvent) => {
  const callbackUrl = resolveWelcomeCallbackUrl(
    url.searchParams.get("callbackUrl"),
  );
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(
        `${url.pathname}?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      ),
    );
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
    getCurrentSemester(new Date()),
  ]);

  if (!user) {
    throw redirect(
      303,
      buildSignInPageUrl(
        `${url.pathname}?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      ),
    );
  }

  if (user.name && user.username) {
    throw redirect(303, callbackUrl);
  }

  return {
    user,
    semesters,
    defaultSemesterId: currentSemester?.id ?? null,
    callbackUrl,
    locale: locals.locale,
    copy: getWelcomeCopy(locals.locale),
  };
};

export const welcomeActions = {
  complete: completeWelcomeProfile,
};
