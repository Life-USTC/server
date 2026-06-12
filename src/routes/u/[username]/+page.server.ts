import { error } from "@sveltejs/kit";
import { getUserProfileByUsername } from "@/lib/page-data";
import { getProfileCopy } from "@/lib/profile-copy";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const copy = getProfileCopy(locals.locale);
  const username = params.username.trim().toLowerCase();
  const profile = username ? await getUserProfileByUsername(username) : null;
  if (!profile) error(404, copy.common.userNotFound);
  return {
    ...profile,
    copy,
    locale: locals.locale,
  };
};
