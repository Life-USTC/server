import {
  getDemoRoomMapCopy,
  getDemoRoomMapDirectory,
} from "@/features/demo/server/demo-rooms";
import { getDemoView } from "@/features/demo/server/demo-workspace";
import { listRoomMapDirectory } from "@/features/rooms/server/room-map-directory";
import { getMessages } from "@/i18n/messages.server";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  if (locals.demo) {
    const layoutData = await parent();
    const copy = getDemoRoomMapCopy(locals.locale);
    return {
      buildings: getDemoRoomMapDirectory(locals.locale),
      copy,
      initialRoom: url.searchParams.get("room")?.trim() ?? "",
      demo: getDemoView(locals.demo, locals.locale),
      socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
        description: copy.subtitle,
        title: `${copy.title} - Life@USTC`,
      }),
    };
  }
  const [layoutData, messages, buildings] = await Promise.all([
    parent(),
    getMessages(locals.locale),
    listRoomMapDirectory(locals.locale),
  ]);
  const copy = messages.roomMap;
  const initialRoom = url.searchParams.get("room")?.trim() ?? "";

  return {
    buildings,
    demo: null,
    copy,
    initialRoom,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: copy.subtitle,
      title: `${copy.title} - Life@USTC`,
    }),
  };
};
