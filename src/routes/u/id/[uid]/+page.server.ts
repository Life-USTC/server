import { error } from "@sveltejs/kit";
import { getProfileCopy } from "@/features/profile/lib/profile-copy";
import { getUserProfileById } from "@/features/profile/server/user-profile-page-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const copy = getProfileCopy(locals.locale);
  const profile = await getUserProfileById(params.uid);
  if (!profile) error(404, copy.common.userNotFound);
  return {
    ...profile,
    copy,
    locale: locals.locale,
  };
};
