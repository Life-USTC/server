import { describe, expect, it } from "vitest";
import {
  buildDemoCatalogDescription,
  getDemoCatalogCourse,
  getDemoCatalogPersonal,
  getDemoCatalogSection,
  getDemoCatalogSectionPage,
  getDemoCatalogTeacher,
} from "@/features/demo/server/demo-catalog";
import { resolveDemoCatalogTarget } from "@/features/demo/server/demo-catalog-community";
import {
  getDemoCommentsRoute,
  getDemoDescriptionRoute,
  getDemoSectionDetailRoute,
} from "@/lib/api/routes/demo-catalog-read-routes";
import { sectionDetailSchema } from "@/lib/api/schemas/academic-section-detail-response-schemas";
import { commentsListResponseSchema } from "@/lib/api/schemas/comments-response-schemas";

describe("demo catalog projections", () => {
  it.each(["zh-cn", "en-us"] as const)(
    "keeps section, course and teacher identities consistent in %s",
    (locale) => {
      const section = sectionDetailSchema.parse(
        getDemoCatalogSection(910001, locale),
      );
      expect(section).toMatchObject({
        id: 101,
        jwId: 910001,
        course: {
          id: 201,
          jwId: 920001,
          code: "DEMO-MATH01",
          namePrimary: locale === "en-us" ? "Linear Algebra" : "线性代数",
        },
        teachers: [{ id: 401 }, { id: 402 }],
        schedules: [{ date: "2026-09-24T00:00:00+08:00", startTime: "800" }],
        exams: [{ examDate: "2027-01-08T00:00:00+08:00" }],
      });
      expect(getDemoCatalogSectionPage(910001, locale)?.section).toMatchObject({
        examCount: 1,
        scheduleCount: 1,
        schedules: [{ startTime: 800, teachers: [{ id: 401 }, { id: 402 }] }],
      });
      expect(getDemoCatalogCourse(920001, locale)).toMatchObject({
        id: 201,
        _count: { sections: 1 },
        sections: [{ jwId: 910001 }],
      });
      expect(getDemoCatalogTeacher(401, locale)).toMatchObject({
        id: 401,
        _count: { sections: 2 },
        sections: [{ jwId: 910001 }, { jwId: 910002 }],
        email: null,
      });
      expect(getDemoCatalogPersonal(910001, locale)).toMatchObject({
        viewer: { signedIn: false, isSubscribed: true },
        homeworkData: {
          homeworks: [],
          auditLogs: [],
          viewer: { userId: null, isAuthenticated: false },
        },
      });
      expect(
        buildDemoCatalogDescription("teacher", 401, locale).description.content,
      ).toBe(
        locale === "en-us"
          ? "Explore the sample teaching sections below."
          : "你可以在下方浏览这位老师的演示教学班。",
      );
    },
  );

  it("keeps spring samples and out-of-range history independent of the current date", () => {
    expect(getDemoCatalogSection(910003, "zh-cn")).toMatchObject({
      semesterId: 2602,
      schedules: [{ date: "2026-03-12T00:00:00+08:00" }],
      exams: [{ examDate: "2026-06-26T00:00:00+08:00" }],
    });
    expect(getDemoCatalogCourse(920001, "en-us", 2)?.sections).toEqual([]);
    expect(getDemoCatalogTeacher(401, "en-us", 2)?.sections).toEqual([]);
    expect(getDemoCatalogSection(1, "en-us")).toBeNull();
    expect(getDemoCatalogSectionPage(1, "en-us")).toBeNull();
    expect(getDemoCatalogPersonal(1, "en-us")).toBeNull();
    expect(getDemoCatalogCourse(1, "en-us")).toBeNull();
    expect(getDemoCatalogTeacher(1, "en-us")).toBeNull();
  });

  it.each([
    [
      { targetType: "section", targetId: "101", sectionJwId: "910001" },
      { targetId: 101, sectionJwId: 910001 },
    ],
    [
      { targetType: "course", targetId: "201", courseJwId: "920001" },
      { targetId: 201, courseJwId: 920001 },
    ],
    [
      { targetType: "teacher", targetId: "401", teacherId: "401" },
      { targetId: 401, teacherName: "Teacher Chen" },
    ],
    [
      {
        targetType: "section-teacher",
        sectionId: "101",
        sectionJwId: "910001",
        teacherId: "401",
      },
      {
        targetId: null,
        sectionTeacherSectionId: 101,
        sectionTeacherTeacherId: 401,
      },
    ],
  ])("resolves supported sample references %j", (input, expected) => {
    expect(resolveDemoCatalogTarget(input, "en-us")).toMatchObject(expected);
  });

  it.each([
    { targetType: "section" },
    { targetType: "section", targetId: "1" },
    { targetType: "section", targetId: "101", sectionJwId: "910002" },
    { targetType: "section", targetId: "101", courseJwId: "920001" },
    { targetType: "course", targetId: "201", courseJwId: "920002" },
    { targetType: "teacher", targetId: "401", teacherId: "402" },
    { targetType: "section-teacher", sectionId: "102", teacherId: "402" },
    { targetType: "section-teacher", sectionId: "101" },
    {
      targetType: "section-teacher",
      sectionId: "101",
      teacherId: "401",
      targetId: "1",
    },
    { targetType: "section", targetId: "101", homeworkId: "private" },
    { targetType: "homework", targetId: "private" },
  ])("rejects unknown or mixed references %j", (input) => {
    expect(resolveDemoCatalogTarget(input, "en-us")).toBeNull();
  });
});

