import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const layoutData = await event.parent();
  return {
    copy: layoutData.copy.globalSearch,
  };
};
