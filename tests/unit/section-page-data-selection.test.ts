import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const { sectionFindUnique } = vi.hoisted(() => ({
  sectionFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    section: { findUnique: sectionFindUnique },
  }),
}));

function prismaThenable<T>(value: T): PromiseLike<T> {
  return {
    // biome-ignore lint/suspicious/noThenProperty: Prisma queries intentionally return thenables.
    then(onfulfilled, onrejected) {
      return Promise.resolve(value).then(onfulfilled, onrejected);
    },
  };
}

function sectionRecord() {
  return {
    course: {
      _count: { sections: 42 },
      id: 10,
      jwId: 100,
      namePrimary: "Calculus",
      sections: [
        {
          code: "002",
          id: 21,
          jwId: 31,
          semester: {
            endDate: new Date("2026-07-01T00:00:00.000Z"),
            nameCn: "2026春",
            startDate: new Date("2026-02-01T00:00:00.000Z"),
          },
          semesterId: 20261,
          teachers: [],
        },
      ],
    },
    courseId: 10,
    description: {
      content: "Section description",
      id: "description-1",
      lastEditedAt: null,
      lastEditedBy: null,
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    exams: [],
    id: 20,
    schedules: [],
    teachers: [],
  };
}

describe("section page data selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sectionFindUnique.mockResolvedValue(sectionRecord());
  });

  it("loads the stream page in one Prisma call with bounded related rows and description", async () => {
    sectionFindUnique.mockReturnValue(prismaThenable(sectionRecord()));
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const spans: Array<{
      attributes: Record<string, boolean | number | string | undefined>;
      name: string;
    }> = [];
    const nativePromiseSpans: string[] = [];
    const result = await runWithCloudflareRuntimeEnv(
      {},
      () => getSectionPage(30, "zh-cn"),
      {
        tracing: {
          enterSpan<T>(
            name: string,
            callback: (span: {
              isTraced: boolean;
              setAttribute(
                key: string,
                value?: boolean | number | string,
              ): void;
            }) => T,
          ) {
            const attributes: Record<
              string,
              boolean | number | string | undefined
            > = {};
            spans.push({ attributes, name });
            const spanResult = callback({
              isTraced: true,
              setAttribute(key, value) {
                attributes[key] = value;
              },
            });
            if (spanResult instanceof Promise) nativePromiseSpans.push(name);
            return spanResult;
          },
        },
      },
    );

    expect(sectionFindUnique).toHaveBeenCalledOnce();
    const select = sectionFindUnique.mock.calls[0]?.[0]?.select;
    expect(select.description).toEqual({
      select: expect.objectContaining({ content: true, id: true }),
    });
    expect(select.course.select.sections).toMatchObject({
      take: 20,
      where: { jwId: { not: 30 }, retiredAt: null },
    });
    expect(select.course.select._count).toEqual({
      select: {
        sections: {
          where: { jwId: { not: 30 }, retiredAt: null },
        },
      },
    });
    expect(select).not.toHaveProperty("_count");
    expect(select).not.toHaveProperty("dateTimePlaceText");
    expect(select.teachers.select.department).toBeDefined();
    expect(spans).toEqual([
      {
        attributes: { "catalog.detail.kind": "section" },
        name: "catalog.detail.section.query",
      },
      {
        attributes: { "catalog.detail.kind": "section" },
        name: "catalog.detail.section.transform",
      },
    ]);
    expect(JSON.stringify(spans)).not.toContain("30");
    expect(nativePromiseSpans).toEqual(["catalog.detail.section.query"]);
    expect(result).toMatchObject({
      description: {
        content: "Section description",
        id: "description-1",
      },
      section: {
        examCount: 0,
        otherCourseSectionCount: 42,
        scheduleCount: 0,
      },
    });
    expect(result?.section.otherCourseSections).toEqual([
      expect.objectContaining({
        jwId: 31,
        semester: {
          endDate: "2026-07-01T00:00:00.000Z",
          nameCn: "2026春",
          startDate: "2026-02-01T00:00:00.000Z",
        },
      }),
    ]);
    expect(result).toMatchInlineSnapshot(`
      {
        "description": {
          "content": "Section description",
          "id": "description-1",
          "lastEditedAt": null,
          "lastEditedBy": null,
          "renderedHtml": "<p>Section description</p>",
          "updatedAt": "2026-03-01T08:00:00+08:00",
        },
        "section": {
          "course": {
            "id": 10,
            "jwId": 100,
            "namePrimary": "Calculus",
          },
          "courseId": 10,
          "examCount": 0,
          "exams": [],
          "id": 20,
          "otherCourseSectionCount": 42,
          "otherCourseSections": [
            {
              "code": "002",
              "id": 21,
              "jwId": 31,
              "semester": {
                "endDate": "2026-07-01T00:00:00.000Z",
                "nameCn": "2026春",
                "startDate": "2026-02-01T00:00:00.000Z",
              },
              "semesterId": 20261,
              "teachers": [],
            },
          ],
          "scheduleCount": 0,
          "schedules": [],
          "teachers": [],
        },
      }
    `);
  });

  it("returns JSON-clean page data", async () => {
    const localizedNameSymbol = Symbol("localizedName");
    sectionFindUnique.mockResolvedValue({
      ...sectionRecord(),
      [localizedNameSymbol]: "section",
    });
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const result = await getSectionPage(30, "zh-cn");

    expect(Reflect.ownKeys(result?.section ?? {})).not.toContain(
      localizedNameSymbol,
    );
  });
});