describe("demo catalog read adapters", () => {
  const request = (path: string) => new Request(`https://life.test${path}`);
  it("keeps the section API locale and response schema", async () => {
    const response = getDemoSectionDetailRoute(
      request("/api/catalog/sections/910001?locale=en-us"),
      "910001",
      "zh-cn",
    );
    expect(response.status).toBe(200);
    expect(
      sectionDetailSchema.parse(await response.json()).course.namePrimary,
    ).toBe("Linear Algebra");
    expect(
      getDemoSectionDetailRoute(
        request("/api/catalog/sections/1"),
        "1",
        "en-us",
      ).status,
    ).toBe(404);
    expect(
      getDemoSectionDetailRoute(
        request("/api/catalog/sections/910001?includeExams=invalid"),
        "910001",
        "en-us",
      ).status,
    ).toBe(400);
  });
  it.each([
    ["includeExams=true", 1, 0],
    ["includeSchedules=true", 0, 1],
    ["includeTeacherDepartments=true", 0, 0],
    ["includeExams=false", 0, 0],
    ["includeSchedules=true&includeExams=true", 1, 1],
  ])(
    "preserves partial section reads for %s",
    async (query, exams, schedules) => {
      const response = getDemoSectionDetailRoute(
        request(`/api/catalog/sections/910001?${query}`),
        "910001",
        "en-us",
      );
      const section = sectionDetailSchema.parse(await response.json());
      expect(section.exams).toHaveLength(exams);
      expect(section.schedules).toHaveLength(schedules);
      expect(section.scheduleGroups).toHaveLength(schedules);
      expect(section.teachers).toHaveLength(2);
    },
  );
  it("returns read-only descriptions and empty discussion pages for resolved samples", async () => {
    const description = getDemoDescriptionRoute(
      request(
        "/api/community/descriptions?targetType=course&courseJwId=920001",
      ),
      "en-us",
    );
    expect(description.status).toBe(200);
    expect(await description.json()).toMatchObject({
      description: { id: "demo-description-course-201" },
      history: [],
      viewer: { userId: null, isAuthenticated: false },
    });
    const comments = getDemoCommentsRoute(
      request(
        "/api/community/comments?targetType=section-teacher&sectionId=101&teacherId=401&page=2&pageSize=5",
      ),
      "en-us",
    );
    expect(comments.status).toBe(200);
    expect(
      commentsListResponseSchema.parse(await comments.json()),
    ).toMatchObject({
      data: [],
      pagination: { page: 2, pageSize: 5, total: 0 },
      meta: {
        hiddenCount: 0,
        target: { sectionTeacherTeacherId: 401 },
        viewer: { isAuthenticated: false },
      },
    });
  });
  it.each([getDemoDescriptionRoute, getDemoCommentsRoute])(
    "rejects missing and unknown targets",
    async (read) => {
      expect(read(request("/api/community/descriptions"), "en-us").status).toBe(
        400,
      );
      expect(
        read(
          request(
            "/api/community/descriptions?targetType=section&targetId=999",
          ),
          "en-us",
        ).status,
      ).toBe(404);
    },
  );
});
