import type { z } from "zod";
import type { HomeworkSummaryItem } from "@/features/subscriptions/server/subscription-homework-types";
import type { SectionOption } from "@/features/subscriptions/server/subscription-read-model-shared";
import type { AppLocale } from "@/i18n/config";
import type { homeworkItemSchema } from "@/lib/api/schemas/homeworks-response-schemas";
import { getDemoSubscribedSections } from "./demo-subscriptions";

type DemoHomework = z.output<typeof homeworkItemSchema>;

const samples = [
  {
    id: "determinants",
    sectionId: 101,
    cn: "行列式练习",
    en: "Determinants exercises",
    due: "2026-09-23T18:00:00+08:00",
  },
  {
    id: "vectors",
    sectionId: 101,
    cn: "向量空间练习",
    en: "Vector spaces exercises",
    due: "2026-09-25T18:00:00+08:00",
  },
  {
    id: "matrices",
    sectionId: 101,
    cn: "矩阵运算练习",
    en: "Matrix operations exercises",
    due: "2026-09-26T18:00:00+08:00",
    completed: true,
  },
  {
    id: "project",
    sectionId: 101,
    cn: "线性代数小组项目",
    en: "Linear algebra team project",
    due: null,
    major: true,
  },
  {
    id: "physics",
    sectionId: 102,
    cn: "力学拓展阅读",
    en: "Mechanics further reading",
    due: "2026-09-27T18:00:00+08:00",
  },
  {
    id: "structures",
    sectionId: 103,
    cn: "数据结构课程项目",
    en: "Data structures course project",
    due: "2026-06-20T18:00:00+08:00",
    major: true,
  },
] as const;

export function getDemoHomeworks(locale: AppLocale): DemoHomework[] {
  const sections = getDemoSubscribedSections(locale);
  return samples.map((sample) => {
    const source = sections.find((section) => section.id === sample.sectionId);
    if (!source) throw new Error("Missing demo homework section");
    const {
      kind,
      teachers: _teachers,
      campus: _campus,
      openDepartment: _department,
      course: sourceCourse,
      ...section
    } = source;
    const {
      category: _category,
      classType: _classType,
      classify: _classify,
      educationLevel: _educationLevel,
      gradation: _gradation,
      type: _type,
      ...course
    } = sourceCourse;
    const id = `demo-homework-${sample.id}`;
    const createdAt =
      sample.sectionId === 103
        ? "2026-06-01T09:00:00+08:00"
        : "2026-09-20T09:00:00+08:00";
    return {
      id,
      title: locale === "en-us" ? sample.en : sample.cn,
      isMajor: "major" in sample,
      requiresTeam: "major" in sample,
      completionRequired: kind === "regular",
      publishedAt: createdAt,
      submissionStartAt: createdAt,
      submissionDueAt: sample.due,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      sectionId: source.id,
      createdById: null,
      updatedById: null,
      deletedById: null,
      section: { ...section, course },
      description: {
        id: `demo-description-${id}`,
        content:
          locale === "en-us"
            ? "Read the course notes and explain your reasoning for each exercise."
            : "阅读课程笔记，并写出每道练习的推导过程。",
        createdAt,
        updatedAt: createdAt,
        lastEditedAt: null,
        lastEditedById: null,
        sectionId: null,
        courseId: null,
        teacherId: null,
        homeworkId: id,
      },
      createdBy: null,
      updatedBy: null,
      deletedBy: null,
      completion:
        "completed" in sample
          ? { completedAt: "2026-09-23T16:00:00+08:00" }
          : null,
      commentCount: 0,
    };
  });
}

export function getDemoHomework(id: string, locale: AppLocale) {
  return (
    getDemoHomeworks(locale).find((homework) => homework.id === id) ?? null
  );
}

export function demoHomeworkSummary(homework: DemoHomework) {
  const {
    section: _section,
    description: _description,
    createdBy: _createdBy,
    updatedBy: _updatedBy,
    deletedBy: _deletedBy,
    ...summary
  } = homework;
  return summary;
}

/** Every supplied alias must resolve to the same fixture section set. */
export function resolveDemoHomeworkSectionIds(input: {
  sectionId?: string;
  sectionIds?: string;
  sectionJwId?: string;
}): number[] | null {
  const sections = getDemoSubscribedSections("zh-cn");
  const selectors: number[][] = [];
  if (input.sectionIds !== undefined)
    selectors.push(
      [...new Set(input.sectionIds.split(",").map(Number))].sort(),
    );
  if (input.sectionId !== undefined) selectors.push([Number(input.sectionId)]);
  if (input.sectionJwId !== undefined) {
    const section = sections.find(
      (section) => section.jwId === Number(input.sectionJwId),
    );
    if (!section) return null;
    selectors.push([section.id]);
  }
  const ids = selectors[0];
  if (
    !ids?.length ||
    ids.some((id) => !sections.some((section) => section.id === id))
  )
    return null;
  return selectors.every(
    (selector) =>
      selector.length === ids.length &&
      selector.every((id, index) => id === ids[index]),
  )
    ? ids
    : null;
}

export function getDemoHomeworksTabData(locale: AppLocale) {
  const homeworkSummaries: HomeworkSummaryItem[] = getDemoHomeworks(locale).map(
    (homework) => ({
      id: homework.id,
      title: homework.title,
      completionRequired: homework.completionRequired,
      isMajor: homework.isMajor,
      requiresTeam: homework.requiresTeam,
      publishedAt: homework.publishedAt,
      submissionStartAt: homework.submissionStartAt,
      submissionDueAt: homework.submissionDueAt,
      createdAt: homework.createdAt,
      description: homework.description?.content ?? null,
      completion: homework.completion,
      section: {
        jwId: homework.section.jwId,
        code: homework.section.code,
        courseName: homework.section.course.namePrimary,
        semesterName: homework.section.semester?.nameCn ?? null,
      },
    }),
  );
  const sections: SectionOption[] = getDemoSubscribedSections(locale).map(
    (section) => ({
      id: section.id,
      jwId: section.jwId,
      code: section.code,
      courseName: section.course.namePrimary,
      semesterName: section.semester?.nameCn ?? null,
      semesterStart: section.semester?.startDate ?? null,
      semesterEnd: section.semester?.endDate ?? null,
      teacherName: section.teachers
        .map((teacher) => teacher.namePrimary)
        .join(", "),
      nextClassStarts: [],
    }),
  );
  return { homeworkSummaries, sections };
}
