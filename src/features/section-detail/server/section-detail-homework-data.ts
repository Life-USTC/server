import { listSectionHomeworksWithAudit } from "@/features/homeworks/server/homework-list-read-model";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-types";
import { renderMarkdown } from "@/lib/components/markdown-preview-renderer";
import {
  serializeDatesDeep,
  toShanghaiIsoString,
} from "@/lib/time/serialize-date-output";

export async function getSectionHomeworkData(
  sectionId: number,
  userId: string | null,
) {
  const result = await listSectionHomeworksWithAudit({
    sectionIds: [sectionId],
    userId,
  });

  return {
    viewer: result.viewer,
    auditLogs: serializeDatesDeep(result.auditLogs),
    homeworks: result.homeworks.map((homework) => {
      const { section: _section, ...scopedHomework } =
        serializeDatesDeep(homework);
      return {
        ...scopedHomework,
        description: scopedHomework.description
          ? {
              ...scopedHomework.description,
              renderedHtml: renderMarkdown(
                scopedHomework.description.content ?? "",
                { remarkPlugins: campusReferenceMarkdownPlugins },
              ),
            }
          : null,
        completion: homework.completion
          ? {
              completedAt: toShanghaiIsoString(homework.completion.completedAt),
            }
          : null,
      };
    }),
  } satisfies SectionDetailPageData["homeworkData"];
}
