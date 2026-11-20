import { error } from "@sveltejs/kit";
import {
  getDemoRoomMap,
  getDemoRoomMapCopy,
} from "@/features/demo/server/demo-rooms";
import { getDemoView } from "@/features/demo/server/demo-workspace";
import { roomCodeSchema } from "@/features/rooms/server/room-map-schema";
import { getRoomMapForValidatedCode } from "@/features/rooms/server/room-map-service";
import { getMessages } from "@/i18n/messages.server";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params, parent }) => {
  const parsed = roomCodeSchema.safeParse(params.code);
  if (!parsed.success) error(400);
  const map = locals.demo
    ? getDemoRoomMap(params.code, locals.locale)
    : await getRoomMapForValidatedCode(parsed.data);
  if (!map) error(404);
  const copy = locals.demo
    ? getDemoRoomMapCopy(locals.locale)
    : (await getMessages(locals.locale)).roomMap;
  return {
    map,
    copy,
    demo: locals.demo ? getDemoView(locals.demo, locals.locale) : null,
    socialMetadata: updateSocialMetadata((await parent()).socialMetadata, {
      title: `${map.code} - Life@USTC`,
    }),
  };
};
