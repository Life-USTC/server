import { isViewerIndependentPublicPath } from "@/lib/cloudflare/public-ssr-gateway";
import {
  buildLayoutCopy,
  layoutUserSummary,
} from "@/lib/shell/layout-server-data";
import { isPublicNavigationPath } from "@/lib/shell/public-navigation-contract";
import { buildSocialMetadata } from "@/lib/social-metadata";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const copy = buildLayoutCopy(locals.locale);
  const resolveViewerOnClient =
    locals.publicSsr ||
    url.pathname === "/" ||
    isViewerIndependentPublicPath(url.pathname) ||
    isPublicNavigationPath(url.pathname);
  const user = resolveViewerOnClient
    ? null
    : layoutUserSummary(locals.authUser);

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
    user,
    resolveViewerOnClient,
  };
};
