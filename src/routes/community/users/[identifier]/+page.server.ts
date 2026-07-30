import { error } from "@sveltejs/kit";
import { getProfileCopy } from "@/features/profile/lib/profile-copy";
import {
  getUserProfileById,
  getUserProfileByUsername,
} from "@/features/profile/server/user-profile-page-data";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params, parent }) => {
  const copy = getProfileCopy(locals.locale);
  const layoutDataPromise = parent();
  const identifier = params.identifier.trim();
  const profile = identifier
    ? ((await getUserProfileByUsername(identifier.toLowerCase())) ??
      (await getUserProfileById(identifier)))
    : null;
  if (!profile) error(404, copy.common.userNotFound);
  const layoutData = await layoutDataPromise;
  const displayName =
    profile.user.name || profile.user.username || copy.publicProfile.idLabel;
  const description =
    locals.locale === "zh-cn"
      ? `${displayName} 的 Life@USTC 公开主页`
      : `${displayName}'s public Life@USTC profile`;

  return {
    ...profile,
    copy,
    locale: locals.locale,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      card: {
        avatarUrl: profile.user.image ?? undefined,
        footer:
          locals.locale === "zh-cn"
            ? "Life@USTC · 校园社区"
            : "Life@USTC · Campus community",
        label:
          locals.locale === "zh-cn" ? "PROFILE · 公开主页" : "PUBLIC PROFILE",
        subtitle:
          locals.locale === "zh-cn"
            ? "公开主页 · 校园社区"
            : "Public profile · Campus community",
        title: displayName,
        username: profile.user.username ?? undefined,
        variant: "profile",
      },
      description,
      title: `${displayName} - Life@USTC`,
    }),
  };
};
