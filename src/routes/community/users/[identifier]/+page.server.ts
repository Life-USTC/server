import { error } from "@sveltejs/kit";
import { getProfileCopy } from "@/features/profile/lib/profile-copy";
import {
  getUserProfileById,
  getUserProfileByUsername,
} from "@/features/profile/server/user-profile-page-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const copy = getProfileCopy(locals.locale);
  const identifier = params.identifier.trim();
  const profile = identifier
    ? ((await getUserProfileByUsername(identifier.toLowerCase())) ??
      (await getUserProfileById(identifier)))
    : null;
  if (!profile) error(404, copy.common.userNotFound);
  return {
    ...profile,
    copy,
    locale: locals.locale,
  };
};
