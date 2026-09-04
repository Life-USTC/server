import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const { sectionFindUnique } = vi.hoisted(() => ({
  sectionFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    section: { findUnique: sectionFindUnique },
  }),
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: vi.fn(async () => "test-revision"),
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

function sectionCoreRecord() {
  const { description: _description, ...core } = sectionRecord();
  return core;
}

describe("section page data selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPublicRuntimeCacheForTest();
    sectionFindUnique.mockImplementation((query) =>
      Promise.resolve(
        query.select.course
          ? sectionCoreRecord()
          : { description: sectionRecord().description, retiredAt: null },
      ),
    );
  });

  it("caches static page core while loading the editable description separately", async () => {
    sectionFindUnique.mockImplementation((query) =>
      prismaThenable(
        query.select.course
          ? sectionCoreRecord()
          : { description: sectionRecord().description, retiredAt: null },
      ),
    );
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

    expect(sectionFindUnique).toHaveBeenCalledTimes(2);
    const coreSelect = sectionFindUnique.mock.calls.find(
      ([query]) => query?.select?.course,
    )?.[0]?.select;
    const descriptionSelect = sectionFindUnique.mock.calls.find(
      ([query]) => query?.select?.description && !query?.select?.course,
    )?.[0]?.select;
    expect(coreSelect.description).toBe(false);
    expect(descriptionSelect).toEqual({
      description: {
        select: expect.objectContaining({ content: true, id: true }),
      },
      retiredAt: true,
    });
    expect(coreSelect.course.select.sections).toMatchObject({
      take: 20,
      where: { jwId: { not: 30 }, retiredAt: null },
    });
    expect(coreSelect.course.select._count).toEqual({
      select: {
        sections: {
          where: { jwId: { not: 30 }, retiredAt: null },
        },
      },
    });
    expect(coreSelect).not.toHaveProperty("_count");
    expect(coreSelect).not.toHaveProperty("dateTimePlaceText");
    expect(coreSelect.teachers.select.department).toBeDefined();
    expect(spans).toEqual(
      expect.arrayContaining([
        {
          attributes: { "catalog.detail.kind": "section" },
          name: "catalog.detail.section.mutable.query",
        },
        {
          attributes: { "catalog.detail.kind": "section" },
          name: "catalog.detail.section.query",
        },
        {
          attributes: { "catalog.detail.kind": "section" },
          name: "catalog.detail.section.transform",
        },
      ]),
    );
    expect(JSON.stringify(spans)).not.toContain("30");
    expect(nativePromiseSpans).toEqual(
      expect.arrayContaining(["catalog.detail.section.query"]),
    );
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
          "retiredAt": null,
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

  it("keeps edited descriptions fresh when the static page core is cached", async () => {
    let descriptionContent = "First description";
    sectionFindUnique.mockImplementation((query) => {
      if (query.select.course) {
        return Promise.resolve(sectionCoreRecord());
      }
      return Promise.resolve({
        description: {
          ...sectionRecord().description,
          content: descriptionContent,
        },
        retiredAt: null,
      });
    });
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const first = await getSectionPage(30, "zh-cn");
    descriptionContent = "Edited description";
    const second = await getSectionPage(30, "zh-cn");

    expect(first?.description.content).toBe("First description");
    expect(second?.description.content).toBe("Edited description");
    expect(
      sectionFindUnique.mock.calls.filter(([query]) => query.select.course),
    ).toHaveLength(1);
    expect(
      sectionFindUnique.mock.calls.filter(
        ([query]) => query.select.description && !query.select.course,
      ),
    ).toHaveLength(2);
  });

  it("keeps section lifecycle state fresh when the static page core is cached", async () => {
    let retiredAt: Date | null = null;
    sectionFindUnique.mockImplementation((query) =>
      Promise.resolve(
        query.select.course
          ? sectionCoreRecord()
          : { description: sectionRecord().description, retiredAt },
      ),
    );
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const active = await getSectionPage(30, "zh-cn");
    retiredAt = new Date("2026-08-26T00:00:00.000Z");
    const retired = await getSectionPage(30, "zh-cn");

    expect(
      sectionFindUnique.mock.calls.filter(([query]) => query.select.course),
    ).toHaveLength(1);
    expect(active?.section.retiredAt).toBeNull();
    expect(retired?.section.retiredAt).toBe("2026-08-26T00:00:00.000Z");
  });
});
