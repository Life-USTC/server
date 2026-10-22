import { listRoomMapBuildings } from "@/features/rooms/server/room-map-service";
import { getMessages } from "@/i18n/messages.server";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const [layoutData, messages, buildings] = await Promise.all([
    parent(),
    getMessages(locals.locale),
    listRoomMapBuildings(),
  ]);
  const copy = messages.roomMap;
  const initialRoom = url.searchParams.get("room")?.trim() ?? "";

  return {
    buildings,
    copy,
    initialRoom,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: copy.subtitle,
      title: `${copy.title} - Life@USTC`,
    }),
  };
};
