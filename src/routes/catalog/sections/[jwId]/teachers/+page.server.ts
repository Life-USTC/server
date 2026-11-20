import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params, url }) => {
  redirect(
    308,
    `/catalog/sections/${params.jwId}/introduction${url.search}#teachers`,
  );
};
