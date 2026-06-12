import { error } from "@sveltejs/kit";
import { getUserProfileById } from "@/lib/page-data";
import { getProfileCopy } from "@/lib/profile-copy";
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
