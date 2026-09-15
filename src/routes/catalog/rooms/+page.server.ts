import { getMessages } from "@/i18n/messages.server";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const [layoutData, messages] = await Promise.all([
    parent(),
    getMessages(locals.locale),
  ]);
  const copy = messages.roomMap;
  const initialRoom = url.searchParams.get("room")?.trim() ?? "";

  return {
    copy,
    initialRoom,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      card: {
        label: locals.locale === "zh-cn" ? "CATALOG · 教室" : "CLASSROOM MAP",
      },
      description: copy.subtitle,
      title: `${copy.title} - Life@USTC`,
    }),
  };
};
