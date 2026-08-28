import {
  getSectionHomeworkDetail,
  listSectionHomeworks,
} from "@/features/homeworks/server/homework-list-read-model";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-types";
import { renderEmbeddedMarkdown } from "@/lib/components/markdown-preview-renderer";
import {
  serializeDatesDeep,
  toShanghaiIsoString,
} from "@/lib/time/serialize-date-output";

type SectionHomeworkDetail = NonNullable<
  Awaited<ReturnType<typeof getSectionHomeworkDetail>>
>["homework"];

function renderSectionHomeworkDetail(homework: SectionHomeworkDetail) {
  const { section: _section, ...scopedHomework } = serializeDatesDeep(homework);
  return {
    ...scopedHomework,
    description: scopedHomework.description
      ? {
          ...scopedHomework.description,
          renderedHtml: renderEmbeddedMarkdown(
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
}

function serializeSectionHomeworkSummary(
  homework: Awaited<
    ReturnType<typeof listSectionHomeworks>
  >["homeworks"][number],
) {
  const serialized = serializeDatesDeep(homework);
  return {
    ...serialized,
    completion: homework.completion
      ? {
          completedAt: toShanghaiIsoString(homework.completion.completedAt),
        }
      : null,
  };
}

export async function getSectionHomeworkData(
  sectionId: number,
  userId: string | null,
  focusedHomeworkId?: string | null,
) {
  const [result, detail] = await Promise.all([
    listSectionHomeworks({
      sectionIds: [sectionId],
      userId,
    }),
    focusedHomeworkId
      ? getSectionHomeworkDetail({ homeworkId: focusedHomeworkId, userId })
      : Promise.resolve(null),
  ]);
  const focusedDetail =
    detail?.homework.sectionId === sectionId ? detail : null;

  const homeworks = result.homeworks.map((homework) =>
    focusedDetail?.homework.id === homework.id
      ? renderSectionHomeworkDetail(focusedDetail.homework)
      : serializeSectionHomeworkSummary(homework),
  );

  return {
    viewer: result.viewer,
    auditLogs: focusedDetail ? serializeDatesDeep(focusedDetail.auditLogs) : [],
    homeworks,
  } satisfies SectionDetailPageData["homeworkData"];
}
