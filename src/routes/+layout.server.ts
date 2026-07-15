import {
  buildLayoutCopy,
  layoutUserSummary,
} from "@/lib/shell/layout-server-data";
import { buildSocialMetadata } from "@/lib/social-metadata";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const copy = buildLayoutCopy(locals.locale);

  return {
    locale: locals.locale,
    copy,
    socialMetadata: buildSocialMetadata({
      canonicalPath: url.pathname,
      description: copy.description,
      imageAlt: copy.metadata.social.imageAlt,
      locale: locals.locale,
      origin: url.origin,
      title: copy.metadata.title,
    }),
    user: layoutUserSummary(locals.authUser),
  };
};
