import {
  getSectionHomeworkDetail,
  listSectionHomeworks,
} from "@/features/homeworks/server/homework-list-read-model";
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-types";
import {
  serializeDatesDeep,
  toShanghaiIsoString,
} from "@/lib/time/serialize-date-output";

type SectionHomeworkDetail = NonNullable<
  Awaited<ReturnType<typeof getSectionHomeworkDetail>>
>["homework"];

async function renderDescription(content: string) {
  const [{ renderEmbeddedMarkdown }, { campusReferenceMarkdownPlugins }] =
    await Promise.all([
      import("@/lib/components/markdown-preview-renderer"),
      import("@/features/markdown/lib/campus-reference-markdown"),
    ]);
  return renderEmbeddedMarkdown(content, {
    remarkPlugins: campusReferenceMarkdownPlugins,
  });
}

async function renderSectionHomeworkDetail(homework: SectionHomeworkDetail) {
  const { section: _section, ...scopedHomework } = serializeDatesDeep(homework);
  return {
    ...scopedHomework,
    description: scopedHomework.description
      ? {
          ...scopedHomework.description,
          renderedHtml: await renderDescription(
            scopedHomework.description.content ?? "",
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

  const renderedDetail =
    focusedDetail &&
    result.homeworks.some((item) => item.id === focusedDetail.homework.id)
      ? await renderSectionHomeworkDetail(focusedDetail.homework)
      : null;
  const homeworks = result.homeworks.map((homework) =>
    renderedDetail?.id === homework.id
      ? renderedDetail
      : serializeSectionHomeworkSummary(homework),
  );

  return {
    viewer: result.viewer,
    auditLogs: focusedDetail ? serializeDatesDeep(focusedDetail.auditLogs) : [],
    homeworks,
  } satisfies SectionDetailPageData["homeworkData"];
}
