import { describe, expect, it, vi } from "vitest";
import { getDemoDiscussionRecords } from "@/features/demo/server/demo-community";
import type { DemoCommunityRecord } from "@/features/demo/server/demo-community-fixture";
import { getDemoHomeworks } from "@/features/demo/server/demo-homeworks";
import {
  getDemoPublicUserProfile,
  projectDemoProfileActivity,
} from "@/features/demo/server/demo-public-profile";
import { publicUserProfileResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";

describe("closed Demo public authors", () => {
  for (const locale of ["en-us", "zh-cn"] as const) {
    it(`projects both established authors and their complete discussion graph in ${locale}`, () => {
      const records = getDemoDiscussionRecords(locale);
      expect(records).toHaveLength(69);
      expect(
        records.every(({ comment }) => comment.attachments?.length === 0),
      ).toBe(true);
      expect(
        getDemoHomeworks(locale).every(
          (homework) =>
            homework.createdById === null && homework.createdBy === null,
        ),
      ).toBe(true);
      for (const [key, count, name, counts] of [
        [
          "xia",
          35,
          locale === "en-us" ? "Sample student Xia" : "样例同学·小夏",
          {
            "2026-09-20": 1,
            "2026-09-21": 10,
            "2026-09-22": 5,
            "2026-09-23": 19,
          },
        ],
        [
          "qiu",
          34,
          locale === "en-us" ? "Sample student Qiu" : "样例同学·小秋",
          { "2026-09-21": 10, "2026-09-22": 6, "2026-09-23": 18 },
        ],
      ] as const) {
        const profile = getDemoPublicUserProfile(
          `demo-community-${key}`,
          locale,
        );
        expect(profile).not.toBeNull();
        if (!profile) throw new Error("Missing fixed author");
        expect(publicUserProfileResponseSchema.parse(profile)).toEqual(profile);
        expect(profile.user).toEqual({
          id: `demo-community-${key}`,
          username: `sample-${key}`,
          name,
          image: "/images/icon.png",
          createdAt: "2026-09-01T01:00:00.000Z",
          _count: { comments: count, uploads: 0, homeworksCreated: 0 },
        });
        expect(profile.totalContributions).toBe(count);
        expect(profile.weeks).toHaveLength(53);
        expect(profile.weeks.every((week) => week.length === 7)).toBe(true);
        expect(profile.weeks[0][0]).toEqual({ date: "2025-09-21", count: 0 });
        expect(profile.weeks.at(-1)?.at(-1)).toEqual({
          date: "2026-09-26",
          count: 0,
        });
        expect(
          Object.fromEntries(
            profile.weeks
              .flat()
              .filter((cell) => cell.count)
              .map((cell) => [cell.date, cell.count]),
          ),
        ).toEqual(counts);
        for (const identifier of [
          `sample-${key}`,
          ` SAMPLE-${key.toUpperCase()} `,
        ])
          expect(getDemoPublicUserProfile(identifier, locale)).toEqual(profile);
      }
    });
  }

  it("closes aliases before any real identifier can enter the projection", () => {
    for (const identifier of [
      "",
      "   ",
      "demo-student",
      "real-database-user",
      "__proto__",
      "DEMO-COMMUNITY-XIA",
      "sample-xia/other",
    ])
      expect(getDemoPublicUserProfile(identifier, "en-us")).toBeNull();
  });

  it("uses the fixed reference date rather than the wall clock", () => {
    const expected = getDemoPublicUserProfile("sample-xia", "en-us");
    vi.useFakeTimers();
    try {
      for (const now of ["1990-01-01T00:00:00Z", "2050-12-31T23:59:59Z"]) {
        vi.setSystemTime(new Date(now));
        expect(getDemoPublicUserProfile("sample-xia", "en-us")).toEqual(
          expected,
        );
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts public active named undeleted roots and replies without assigning anonymous records", () => {
    const source = getDemoDiscussionRecords("en-us")[0];
    const changes: Partial<DemoCommunityRecord["comment"]>[] = [
      {},
      { parentId: source.comment.id, rootId: source.comment.id },
      { status: "softbanned" },
      { status: "deleted" },
      { visibility: "logged_in_only" },
      { isAnonymous: true },
      { isAnonymous: null },
      { deletedAt: new Date("2026-09-23T00:00:00Z") },
      { userId: "someone-else" },
    ];
    const records = changes.map((change, index) => ({
      target: source.target,
      comment: { ...source.comment, id: `visibility-${index}`, ...change },
    }));
    const result = projectDemoProfileActivity(
      "demo-community-xia",
      records,
      [],
    );
    expect(result.commentCount).toBe(2);
    expect(result.totalContributions).toBe(2);
  });

  it("limits heatmap dates inclusively while all-time counts retain older and future records", () => {
    const source = getDemoDiscussionRecords("en-us")[0];
    const records = [
      "2025-09-24T23:59:59+08:00",
      "2025-09-25T00:00:00+08:00",
      "2026-09-24T23:59:59+08:00",
      "2026-09-25T00:00:00+08:00",
    ].map((date, index) => ({
      target: source.target,
      comment: {
        ...source.comment,
        id: `date-${index}`,
        createdAt: new Date(date),
      },
    }));
    const result = projectDemoProfileActivity("demo-community-xia", records, [
      { createdById: null, deletedAt: null, createdAt: "2026-09-20T00:00:00Z" },
      {
        createdById: "demo-community-xia",
        deletedAt: null,
        createdAt: "2026-09-20T00:00:00Z",
      },
      {
        createdById: "demo-community-xia",
        deletedAt: "2026-09-21T00:00:00Z",
        createdAt: "2026-09-20T00:00:00Z",
      },
    ]);
    expect(result.commentCount).toBe(4);
    expect(result.homeworkCount).toBe(1);
    expect(result.totalContributions).toBe(3);
    expect(
      result.weeks.flat().find((cell) => cell.date === "2025-09-24")?.count,
    ).toBe(0);
    expect(
      result.weeks.flat().find((cell) => cell.date === "2026-09-25")?.count,
    ).toBe(0);
  });

  it("returns fresh profiles, nested counters and cells on every read", () => {
    const first = getDemoPublicUserProfile("sample-xia", "en-us");
    if (!first) throw new Error("Missing fixed author");
    first.user.name = "Changed";
    first.user._count.comments = 999;
    first.weeks[0][0].count = 999;
    const next = getDemoPublicUserProfile("sample-xia", "en-us");
    expect(next?.user.name).toBe("Sample student Xia");
    expect(next?.user._count.comments).toBe(35);
    expect(next?.weeks[0][0].count).toBe(0);
  });
});
