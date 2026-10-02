import { listShellSubscribedSections } from "@/features/workspace/server/workspace-navigation-summary";
import { isViewerIndependentPublicPath } from "@/lib/cloudflare/public-ssr-gateway";
import {
  buildLayoutCopy,
  layoutUserSummary,
} from "@/lib/shell/layout-server-data";
import { buildSocialMetadata } from "@/lib/social-metadata";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const copy = buildLayoutCopy(locals.locale);
  const resolveViewerOnClient =
    locals.publicSsr || isViewerIndependentPublicPath(url.pathname);
  const user = resolveViewerOnClient
    ? null
    : layoutUserSummary(locals.authUser);
  // Workspace SSR already owns the viewer. Include the section directory here
  // so hydration does not make a second shell-bootstrap request.
  let subscribedSections: Awaited<
    ReturnType<typeof listShellSubscribedSections>
  > | null = null;
  if (user) {
    try {
      subscribedSections = await listShellSubscribedSections(
        user.id,
        locals.locale,
      );
    } catch {
      subscribedSections = [];
    }
  }

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
    subscribedSections,
  };
};
