import { type Locator, type Page, test } from "@playwright/test";
import { gotoAndWaitForReady } from "./page-ready";
import type {
  createPriorityViewAudit,
  PriorityField,
  VisiblePriorityField,
} from "./property-priority";
import type { WorkspacePriorityFixture } from "./property-priority-workspace-fixture";

type Audit = ReturnType<typeof createPriorityViewAudit>;
type Locale = "zh-cn" | "en-us";
const field = (
  locator: Locator,
  expected: string | RegExp,
): VisiblePriorityField => ({ locator, expected });
const text = (scope: Locator, expected: string | RegExp) =>
  field(
    scope
      .getByText(expected, { exact: false })
      .filter({ visible: true })
      .first(),
    expected,
  );
const input = (
  scope: Locator,
  name: string,
  expected: string,
): VisiblePriorityField => ({
  locator: scope.locator(`[name="${name}"]:visible`),
  expected,
  input: true,
});
const internal = (value: string | number | Date) => ({
  value: value instanceof Date ? value.toISOString() : String(value),
});
const localized = (
  item: { nameCn: string; nameEn: string | null },
  locale: Locale,
) => (locale === "en-us" ? (item.nameEn ?? item.nameCn) : item.nameCn);
const markComplete = /^(标记为完成|Mark as complete)$/i;
const edit = /^(编辑待办|Edit Todo)$/i;

