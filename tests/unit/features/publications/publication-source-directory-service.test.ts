import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sourceFindMany: vi.fn(),
  publicationGroupBy: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    publicationSource: { findMany: mocks.sourceFindMany },
    publication: { groupBy: mocks.publicationGroupBy },
  },
}));

import {
  listPublicationSourceDirectory,
  listPublicationSourceOptions,
} from "@/features/publications/server/publication-source-directory-service";

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "ustc-news",
    name: "中国科学技术大学新闻网",
    organizationLevel: "university",
    allowedHosts: ["news.ustc.edu.cn"],
    ...overrides,
  };
}

describe("publication source directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups sources by organization level in enum order and sums each group", async () => {
    mocks.sourceFindMany.mockResolvedValue([
      source({ id: "jwc", name: "教务处", organizationLevel: "office" }),
      source(),
      source({
        id: "grad",
        name: "研究生院",
        organizationLevel: "office",
        allowedHosts: ["gradschool.ustc.edu.cn"],
      }),
    ]);
    mocks.publicationGroupBy.mockResolvedValue([
      {
        sourceId: "ustc-news",
        _count: { _all: 120 },
        _max: { publishedAt: new Date("2026-09-18T02:00:00.000Z") },
      },
      {
        sourceId: "jwc",
        _count: { _all: 7 },
        _max: { publishedAt: new Date("2026-09-10T02:00:00.000Z") },
      },
    ]);

    const directory = await listPublicationSourceDirectory();

    // `university` is declared before `office`, so it leads regardless of the
    // order the registry rows came back in.
    expect(directory.groups.map((group) => group.organizationLevel)).toEqual([
      "university",
      "office",
    ]);
    expect(directory.groups[0]).toMatchObject({
      sourceCount: 1,
      publicationCount: 120,
    });
    expect(directory.groups[1]).toMatchObject({
      sourceCount: 2,
      publicationCount: 7,
    });
    expect(directory.totals).toEqual({ sourceCount: 3, publicationCount: 127 });
  });

  it("keeps a registered source with no publication yet, at a zero count", async () => {
    mocks.sourceFindMany.mockResolvedValue([
      source({ id: "silent", name: "新接入来源", organizationLevel: "center" }),
    ]);
    mocks.publicationGroupBy.mockResolvedValue([]);

    const directory = await listPublicationSourceDirectory();

    expect(directory.groups).toHaveLength(1);
    expect(directory.groups[0].sources[0]).toMatchObject({
      id: "silent",
      publicationCount: 0,
      lastPublishedAt: null,
      hosts: ["news.ustc.edu.cn"],
    });
  });

  it("orders sources within a group by publication count, then name", async () => {
    mocks.sourceFindMany.mockResolvedValue([
      source({ id: "b", name: "乙", organizationLevel: "office" }),
      source({ id: "a", name: "甲", organizationLevel: "office" }),
      source({ id: "c", name: "丙", organizationLevel: "office" }),
    ]);
    mocks.publicationGroupBy.mockResolvedValue([
      { sourceId: "b", _count: { _all: 9 }, _max: { publishedAt: null } },
      { sourceId: "a", _count: { _all: 2 }, _max: { publishedAt: null } },
      { sourceId: "c", _count: { _all: 2 }, _max: { publishedAt: null } },
    ]);

    const directory = await listPublicationSourceDirectory();

    expect(directory.groups[0].sources.map((entry) => entry.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("counts only sources the reader can actually browse", async () => {
    mocks.sourceFindMany.mockResolvedValue([]);
    mocks.publicationGroupBy.mockResolvedValue([]);

    await listPublicationSourceDirectory();

    expect(mocks.sourceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enabled: true, discoveryOnly: false },
      }),
    );
    // The aggregate reuses the list read's visibility filter, so a source's
    // count cannot disagree with /news?source=<id>.
    const groupByArgs = mocks.publicationGroupBy.mock.calls[0][0];
    expect(groupByArgs.by).toEqual(["sourceId"]);
    expect(groupByArgs.where).toMatchObject({
      deletedAt: null,
      currentRevision: { is: { isTombstone: false } },
    });
  });

  it("reads filter options without the publication aggregate", async () => {
    mocks.sourceFindMany.mockResolvedValue([
      { id: "jwc", name: "教务处", organizationLevel: "office" },
    ]);

    const options = await listPublicationSourceOptions();

    expect(options).toEqual([
      { id: "jwc", name: "教务处", organizationLevel: "office" },
    ]);
    expect(mocks.publicationGroupBy).not.toHaveBeenCalled();
  });
});
