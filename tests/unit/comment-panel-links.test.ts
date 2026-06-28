import { describe, expect, it } from "vitest";
import {
  absoluteCommentPermalinkHref,
  commentPermalinkHref,
  commentTargetPermalinkBaseHref,
} from "@/features/comments/lib/comment-panel-links";

describe("评论面板链接", () => {
  it("使用足够的作业目标上下文构建评论永久链接", () => {
    const baseHref = commentTargetPermalinkBaseHref({
      homeworkId: "homework-1",
      sectionJwId: 12345,
      type: "homework",
    });

    expect(baseHref).toBe("/sections/12345?tab=homework&homeworkId=homework-1");
    expect(commentPermalinkHref(baseHref, "comment-1")).toBe(
      "/sections/12345?tab=homework&homeworkId=homework-1#comment-comment-1",
    );
  });

  it.each([
    [
      "section",
      commentTargetPermalinkBaseHref({ sectionJwId: 12345, type: "section" }),
      "/sections/12345?tab=comments#comment-comment-1",
    ],
    [
      "section-teacher",
      commentTargetPermalinkBaseHref({
        sectionJwId: 12345,
        type: "section-teacher",
      }),
      "/sections/12345?tab=comments#comment-comment-1",
    ],
    [
      "course",
      commentTargetPermalinkBaseHref({ courseJwId: 67890, type: "course" }),
      "/courses/67890?tab=comments#comment-comment-1",
    ],
    [
      "teacher",
      commentTargetPermalinkBaseHref({ teacherId: 42, type: "teacher" }),
      "/teachers/42?tab=comments#comment-comment-1",
    ],
  ])("根据目标类型保留 %s 评论永久链接", (_, baseHref, expected) => {
    expect(commentPermalinkHref(baseHref, "comment-1")).toBe(expected);
  });

  it("从相对目标基础生成绝对永久链接", () => {
    expect(
      absoluteCommentPermalinkHref({
        commentId: "comment-1",
        currentHref: "https://life.example/dashboard/homeworks",
        permalinkBaseHref: "/sections/12345?tab=homework&homeworkId=homework-1",
      }),
    ).toBe(
      "https://life.example/sections/12345?tab=homework&homeworkId=homework-1#comment-comment-1",
    );
  });
});