export async function checkWorkspaceTaskPriorityViews(
  audit: Audit,
  page: Page,
  data: WorkspacePriorityFixture,
  locale: Locale,
  width: number,
) {
  const { todo, homework, catalog, section, exam, batch } = data;
  const main = page.locator("#main-content");
  const courseName = localized(catalog.courses[0], locale);
  const high = locale === "en-us" ? "High" : "高";
  const major = locale === "en-us" ? "Major" : "大作业";
  const team = locale === "en-us" ? "Team required" : "需要组队";
  const todoInternal = {
    "todo.id": internal(todo.id),
    "todo.userId": internal(data.user.id),
    "todo.createdAt": internal(todo.createdAt),
    "todo.updatedAt": internal(todo.updatedAt),
  };
  const homeworkInternal = {
    "homework.id": internal(homework.id),
    "homework.createdAt": internal(homework.createdAt),
  };
  const completion = (scope: Locator): VisiblePriorityField => ({
    locator: scope.getByRole("button", { name: markComplete }),
    expected: markComplete,
    attribute: "aria-label",
  });

  await gotoAndWaitForReady(page, "/workspace/todos");
  const todoRow =
    width >= 768
      ? main.getByRole("row").filter({ hasText: todo.title })
      : main
          .getByTestId("workspace-todos-cards")
          .locator('[data-slot="item"]')
          .filter({ hasText: todo.title });
  const todoTitle = todoRow.getByRole("button", {
    name: todo.title,
    exact: true,
  });
  if (width >= 768) await todoRow.hover();
  await audit.check({
    feature: "todo",
    capability: "todo-list",
    view: "web-list",
    scope: todoRow,
    identity: todoTitle,
    primary: {
      "todo.title": field(todoTitle, todo.title),
      "todo.dueAt": text(todoRow, "11:45"),
      "todo.completed": completion(todoRow),
    },
    secondary: { "todo.priority": text(todoRow, high) },
    tertiary: todoInternal,
  });
  await test.info().attach(`todo-priority-${locale}-${width}`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await todoTitle.click();
  const todoDialog = page.getByRole("dialog", {
    name: todo.title,
    exact: true,
  });
  await audit.check({
    feature: "todo",
    capability: "todo-list",
    view: "web-detail",
    scope: todoDialog,
    identity: todoDialog.getByRole("heading", {
      name: todo.title,
      exact: true,
    }),
    primary: {
      "todo.title": text(todoDialog, todo.title),
      "todo.dueAt": text(
        todoDialog.getByTestId("todo-detail-summary"),
        "11:45",
      ),
      "todo.completed": text(
        todoDialog.getByTestId("todo-detail-summary"),
        /^(未完成|待处理|Incomplete|Pending)$/i,
      ),
    },
    secondary: {
      "todo.priority": text(
        todoDialog.getByTestId("todo-detail-summary"),
        high,
      ),
      "todo.content": text(todoDialog, todo.content ?? ""),
    },
    tertiary: todoInternal,
  });
  await todoDialog.getByRole("button", { name: edit }).click();
  const editor = page.getByRole("dialog", { name: edit });
  await audit.check({
    feature: "todo",
    capability: "todo-edit",
    view: "web",
    scope: editor,
    identity: editor.getByRole("heading", { name: edit }),
    primary: { "todo.title": input(editor, "title", todo.title) },
    secondary: {
      "todo.priority": input(editor, "priority", "high"),
      "todo.content": {
        locator: editor.locator("textarea"),
        expected: todo.content ?? "",
        input: true,
      },
      "todo.dueAt": input(editor, "dueAt", `${data.today}T11:45`),
    },
    tertiary: {},
  });
  await page.keyboard.press("Escape");

  await gotoAndWaitForReady(page, "/workspace/homeworks");
  const homeworkRow =
    width >= 768
      ? main
          .getByTestId("workspace-homeworks-list")
          .getByRole("row")
          .filter({ hasText: homework.title })
      : main
          .getByTestId("workspace-homeworks-cards")
          .locator('[data-slot="item"]')
          .filter({ hasText: homework.title });
  const homeworkTitle = homeworkRow.getByRole("button", {
    name: homework.title,
    exact: true,
  });
  if (width >= 768) await homeworkRow.hover();
  const homeworkPrimary: Record<string, PriorityField> = {
    "homework.title": field(homeworkTitle, homework.title),
    "homework.submissionDueAt": text(homeworkRow, "12:30"),
    "homework.completed": completion(homeworkRow),
  };
  await audit.check({
    feature: "homework",
    capability: "cross-section-homework-summary",
    view: "web-list",
    scope: homeworkRow,
    identity: homeworkTitle,
    primary: homeworkPrimary,
    secondary: {
      "section.course.namePrimary": text(homeworkRow, courseName),
      "homework.isMajor": text(homeworkRow, major),
      "homework.requiresTeam": text(homeworkRow, team),
    },
    tertiary: homeworkInternal,
  });
  await audit.check({
    feature: "homework",
    capability: "homework-completion",
    view: "web",
    scope: homeworkRow,
    identity: homeworkTitle,
    primary: homeworkPrimary,
    secondary: {},
    tertiary: {},
  });
  await homeworkTitle.click();
  async function checkHomeworkDetail(capability: string, view: string) {
    const dialog = page.getByRole("dialog", {
      name: homework.title,
      exact: true,
    });
    const secondary = dialog.getByTestId("homework-secondary-details");
    await audit.check({
      feature: "homework",
      capability,
      view,
      scope: dialog,
      identity: dialog.getByRole("heading", {
        name: homework.title,
        exact: true,
      }),
      primary: {
        "homework.title": text(dialog, homework.title),
        "homework.submissionDueAt": text(
          dialog.getByTestId("homework-deadline-summary"),
          "12:30",
        ),
        "homework.completed": text(
          secondary,
          /未完成|待处理|Pending|Incomplete/i,
        ),
      },
      secondary: {
        "homework.isMajor": text(secondary, major),
        "homework.requiresTeam": text(secondary, team),
        "homework.publishedAt": text(secondary, /0?9:10/),
        "homework.submissionStartAt": text(secondary, "10:20"),
        "homework.description.content": text(
          dialog,
          `Instructions ${catalog.marker}`,
        ),
      },
      tertiary: homeworkInternal,
    });
    await page.keyboard.press("Escape");
  }
  await checkHomeworkDetail("cross-section-homework-summary", "web-detail");
  await gotoAndWaitForReady(
    page,
    `/catalog/sections/${section.jwId}?homeworkId=${homework.id}#homework`,
  );
  const sectionHomework = page.getByRole("button", {
    name: homework.title,
    exact: true,
  });
  if (
    !(await page
      .getByRole("dialog", { name: homework.title, exact: true })
      .isVisible())
  )
    await sectionHomework.click();
  await checkHomeworkDetail("section-homework-tab", "web");

  await gotoAndWaitForReady(page, "/workspace/exams");
  const examRow =
    width >= 768
      ? main.getByRole("row").filter({ hasText: courseName })
      : main
          .getByTestId("workspace-exams-cards")
          .locator('[data-slot="item"]')
          .filter({ hasText: courseName });
  const examTitle = examRow.getByRole("link", {
    name: courseName,
    exact: true,
  });
  if (width >= 768) await examRow.locator("summary").click();
  await audit.check({
    feature: "exam",
    capability: "cross-section-exam-list",
    view: "web",
    scope: examRow,
    identity: examTitle,
    primary: {
      "section.course.namePrimary": field(examTitle, courseName),
      "exam.examDate": text(
        examRow,
        new RegExp(
          `${Number(data.tomorrow.slice(5, 7))}.*${Number(data.tomorrow.slice(8, 10))}|${data.tomorrow}`,
        ),
      ),
      "exam.startTime": text(examRow, "14:00"),
      "exam.endTime": text(examRow, "16:00"),
      "exam.completed": text(examRow, /^(未结束|即将到来|Upcoming)$/i),
    },
    secondary: {
      "section.semester.nameCn": text(
        examRow,
        locale === "en-us" ? "Fall 2026" : "2026年秋季学期",
      ),
      "exam.examMode": text(examRow, exam.examMode ?? ""),
      "exam.examBatch.namePrimary": text(examRow, localized(batch, locale)),
      "exam.examType": text(examRow, locale === "en-us" ? "Final" : "期末"),
      "exam.examTakeCount": text(examRow, "23"),
      "exam.examRooms.namePrimary": text(
        examRow,
        `ExamRoom-${catalog.marker}`.toUpperCase(),
      ),
    },
    tertiary: {
      "exam.id": internal(exam.id),
      "exam.examBatch.id": internal(batch.id),
    },
  });
  await test.info().attach(`exam-priority-${locale}-${width}`, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await gotoAndWaitForReady(page, `/catalog/sections/${section.jwId}#exams`);
  const sectionExam = main
    .getByTestId("section-exams-list")
    .getByRole("row")
    .filter({ hasText: exam.examMode ?? "" });
  const date = sectionExam.getByRole("cell").nth(1);
  await audit.check({
    feature: "exam",
    capability: "section-exam-info",
    view: "web",
    scope: sectionExam,
    identity: date,
    primary: {
      "exam.examDate": field(
        date,
        new RegExp(String(Number(data.tomorrow.slice(8, 10)))),
      ),
      "exam.startTime": text(sectionExam, "14:00"),
      "exam.endTime": text(sectionExam, "16:00"),
    },
    secondary: {
      "exam.examMode": text(sectionExam, exam.examMode ?? ""),
      "exam.examBatch.namePrimary": text(sectionExam, localized(batch, locale)),
      "exam.examRooms.namePrimary": text(
        sectionExam,
        `ExamRoom-${catalog.marker}`.toUpperCase(),
      ),
    },
    tertiary: {
      "exam.id": internal(exam.id),
      "exam.examBatch.id": internal(batch.id),
    },
  });
}
