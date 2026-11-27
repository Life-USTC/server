import { error } from "@sveltejs/kit";
import { getDemoNewsDetail } from "@/features/demo/server/demo-news";
import {
  getDemoCopy,
  getDemoView,
} from "@/features/demo/server/demo-workspace";
import { publicationSummary } from "@/features/publications/lib/publication-summary";
import { getPublicationPageCopy } from "@/features/publications/server/publication-page-copy";
import { getPublicPublicationById } from "@/features/publications/server/publication-public-read-service";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [layoutData, publication] = await Promise.all([
    event.parent(),
    event.locals.demo
      ? getDemoNewsDetail(event.locals.locale, event.params.id)
      : getPublicPublicationById(event.params.id, { includeBodyText: false }),
  ]);
  const copy = getPublicationPageCopy(event.locals.locale);
  if (!publication) {
    throw error(404, copy.notFoundDescription);
  }

  const { revision } = publication;
  return {
    publication: {
      publicationType: publication.publicationType,
      source: publication.source,
      renderedBodyHtml: publication.renderedBodyHtml,
      alsoPublishedIn: publication.alsoPublishedIn,
      revision: {
        title: revision.title,
        summary: publicationSummary(
          revision.title,
          revision.summary,
          revision.bodyMarkdown,
        ),
        author: revision.author,
        reporter: revision.reporter,
        editor: revision.editor,
        originalPublisher: revision.originalPublisher,
        category: revision.category,
        publishedAt: revision.publishedAt,
        updatedAtSource: revision.updatedAtSource,
        sourcePageUrl: revision.sourcePageUrl,
        objects: revision.objects.filter((object) => object.kind === "asset"),
      },
    },
    newsSampleNotice: event.locals.demo
      ? getDemoCopy(event.locals.locale).newsSamples
      : null,
    newsExternalUnavailable: event.locals.demo
      ? getDemoCopy(event.locals.locale).newsExternalUnavailable
      : null,
    demo: event.locals.demo
      ? getDemoView(event.locals.demo, event.locals.locale)
      : null,
    copy,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: publication.revision.summary ?? copy.pageDescription,
      title: `${publication.revision.title} - ${copy.title}`,
    }),
  };
};
