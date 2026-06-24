/**
 * MCP tool integration tests.
 *
 * Shared seed/setup guidance lives in the repo root `AGENTS.md`.
 * Use `bun run verify:full` for the normal integration gate.
 *
 * The shared dev-seed anchor comes from `DEV_SEED_ANCHOR`, so date filters and
 * deterministic atTime calls stay aligned with the seeded schedules, exams, and
 * homeworks.
 */

import { DEV_SEED, DEV_SEED_ANCHOR } from "@tools/dev/seed/dev-seed";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TODO_CONTENT_MAX_LENGTH } from "@/features/todos/lib/todo-limits";
import { prisma } from "@/lib/db/prisma";
import { createMcpHarness, type McpHarness } from "./utils/mcp-harness";

const SEED_DATE = DEV_SEED_ANCHOR.date;
const SEED_AT_TIME = DEV_SEED_ANCHOR.recommendedAtTime;

function seedDatePlusDays(days: number) {
  const date = new Date(`${SEED_DATE}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findDescriptionEditAuditLog(descriptionId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const log = await prisma.auditLog.findFirst({
      where: {
        action: "description_edit",
        targetId: descriptionId,
        targetType: "description",
        userId: devUserId,
      },
      select: { id: true, metadata: true },
    });
    if (log) return log;
    await sleep(25);
  }

  return null;
}

const SEED_PLUS_THREE_DAYS = seedDatePlusDays(3);
const SEED_PLUS_SIX_DAYS = seedDatePlusDays(6);
const SEED_PLUS_SEVEN_DAYS = seedDatePlusDays(7);
const SEED_PLUS_ELEVEN_DAYS = seedDatePlusDays(11);
const SEED_PLUS_TWELVE_DAYS = seedDatePlusDays(12);
const PAST_SAME_DAY_EXAM_JW_ID = 88_051_002;

let devUserId: string;
let mcp: McpHarness;

function shanghaiIsoOnSeedDate(hhmm: number, addMinutes = 0) {
  const hours = Math.trunc(hhmm / 100);
  const minutes = hhmm % 100;
  const date = new Date(
    Date.parse(
      `${SEED_DATE}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+08:00`,
    ) +
      addMinutes * 60_000,
  );
  return date
    .toLocaleString("sv-SE", {
      timeZone: "Asia/Shanghai",
      hour12: false,
    })
    .replace(" ", "T")
    .concat("+08:00");
}

beforeAll(async () => {
  const user = await prisma.user.findFirst({
    where: { username: DEV_SEED.debugUsername },
    select: { id: true },
  });
  if (!user) {
    throw new Error(
      `Dev seed user "${DEV_SEED.debugUsername}" not found. ` +
        "See the repo root `AGENTS.md` for the required DB + seed setup.",
    );
  }
  devUserId = user.id;
  mcp = await createMcpHarness(devUserId);
});

afterAll(async () => {
  await mcp?.close();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

describe("get_my_profile", () => {
  it("returns the authenticated user's REST-equivalent profile fields", async () => {
    const profile = await mcp.call<{
      id?: string;
      email?: string | null;
      name?: string | null;
      username?: string | null;
      isAdmin?: boolean;
      createdAt?: string;
      updatedAt?: string;
    }>("get_my_profile");

    expect(profile.id).toBe(devUserId);
    expect(typeof profile.email).toBe("string");
    expect(profile.name).toBe(DEV_SEED.debugName);
    expect(profile.username).toBe(DEV_SEED.debugUsername);
    expect(profile.isAdmin).toBe(false);
    // Dates are serialized in Asia/Shanghai (+08:00)
    expect(profile.createdAt).toMatch(/\+08:00$/);
    expect(profile.updatedAt).toMatch(/\+08:00$/);
  });
});

describe("get_public_user_profile", () => {
  it("returns public profile hierarchy by username", async () => {
    const profile = await mcp.call<{
      found?: boolean;
      user?: {
        id?: string;
        name?: string | null;
        username?: string | null;
        _count?: {
          comments?: number;
          homeworksCreated?: number;
          subscribedSections?: number;
          uploads?: number;
        };
      };
      sectionCount?: number;
      totalContributions?: number;
      weeks?: Array<Array<{ date?: string; count?: number }>>;
    }>("get_public_user_profile", {
      username: DEV_SEED.debugUsername,
      mode: "full",
    });

    expect(profile.found).toBe(true);
    expect(profile.user?.id).toBe(devUserId);
    expect(profile.user?.name).toBe(DEV_SEED.debugName);
    expect(profile.user?.username).toBe(DEV_SEED.debugUsername);
    expect(typeof profile.sectionCount).toBe("number");
    expect(typeof profile.totalContributions).toBe("number");
    expect((profile.weeks?.length ?? 0) > 0).toBe(true);
    expect(profile.weeks?.[0]?.[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof profile.user?._count?.comments).toBe("number");
    expect(typeof profile.user?._count?.uploads).toBe("number");
    expect(typeof profile.user?._count?.homeworksCreated).toBe("number");
    expect(typeof profile.user?._count?.subscribedSections).toBe("number");
  });

  it("returns not_found for missing users", async () => {
    const result = await mcp.call<{
      success?: boolean;
      found?: boolean;
      error?: string;
    }>("get_public_user_profile", {
      username: "missing-integration-user",
    });

    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.error).toBe("not_found");
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe("comment read tools — MCP exposes the REST comment hierarchy", () => {
  it("list_comments returns threaded section comments with viewer/action fields", async () => {
    const result = await mcp.call<{
      found?: boolean;
      comments?: Array<{
        id?: string;
        body?: string;
        author?: { name?: string | null } | null;
        replies?: Array<{ body?: string }>;
        reactions?: Array<{ type?: string; count?: number }>;
        canReply?: boolean;
        canEdit?: boolean;
        canDelete?: boolean;
      }>;
      hiddenCount?: number;
      target?: {
        courseJwId?: number | null;
        courseName?: string | null;
        type?: string;
        targetId?: number | null;
        sectionJwId?: number | null;
        sectionCode?: string | null;
      };
      viewer?: { userId?: string | null; isAuthenticated?: boolean };
    }>("list_comments", {
      targetType: "section",
      sectionJwId: DEV_SEED.section.jwId,
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.target?.type).toBe("section");
    expect(typeof result.target?.targetId).toBe("number");
    expect(result.target?.sectionJwId).toBe(DEV_SEED.section.jwId);
    expect(result.target?.sectionCode).toBe(DEV_SEED.section.code);
    expect(result.target?.courseJwId).toBe(DEV_SEED.course.jwId);
    expect(result.target?.courseName).toBe(DEV_SEED.course.nameCn);
    expect(result.viewer?.userId).toBe(devUserId);
    expect(result.viewer?.isAuthenticated).toBe(true);
    expect(typeof result.hiddenCount).toBe("number");

    const root = result.comments?.find((comment) =>
      comment.body?.includes(DEV_SEED.comments.sectionRootBody),
    );
    expect(root).toBeDefined();
    expect(root?.author?.name).toBe(DEV_SEED.debugName);
    expect(root?.canReply).toBe(true);
    expect(root?.canEdit).toBe(true);
    expect(root?.canDelete).toBe(true);
    expect(root?.replies?.length).toBeGreaterThan(0);
    expect(
      root?.reactions?.some(
        (reaction) => reaction.type === "upvote" && reaction.count === 1,
      ),
    ).toBe(true);
  });

  it("get_comment_thread returns the focused thread and target metadata", async () => {
    const seedComment = await prisma.comment.findFirst({
      where: { body: DEV_SEED.comments.sectionRootBody },
      select: { id: true },
    });
    expect(seedComment?.id).toBeTruthy();

    const result = await mcp.call<{
      found?: boolean;
      focusId?: string;
      thread?: Array<{
        id?: string;
        body?: string;
        replies?: Array<{ body?: string }>;
      }>;
      target?: {
        courseJwId?: number | null;
        courseName?: string | null;
        sectionJwId?: number | null;
        sectionCode?: string | null;
      };
    }>("get_comment_thread", {
      commentId: seedComment?.id,
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.focusId).toBe(seedComment?.id);
    expect(result.thread?.[0]?.id).toBe(seedComment?.id);
    expect(result.thread?.[0]?.body).toContain(
      DEV_SEED.comments.sectionRootBody,
    );
    expect(result.thread?.[0]?.replies?.length).toBeGreaterThan(0);
    expect(result.target?.sectionJwId).toBe(DEV_SEED.section.jwId);
    expect(result.target?.sectionCode).toBe(DEV_SEED.section.code);
    expect(result.target?.courseJwId).toBe(DEV_SEED.course.jwId);
    expect(result.target?.courseName).toBe(DEV_SEED.course.nameCn);
  });

  it("list_comments reports missing targets instead of returning an empty success", async () => {
    const result = await mcp.call<{
      success?: boolean;
      found?: boolean;
      error?: string;
    }>("list_comments", {
      targetType: "section",
      sectionJwId: 2_147_483_647,
    });

    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.error).toBe("target_not_found");
  });

  it("list_comments reports unattached section-teacher pairs as missing targets", async () => {
    const marker = `[integration-test] mcp-section-teacher-missing-${Date.now()}`;
    const teacher = await prisma.teacher.create({
      data: {
        code: marker,
        nameCn: marker,
      },
      select: { id: true },
    });

    try {
      const result = await mcp.call<{
        success?: boolean;
        found?: boolean;
        error?: string;
      }>("list_comments", {
        targetType: "section-teacher",
        sectionJwId: DEV_SEED.section.jwId,
        teacherId: teacher.id,
      });

      expect(result.success).toBe(false);
      expect(result.found).toBe(false);
      expect(result.error).toBe("target_not_found");
    } finally {
      await prisma.teacher.deleteMany({ where: { id: teacher.id } });
    }
  });

  it("list_comments does not create section-teacher targets while reading", async () => {
    const section = await prisma.section.findUnique({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(`Seed section ${DEV_SEED.section.jwId} not found`);
    }

    const marker = `[integration-test] mcp-section-teacher-read-${Date.now()}`;
    let teacherId: number | null = null;

    try {
      const teacher = await prisma.teacher.create({
        data: {
          code: marker,
          nameCn: marker,
        },
        select: { id: true },
      });
      teacherId = teacher.id;

      await prisma.section.update({
        where: { id: section.id },
        data: { teachers: { connect: { id: teacherId } } },
      });

      const before = await prisma.sectionTeacher.findUnique({
        where: {
          sectionId_teacherId: {
            sectionId: section.id,
            teacherId,
          },
        },
        select: { id: true },
      });
      expect(before).toBeNull();

      const result = await mcp.call<{
        found?: boolean;
        comments?: unknown[];
        target?: {
          sectionId?: number | null;
          sectionTeacherId?: number | null;
          teacherId?: number | null;
        };
      }>("list_comments", {
        targetType: "section-teacher",
        sectionJwId: DEV_SEED.section.jwId,
        teacherId,
      });

      expect(result.found).toBe(true);
      expect(result.comments).toEqual([]);
      expect(result.target?.sectionId).toBe(section.id);
      expect(result.target?.teacherId).toBe(teacherId);
      expect(result.target?.sectionTeacherId).toBeNull();

      const after = await prisma.sectionTeacher.findUnique({
        where: {
          sectionId_teacherId: {
            sectionId: section.id,
            teacherId,
          },
        },
        select: { id: true },
      });
      expect(after).toBeNull();
    } finally {
      if (teacherId) {
        await prisma.sectionTeacher.deleteMany({
          where: { sectionId: section.id, teacherId },
        });
        await prisma.section.update({
          where: { id: section.id },
          data: { teachers: { disconnect: { id: teacherId } } },
        });
        await prisma.teacher.deleteMany({ where: { id: teacherId } });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

describe("description tools — MCP exposes the REST description payload", () => {
  it("get_description returns seeded section description by public JW id", async () => {
    const section = await prisma.section.findUnique({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    expect(section?.id).toBeTruthy();

    const result = await mcp.call<{
      found?: boolean;
      description?: { content?: string; id?: string | null };
      history?: Array<{ id?: string; nextContent?: string }>;
      target?: { targetId?: number; type?: string };
      viewer?: { isAuthenticated?: boolean; userId?: string | null };
    }>("get_description", {
      targetType: "section",
      sectionJwId: DEV_SEED.section.jwId,
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.target).toMatchObject({
      targetId: section?.id,
      type: "section",
    });
    expect(result.description?.id).toBeTruthy();
    expect(result.description?.content).toContain("课程建议");
    expect(result.history?.length).toBeGreaterThan(0);
    expect(result.viewer).toMatchObject({
      isAuthenticated: true,
      userId: devUserId,
    });
  });

  it("get_description reports missing public section targets", async () => {
    const result = await mcp.call<{
      success?: boolean;
      found?: boolean;
      error?: string;
      hint?: string;
    }>("get_description", {
      targetType: "section",
      sectionJwId: 2_147_483_647,
    });

    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.error).toBe("target_not_found");
    expect(result.hint).toContain("search_sections");
  });

  it("upsert_description creates, idempotently rereads, audits, and cleans up", async () => {
    const marker = `[integration-test] mcp-description-${Date.now()}`;
    const teacher = await prisma.teacher.create({
      data: {
        code: marker,
        nameCn: marker,
      },
      select: { id: true },
    });
    let descriptionId: string | undefined;

    try {
      const created = await mcp.call<{
        success?: boolean;
        id?: string;
        updated?: boolean;
        description?: { content?: string; id?: string | null };
        target?: { targetId?: number; type?: string };
      }>("upsert_description", {
        targetType: "teacher",
        teacherId: teacher.id,
        content: ` ${marker} `,
        mode: "full",
      });
      descriptionId = created.id;

      expect(created.success).toBe(true);
      expect(created.updated).toBe(true);
      expect(created.target).toMatchObject({
        targetId: teacher.id,
        type: "teacher",
      });
      expect(created.description?.id).toBe(descriptionId);
      expect(created.description?.content).toBe(marker);

      const auditLog = descriptionId
        ? await findDescriptionEditAuditLog(descriptionId)
        : null;
      expect(auditLog?.metadata).toMatchObject({
        source: "mcp",
        targetType: "teacher",
      });

      const idempotent = await mcp.call<{
        success?: boolean;
        id?: string;
        updated?: boolean;
        description?: { content?: string };
      }>("upsert_description", {
        targetType: "teacher",
        teacherId: teacher.id,
        content: marker,
        mode: "full",
      });

      expect(idempotent.success).toBe(true);
      expect(idempotent.id).toBe(descriptionId);
      expect(idempotent.updated).toBe(false);
      expect(idempotent.description?.content).toBe(marker);
    } finally {
      if (descriptionId) {
        await findDescriptionEditAuditLog(descriptionId);
        await prisma.auditLog.deleteMany({
          where: {
            action: "description_edit",
            targetId: descriptionId,
            targetType: "description",
            userId: devUserId,
          },
        });
      }
      await prisma.descriptionEdit.deleteMany({
        where: { description: { teacherId: teacher.id } },
      });
      await prisma.description.deleteMany({
        where: { teacherId: teacher.id },
      });
      await prisma.teacher.deleteMany({ where: { id: teacher.id } });
    }
  });
});

// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------

describe("todo CRUD — update_my_todo returns updated entity", () => {
  let todoId: string;

  it("creates a todo", async () => {
    const result = await mcp.call<{ success?: boolean; id?: string }>(
      "create_my_todo",
      {
        title: "[integration-test] update returns todo",
        content: "clear me through mcp",
        priority: "high",
        dueAt: SEED_PLUS_ELEVEN_DAYS,
      },
    );
    expect(result.success).toBe(true);
    expect(typeof result.id).toBe("string");
    todoId = result.id as string;
  });

  it("update_my_todo returns the updated todo entity (not just success: true)", async () => {
    const result = await mcp.call<{
      success?: boolean;
      todo?: {
        id?: string;
        title?: string;
        priority?: string;
        completed?: boolean;
        updatedAt?: string;
      } | null;
    }>("update_my_todo", {
      id: todoId,
      title: "[integration-test] renamed",
      priority: "low",
      completed: true,
    });

    expect(result.success).toBe(true);
    // The updated entity must be echoed — callers must not need a second read.
    expect(result.todo).not.toBeNull();
    expect(result.todo?.id).toBe(todoId);
    expect(result.todo?.title).toBe("[integration-test] renamed");
    expect(result.todo?.priority).toBe("low");
    expect(result.todo?.completed).toBe(true);
    // updatedAt should be a valid Shanghai-offset datetime
    expect(result.todo?.updatedAt).toMatch(/\+08:00$/);
  });

  it("update_my_todo validates normalized content length", async () => {
    const content = "x".repeat(TODO_CONTENT_MAX_LENGTH);
    const result = await mcp.call<{
      success?: boolean;
      todo?: {
        id?: string;
        content?: string | null;
      } | null;
    }>("update_my_todo", {
      id: todoId,
      content: ` ${content} `,
      mode: "full",
    });

    expect(result.success).toBe(true);
    expect(result.todo?.id).toBe(todoId);
    expect(result.todo?.content).toBe(content);
  });

  it("update_my_todo clears content when content is explicitly null", async () => {
    const result = await mcp.call<{
      success?: boolean;
      todo?: {
        id?: string;
        content?: string | null;
      } | null;
    }>("update_my_todo", {
      id: todoId,
      content: null,
      mode: "full",
    });

    expect(result.success).toBe(true);
    expect(result.todo?.id).toBe(todoId);
    expect(result.todo?.content).toBeNull();
  });

  it("deletes the todo (cleanup)", async () => {
    const result = await mcp.call<{ success?: boolean }>("delete_my_todo", {
      id: todoId,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Flexible date inputs
// ---------------------------------------------------------------------------

describe("flexDateInputSchema — bare YYYY-MM-DD accepted by date-filter tools", () => {
  it("list_my_schedules accepts bare date strings (no timezone offset)", async () => {
    const result = await mcp.call<{
      schedules?: Array<{
        id?: number;
        date?: string;
        endTime?: unknown;
        startTime?: unknown;
      }>;
    }>("list_my_schedules", {
      dateFrom: SEED_DATE, // bare date — would have been rejected by old dateTimeSchema
      dateTo: SEED_PLUS_ELEVEN_DAYS,
      limit: 20,
      locale: "zh-cn",
    });

    // Should not error, and the seeded schedules should be returned
    expect(Array.isArray(result.schedules)).toBe(true);
    expect((result.schedules?.length ?? 0) > 0).toBe(true);
    expect(typeof result.schedules?.[0]?.startTime).toBe("string");
    expect(typeof result.schedules?.[0]?.endTime).toBe("string");
    // Every date should fall within the requested window
    for (const schedule of result.schedules ?? []) {
      if (schedule.date) {
        expect(schedule.date >= SEED_DATE).toBe(true);
        expect(schedule.date <= SEED_PLUS_TWELVE_DAYS).toBe(true); // lte dateTo end-of-day
      }
    }
  });

  it("list_my_exams accepts bare date strings", async () => {
    const result = await mcp.call<{
      exams?: Array<{ id?: number }>;
    }>("list_my_exams", {
      dateFrom: SEED_DATE,
      includeDateUnknown: false,
      limit: 20,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.exams)).toBe(true);
  });

  it("list_my_calendar_events accepts bare date strings", async () => {
    const result = await mcp.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("list_my_calendar_events", {
      dateFrom: SEED_DATE,
      dateTo: SEED_PLUS_ELEVEN_DAYS,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.events)).toBe(true);
    // Should include the seeded schedule events
    expect(
      (result.events ?? []).some((e) =>
        ["schedule", "homework_due", "exam", "todo_due"].includes(e.type ?? ""),
      ),
    ).toBe(true);
  });

  it("list_my_calendar_events treats same-day bare date ranges as full Shanghai days", async () => {
    const result = await mcp.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("list_my_calendar_events", {
      dateFrom: SEED_DATE,
      dateTo: SEED_DATE,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.events)).toBe(true);
    expect(
      (result.events ?? []).some(
        (event) => event.type === "schedule" && event.at?.startsWith(SEED_DATE),
      ),
    ).toBe(true);
  });

  it("list_my_calendar_events honors an exact inclusive dateTo bound", async () => {
    const dueAt = `${SEED_PLUS_THREE_DAYS}T21:00:00+08:00`;
    const result = await mcp.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("list_my_calendar_events", {
      dateFrom: dueAt,
      dateTo: dueAt,
      locale: "zh-cn",
    });

    expect(
      (result.events ?? []).some(
        (event) => event.type === "homework_due" && event.at === dueAt,
      ),
    ).toBe(true);
  });

  it("list_my_calendar_events includes todos at an exact inclusive dateTo bound", async () => {
    const dueAt = `${SEED_DATE}T06:45:00+08:00`;
    const todo = await prisma.todo.create({
      data: {
        userId: devUserId,
        title: "[integration-test] inclusive todo dueAt",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await mcp.call<{
        events?: Array<{
          type?: string;
          at?: string;
          payload?: { id?: string };
        }>;
      }>("list_my_calendar_events", {
        dateFrom: dueAt,
        dateTo: dueAt,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) =>
            event.type === "todo_due" &&
            event.at === dueAt &&
            event.payload?.id === todo.id,
        ),
      ).toBe(true);
    } finally {
      await prisma.todo.deleteMany({ where: { id: todo.id } });
    }
  });

  it("list_my_calendar_events includes timed events overlapping an exact window", async () => {
    const schedule = await prisma.schedule.findFirst({
      where: {
        section: { jwId: DEV_SEED.section.jwId },
        date: new Date(`${SEED_DATE}T00:00:00.000Z`),
      },
      select: { id: true, startTime: true, endTime: true },
      orderBy: { startTime: "asc" },
    });
    if (!schedule) {
      throw new Error(`Seed schedule for ${SEED_DATE} not found`);
    }

    const windowStart = shanghaiIsoOnSeedDate(schedule.startTime, 15);
    const windowEnd = shanghaiIsoOnSeedDate(schedule.startTime, 30);
    const endsAt = new Date(shanghaiIsoOnSeedDate(schedule.endTime));
    expect(endsAt.getTime()).toBeGreaterThan(new Date(windowEnd).getTime());

    const result = await mcp.call<{
      events?: Array<{ type?: string; payload?: { id?: number } }>;
    }>("list_my_calendar_events", {
      dateFrom: windowStart,
      dateTo: windowEnd,
      locale: "zh-cn",
    });

    expect(
      (result.events ?? []).some(
        (event) =>
          event.type === "schedule" && event.payload?.id === schedule.id,
      ),
    ).toBe(true);
  });

  it("list_my_calendar_events widens date-backed queries for exact windows", async () => {
    const section = await prisma.section.findUnique({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(`Seed section ${DEV_SEED.section.jwId} not found`);
    }

    const jwId = 926042901;
    await prisma.exam.deleteMany({ where: { jwId } });

    try {
      await prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: null,
        },
      });

      const result = await mcp.call<{
        events?: Array<{ type?: string; payload?: { jwId?: number | null } }>;
      }>("list_my_calendar_events", {
        dateFrom: `${SEED_DATE}T00:10:00+08:00`,
        dateTo: `${SEED_DATE}T00:30:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) => event.type === "exam" && event.payload?.jwId === jwId,
        ),
      ).toBe(true);
    } finally {
      await prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("list_my_calendar_events keeps no-time exams visible through their day", async () => {
    const section = await prisma.section.findUnique({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(`Seed section ${DEV_SEED.section.jwId} not found`);
    }

    const jwId = 926042900;
    await prisma.exam.deleteMany({ where: { jwId } });

    try {
      await prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: null,
        },
      });

      const result = await mcp.call<{
        events?: Array<{ type?: string; at?: string }>;
      }>("list_my_calendar_events", {
        dateFrom: `${SEED_DATE}T08:00:00+08:00`,
        dateTo: `${SEED_DATE}T09:00:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) =>
            event.type === "exam" && event.at === `${SEED_DATE}T00:00:00+08:00`,
        ),
      ).toBe(true);
    } finally {
      await prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("list_my_calendar_events respects endTime for exams without startTime", async () => {
    const section = await prisma.section.findUnique({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(`Seed section ${DEV_SEED.section.jwId} not found`);
    }

    const jwId = 926042902;
    await prisma.exam.deleteMany({ where: { jwId } });

    try {
      await prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: 1200,
        },
      });

      const result = await mcp.call<{
        events?: Array<{ type?: string; payload?: { jwId?: number | null } }>;
      }>("list_my_calendar_events", {
        dateFrom: `${SEED_DATE}T13:00:00+08:00`,
        dateTo: `${SEED_DATE}T14:00:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) => event.type === "exam" && event.payload?.jwId === jwId,
        ),
      ).toBe(false);
    } finally {
      await prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("returns a descriptive error for a nonsense date string", async () => {
    const result = await mcp.call<{
      success?: boolean;
      message?: string;
    }>("list_my_schedules", {
      dateFrom: "not-a-date",
      limit: 5,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not-a-date");
    expect(result.message?.toLowerCase()).toContain("invalid");
  });
});

// ---------------------------------------------------------------------------
// atTime override — reproducible time-sensitive tools
// ---------------------------------------------------------------------------

describe("atTime override — time-sensitive tools are anchored to SEED_DATE", () => {
  it("get_my_7days_timeline with atTime returns the seed window and correct range", async () => {
    const result = await mcp.call<{
      range?: { from?: string; to?: string };
      total?: number;
      events?: Array<{ type?: string; at?: string }>;
    }>("get_my_7days_timeline", {
      locale: "zh-cn",
      atTime: SEED_AT_TIME,
    });

    // Range anchored to seed date
    expect(result.range?.from).toMatch(new RegExp(`^${SEED_DATE}`));
    expect(result.range?.to).toMatch(new RegExp(`^${SEED_PLUS_SEVEN_DAYS}`));
    expect(typeof result.total).toBe("number");
    expect(Array.isArray(result.events)).toBe(true);

    // Seeded schedules and homework deadlines must appear in this window
    expect((result.total ?? 0) > 0).toBe(true);
    expect((result.events ?? []).some((e) => e.type === "schedule")).toBe(true);
  });

  it("get_my_7days_timeline summary mode with atTime returns grouped collection", async () => {
    const result = await mcp.call<{
      total?: number;
      events?: {
        total?: number;
        byType?: { schedule?: number; homework_due?: number };
        days?: Array<{ date?: string; total?: number }>;
        items?: Array<{ type?: string }>;
      };
    }>("get_my_7days_timeline", {
      locale: "zh-cn",
      atTime: SEED_AT_TIME,
      mode: "summary",
    });

    expect(result.events?.total).toBe(result.total);
    expect(typeof result.events?.byType?.schedule).toBe("number");
    expect(result.events?.byType?.schedule).toBeGreaterThan(0);
    expect((result.events?.days?.length ?? 0) > 0).toBe(true);
    // Days should fall within the seed window
    for (const day of result.events?.days ?? []) {
      expect(day.date).toMatch(/^2026-0[45]/);
    }
  });

  it("get_upcoming_deadlines with atTime only returns events after the anchor", async () => {
    const result = await mcp.call<{
      total?: number;
      deadlines?: Array<{ type?: string; at?: string }>;
    }>("get_upcoming_deadlines", {
      locale: "zh-cn",
      dayLimit: 14,
      atTime: SEED_AT_TIME,
    });

    expect(typeof result.total).toBe("number");
    expect(
      (result.deadlines ?? []).every((d) =>
        ["homework_due", "exam", "todo_due"].includes(d.type ?? ""),
      ),
    ).toBe(true);
    // All deadlines must be on or after the anchor date
    for (const deadline of result.deadlines ?? []) {
      if (deadline.at) {
        expect(deadline.at >= SEED_DATE).toBe(true);
      }
    }
  });

  it("get_upcoming_deadlines excludes already-started exams", async () => {
    const section = await prisma.section.findUnique({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(`Seed section ${DEV_SEED.section.jwId} not found`);
    }

    const jwId = 926042903;
    await prisma.exam.deleteMany({ where: { jwId } });

    try {
      await prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${SEED_DATE}T00:00:00.000Z`),
          startTime: 900,
          endTime: 1100,
        },
      });

      const result = await mcp.call<{
        deadlines?: Array<{
          type?: string;
          payload?: { jwId?: number | null };
        }>;
      }>("get_upcoming_deadlines", {
        locale: "zh-cn",
        dayLimit: 1,
        atTime: shanghaiIsoOnSeedDate(1000),
      });

      expect(
        (result.deadlines ?? []).some(
          (deadline) =>
            deadline.type === "exam" && deadline.payload?.jwId === jwId,
        ),
      ).toBe(false);
    } finally {
      await prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("get_upcoming_deadlines treats date-only atTime as Shanghai day start", async () => {
    const dueAt = `${SEED_DATE}T06:30:00+08:00`;
    const todo = await prisma.todo.create({
      data: {
        userId: devUserId,
        title: "[integration-test] early date-only deadline",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await mcp.call<{
        deadlines?: Array<{
          type?: string;
          at?: string;
          payload?: { id?: string };
        }>;
      }>("get_upcoming_deadlines", {
        locale: "zh-cn",
        dayLimit: 1,
        atTime: SEED_DATE,
      });

      expect(
        (result.deadlines ?? []).some(
          (deadline) =>
            deadline.type === "todo_due" &&
            deadline.at === dueAt &&
            deadline.payload?.id === todo.id,
        ),
      ).toBe(true);
    } finally {
      await prisma.todo.deleteMany({ where: { id: todo.id } });
    }
  });

  it("get_my_overview with atTime reflects the seed day's schedule count", async () => {
    const result = await mcp.call<{
      overview?: {
        pendingTodosCount?: number;
        todaySchedulesCount?: number;
        upcomingExamsCount?: number;
      };
      samples?: { dueTodos?: Array<{ dueAt?: string | null }> };
    }>("get_my_overview", {
      locale: "zh-cn",
      atTime: SEED_AT_TIME,
      mode: "full",
    });

    expect(typeof result.overview?.pendingTodosCount).toBe("number");
    // The seed day has seeded schedules so today's count should be > 0
    expect((result.overview?.todaySchedulesCount ?? 0) > 0).toBe(true);
    expect(typeof result.overview?.upcomingExamsCount).toBe("number");
    expect((result.samples?.dueTodos?.length ?? 0) > 0).toBe(true);
    expect(
      result.samples?.dueTodos?.every((todo) => typeof todo.dueAt === "string"),
    ).toBe(true);

    const summary = await mcp.call<{
      samples?: {
        dueTodos?: { total?: number; items?: Array<{ id?: string }> };
      };
    }>("get_my_overview", {
      locale: "zh-cn",
      atTime: SEED_AT_TIME,
      mode: "summary",
    });
    expect(summary.samples?.dueTodos?.total ?? 0).toBeGreaterThanOrEqual(
      summary.samples?.dueTodos?.items?.length ?? 0,
    );
    expect((summary.samples?.dueTodos?.items?.length ?? 0) <= 3).toBe(true);
  });

  it("get_my_overview excludes homework samples outside the compact overview window", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: devUserId },
      select: {
        subscribedSections: {
          select: { id: true },
          orderBy: { id: "asc" },
          take: 1,
        },
      },
    });
    const sectionId = user.subscribedSections.at(0)?.id;
    if (!sectionId) {
      throw new Error("Dev seed user has no subscribed sections");
    }

    const title = `[integration-test] outside overview window ${Date.now()}`;
    const homework = await prisma.homework.create({
      data: {
        createdById: devUserId,
        isMajor: false,
        requiresTeam: false,
        sectionId,
        submissionDueAt: new Date(`${SEED_PLUS_SEVEN_DAYS}T09:00:00+08:00`),
        title,
        updatedById: devUserId,
      },
      select: { id: true },
    });

    try {
      const result = await mcp.call<{
        samples?: { dueHomeworks?: Array<{ id?: string; title?: string }> };
      }>("get_my_overview", {
        locale: "zh-cn",
        atTime: SEED_AT_TIME,
        mode: "full",
      });

      expect(
        result.samples?.dueHomeworks?.some(
          (sample) => sample.id === homework.id || sample.title === title,
        ),
      ).toBe(false);
    } finally {
      await prisma.homework.deleteMany({ where: { id: homework.id } });
    }
  });

  it("get_my_overview summary mode stays smaller after all due samples pass", async () => {
    const atTime = `${SEED_PLUS_TWELVE_DAYS}T12:00:00+08:00`;
    const defaultPayload = await mcp.callTool("get_my_overview", {
      locale: "zh-cn",
      atTime,
    });
    const summaryPayload = (await mcp.callTool("get_my_overview", {
      locale: "zh-cn",
      atTime,
      mode: "summary",
    })) as {
      samples?: {
        dueTodos?: { total?: number; items?: unknown[] };
        dueHomeworks?: { total?: number; items?: unknown[] };
        upcomingExams?: { total?: number; items?: unknown[] };
      };
    };

    expect(JSON.stringify(summaryPayload, null, 2).length).toBeLessThan(
      JSON.stringify(defaultPayload, null, 2).length,
    );
    expect(typeof summaryPayload.samples?.dueTodos?.total).toBe("number");
    expect(summaryPayload.samples?.dueTodos?.items).toBeUndefined();
    expect(summaryPayload.samples?.dueHomeworks?.items).toBeUndefined();
    expect(summaryPayload.samples?.upcomingExams?.items).toBeUndefined();
  });

  it("get_my_overview excludes same-day exams that already ended", async () => {
    const atTime = `${SEED_DATE}T12:00:00+08:00`;
    const before = await mcp.call<{
      overview?: { upcomingExamsCount?: number };
    }>("get_my_overview", {
      locale: "zh-cn",
      atTime,
    });

    const section = await prisma.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    await prisma.exam.upsert({
      where: { jwId: PAST_SAME_DAY_EXAM_JW_ID },
      update: {
        examDate: new Date(`${SEED_DATE}T00:00:00.000Z`),
        endTime: 1000,
        examMode: "closed",
        examTakeCount: 1,
        examType: 1,
        sectionId: section.id,
        startTime: 900,
      },
      create: {
        jwId: PAST_SAME_DAY_EXAM_JW_ID,
        examDate: new Date(`${SEED_DATE}T00:00:00.000Z`),
        endTime: 1000,
        examMode: "closed",
        examTakeCount: 1,
        examType: 1,
        sectionId: section.id,
        startTime: 900,
      },
    });

    try {
      const result = await mcp.call<{
        overview?: { upcomingExamsCount?: number };
        samples?: { upcomingExams?: Array<{ jwId?: number }> };
      }>("get_my_overview", {
        locale: "zh-cn",
        atTime,
      });

      expect(result.overview?.upcomingExamsCount).toBe(
        before.overview?.upcomingExamsCount,
      );
      expect(
        result.samples?.upcomingExams?.some(
          (exam) => exam.jwId === PAST_SAME_DAY_EXAM_JW_ID,
        ),
      ).toBe(false);
    } finally {
      await prisma.exam.deleteMany({
        where: { jwId: PAST_SAME_DAY_EXAM_JW_ID },
      });
    }
  });
});

// ---------------------------------------------------------------------------
// list_schedules_by_section — new date filter
// ---------------------------------------------------------------------------

describe("list_schedules_by_section — date range filter", () => {
  it("returns all schedules for the section when no date filter is given", async () => {
    const all = await mcp.call<{
      found?: boolean;
      schedules?: Array<{ id?: number; date?: string }>;
    }>("list_schedules_by_section", {
      sectionJwId: DEV_SEED.section.jwId,
      locale: "zh-cn",
    });

    expect(all.found).toBe(true);
    expect((all.schedules?.length ?? 0) > 0).toBe(true);
  });

  it("narrows results to a specific week with dateFrom+dateTo bare dates", async () => {
    const week = await mcp.call<{
      found?: boolean;
      schedules?: Array<{ id?: number; date?: string }>;
    }>("list_schedules_by_section", {
      sectionJwId: DEV_SEED.section.jwId,
      dateFrom: SEED_DATE,
      dateTo: SEED_PLUS_SIX_DAYS,
      locale: "zh-cn",
    });

    expect(week.found).toBe(true);
    // Should only include schedules within the window
    for (const s of week.schedules ?? []) {
      if (s.date) {
        const d = s.date.slice(0, 10);
        expect(d >= SEED_DATE).toBe(true);
        expect(d <= SEED_PLUS_SIX_DAYS).toBe(true);
      }
    }
  });

  it("returns empty schedules array for a window with no matching schedules", async () => {
    const result = await mcp.call<{
      found?: boolean;
      schedules?: unknown[];
    }>("list_schedules_by_section", {
      sectionJwId: DEV_SEED.section.jwId,
      dateFrom: "2020-01-01",
      dateTo: "2020-01-07",
      locale: "zh-cn",
    });

    expect(result.found).toBe(true);
    expect(result.schedules).toHaveLength(0);
  });

  it("returns error message for invalid dateFrom", async () => {
    const result = await mcp.call<{
      success?: boolean;
      message?: string;
    }>("list_schedules_by_section", {
      sectionJwId: DEV_SEED.section.jwId,
      dateFrom: "yesterday",
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("yesterday");
  });
});

describe("query_schedules — flexible date filters", () => {
  it("accepts bare dates and returns paginated public schedules", async () => {
    const result = await mcp.call<{
      data?: Array<{ date?: string; endTime?: unknown; startTime?: unknown }>;
      pagination?: { total?: number };
    }>("query_schedules", {
      sectionJwId: DEV_SEED.section.jwId,
      dateFrom: SEED_DATE,
      dateTo: SEED_PLUS_SIX_DAYS,
      locale: "zh-cn",
    });

    expect(result.pagination?.total).toBeGreaterThan(0);
    expect(typeof result.data?.[0]?.startTime).toBe("string");
    expect(typeof result.data?.[0]?.endTime).toBe("string");
    for (const s of result.data ?? []) {
      if (s.date) {
        const d = s.date.slice(0, 10);
        expect(d >= SEED_DATE).toBe(true);
        expect(d <= SEED_PLUS_SIX_DAYS).toBe(true);
      }
    }
  });

  it("returns a descriptive payload for invalid date filters", async () => {
    const result = await mcp.call<{
      success?: boolean;
      message?: string;
    }>("query_schedules", {
      sectionJwId: DEV_SEED.section.jwId,
      dateFrom: "yesterday",
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("yesterday");
  });
});

describe("course and section lookups", () => {
  it("search_courses returns the REST-equivalent paginated course hierarchy", async () => {
    const seedCourseFilters = await prisma.course.findUnique({
      where: { jwId: DEV_SEED.course.jwId },
      select: {
        categoryId: true,
        classTypeId: true,
        educationLevelId: true,
      },
    });
    expect(seedCourseFilters).toBeTruthy();

    const args: Record<string, unknown> = {
      limit: 10,
      locale: "zh-cn",
      mode: "full",
      page: 1,
    };
    for (const [key, value] of Object.entries(seedCourseFilters ?? {})) {
      if (value != null) args[key] = value;
    }

    const result = await mcp.call<{
      data?: Array<{
        jwId?: number;
        code?: string | null;
        nameCn?: string | null;
        educationLevel?: { nameCn?: string | null } | null;
        category?: { nameCn?: string | null } | null;
        classType?: { nameCn?: string | null } | null;
      }>;
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    }>("search_courses", args);

    expect(result.pagination?.page).toBe(1);
    expect(result.pagination?.pageSize).toBe(10);
    expect(result.pagination?.total).toBeGreaterThan(0);
    expect(result.pagination?.totalPages).toBeGreaterThanOrEqual(1);

    const course = result.data?.find(
      (item) => item.jwId === DEV_SEED.course.jwId,
    );
    expect(course?.code).toBe(DEV_SEED.course.code);
    expect(course?.nameCn).toBe(DEV_SEED.course.nameCn);
    expect(course?.educationLevel?.nameCn).toBe(
      DEV_SEED.course.educationLevelNameCn,
    );
    expect(course?.category?.nameCn).toBe(DEV_SEED.course.categoryNameCn);
    expect(course?.classType?.nameCn).toBe(DEV_SEED.course.classTypeNameCn);
  });

  it("get_section_by_jw_id returns the same detail hierarchy as REST section detail", async () => {
    const result = await mcp.call<{
      found?: boolean;
      section?: {
        code?: string;
        schedules?: Array<{
          endTime?: unknown;
          startTime?: unknown;
        }>;
        teacherAssignments?: unknown[];
        scheduleGroups?: unknown[];
        exams?: unknown[];
        roomType?: unknown;
      };
    }>("get_section_by_jw_id", {
      jwId: DEV_SEED.section.jwId,
      locale: "zh-cn",
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.section?.code).toBe(DEV_SEED.section.code);
    expect(typeof result.section?.schedules?.[0]?.startTime).toBe("string");
    expect(typeof result.section?.schedules?.[0]?.endTime).toBe("string");
    expect((result.section?.teacherAssignments?.length ?? 0) > 0).toBe(true);
    expect(Array.isArray(result.section?.scheduleGroups)).toBe(true);
    expect((result.section?.exams?.length ?? 0) > 0).toBe(true);
    expect(Object.hasOwn(result.section ?? {}, "roomType")).toBe(true);
  });

  it("get_section_by_jw_id returns a recovery hint when the jwId is missing", async () => {
    const result = await mcp.call<{
      found?: boolean;
      message?: string;
      hint?: string;
    }>("get_section_by_jw_id", {
      jwId: 999999999,
      locale: "zh-cn",
    });

    expect(result.found).toBe(false);
    expect(result.message).toContain("999999999");
    expect(result.hint).toContain("search_sections");
  });
});

// ---------------------------------------------------------------------------
// Dashboard snapshot — compact shape verification
// ---------------------------------------------------------------------------

describe("get_my_dashboard — default mode compactness", () => {
  it("atTime anchors nextClass, deadlines, and events", async () => {
    const dashboard = await mcp.call<{
      nextClass?: { type?: string; at?: string | null };
      upcomingDeadlines?: {
        total?: number;
        items?: Array<{ type?: string; at?: string | null }>;
      };
      upcomingEvents?: { total?: number };
    }>("get_my_dashboard", {
      locale: "zh-cn",
      mode: "summary",
      atTime: SEED_AT_TIME,
    });

    expect(dashboard.nextClass?.type).toBe("schedule");
    expect(dashboard.nextClass?.at?.slice(0, 10)).toBe(SEED_DATE);
    expect(dashboard.upcomingDeadlines?.total).toBeGreaterThan(0);
    expect(dashboard.upcomingEvents?.total).toBeGreaterThan(0);
  });

  it("scheduleGroup and roomType are stripped from nextClass payload", async () => {
    const dashboard = await mcp.call<{
      nextClass?: {
        payload?: {
          scheduleGroup?: unknown;
          roomType?: unknown;
          date?: string;
          weekday?: number;
        };
      };
      subscriptions?: { currentSemesterSectionsTotal?: number };
      todos?: { incompleteCount?: number };
    }>("get_my_dashboard", { locale: "zh-cn", atTime: SEED_AT_TIME });

    if (dashboard.nextClass?.payload) {
      expect(dashboard.nextClass.payload).not.toHaveProperty("scheduleGroup");
      expect(dashboard.nextClass.payload).not.toHaveProperty("roomType");
    }
    expect(typeof dashboard.subscriptions?.currentSemesterSectionsTotal).toBe(
      "number",
    );
    expect(typeof dashboard.todos?.incompleteCount).toBe("number");
  });

  it("summary mode is materially smaller than default mode", async () => {
    const def = JSON.stringify(
      await mcp.callTool("get_my_dashboard", {
        locale: "zh-cn",
        mode: "default",
        atTime: SEED_AT_TIME,
      }),
    );
    const sum = JSON.stringify(
      await mcp.callTool("get_my_dashboard", {
        locale: "zh-cn",
        mode: "summary",
        atTime: SEED_AT_TIME,
      }),
    );
    expect(sum.length).toBeLessThan(def.length);
  });
});

// ---------------------------------------------------------------------------
// Bus tools — departure omits repeated campus objects
// ---------------------------------------------------------------------------

describe("get_next_buses — default mode drops repeated campus objects", () => {
  it("accepts date-only atTime for deterministic departure queries", async () => {
    const result = await mcp.call<{ totalRoutes?: number }>("get_next_buses", {
      locale: "zh-cn",
      originCampusId: DEV_SEED.bus.originCampusId,
      destinationCampusId: DEV_SEED.bus.destinationCampusId,
      atTime: SEED_DATE,
    });

    expect(result.totalRoutes).toBeGreaterThan(0);
  });

  it("rejects invalid atTime with the shared MCP date message", async () => {
    const result = await mcp.call<{ success?: boolean; message?: string }>(
      "get_next_buses",
      {
        locale: "zh-cn",
        originCampusId: DEV_SEED.bus.originCampusId,
        destinationCampusId: DEV_SEED.bus.destinationCampusId,
        atTime: "not-a-date",
      },
    );

    expect(result).toMatchObject({
      success: false,
      message:
        'Invalid atTime: "not-a-date". Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS+08:00.',
    });
  });

  it("departure items omit originCampus and destinationCampus", async () => {
    const result = await mcp.call<{
      originCampus?: { id?: number };
      destinationCampus?: { id?: number };
      totalRoutes?: number;
      departures?: Array<{
        routeId?: number;
        originCampus?: unknown;
        destinationCampus?: unknown;
      }>;
      message?: string | null;
    }>("get_next_buses", {
      locale: "zh-cn",
      originCampusId: DEV_SEED.bus.originCampusId,
      destinationCampusId: DEV_SEED.bus.destinationCampusId,
    });

    expect(result.totalRoutes).toBeGreaterThan(0);
    if ((result.departures?.length ?? 0) > 0) {
      // Campus info is at the top level, not repeated per departure
      expect(result.originCampus).toBeDefined();
      for (const dep of result.departures ?? []) {
        expect(dep).not.toHaveProperty("originCampus");
        expect(dep).not.toHaveProperty("destinationCampus");
      }
    } else {
      // No departures → guidance message should be present
      expect(typeof result.message).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Section subscription tools — compact mutation responses
// ---------------------------------------------------------------------------

describe("subscribe_section_by_jw_id — returns action + compact subscription", () => {
  it("subscribing returns action=subscribed or action=already_subscribed", async () => {
    const result = await mcp.call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: {
        sectionCount?: number;
        currentSemesterSections?: unknown;
        sections?: unknown;
      } | null;
    }>("subscribe_section_by_jw_id", {
      jwId: DEV_SEED.section.jwId,
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(["subscribed", "already_subscribed"]).toContain(result.action);
    expect(result.sectionJwId).toBe(DEV_SEED.section.jwId);
    // Brief subscription — sections list not included in default mode
    expect(result.subscription?.sections).toBeUndefined();
    expect(result.subscription?.currentSemesterSections).toBeUndefined();
    expect(typeof result.subscription?.sectionCount).toBe("number");
  });

  it("returns not_found for missing subscribe and unsubscribe targets", async () => {
    const missingJwId = 2_147_483_647;
    const subscribeResult = await mcp.call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: unknown;
    }>("subscribe_section_by_jw_id", {
      jwId: missingJwId,
      locale: "zh-cn",
    });
    const unsubscribeResult = await mcp.call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: unknown;
    }>("unsubscribe_section_by_jw_id", {
      jwId: missingJwId,
      locale: "zh-cn",
    });

    expect(subscribeResult).toMatchObject({
      action: "not_found",
      sectionJwId: missingJwId,
      success: false,
      subscription: null,
    });
    expect(unsubscribeResult).toMatchObject({
      action: "not_found",
      sectionJwId: missingJwId,
      success: false,
      subscription: null,
    });
  });
});
