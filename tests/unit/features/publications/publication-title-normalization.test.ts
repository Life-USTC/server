import { describe, expect, it } from "vitest";
import { normalizePublicationTitle } from "@/features/publications/lib/publication-title-normalization";

describe("normalizePublicationTitle", () => {
  it("collapses ASCII whitespace and trims", () => {
    expect(normalizePublicationTitle("  Campus   Update  ")).toBe(
      "campus update",
    );
  });

  it("lowercases Latin-script titles", () => {
    expect(normalizePublicationTitle("USTC Announces Results")).toBe(
      "ustc announces results",
    );
  });

  it("folds full-width Latin letters and digits to half-width via NFKC", () => {
    expect(normalizePublicationTitle("ＵＳＴＣ２０２６年度报告")).toBe(
      normalizePublicationTitle("USTC2026年度报告"),
    );
  });

  it("folds full-width parentheses and punctuation to half-width", () => {
    expect(normalizePublicationTitle("通知（重要）")).toBe(
      normalizePublicationTitle("通知(重要)"),
    );
  });

  it("collapses the ideographic space (U+3000) and NBSP (U+00A0) to a single space", () => {
    expect(normalizePublicationTitle("中国科学技术大学　通知")).toBe(
      normalizePublicationTitle("中国科学技术大学 通知"),
    );
    expect(normalizePublicationTitle("Campus Update")).toBe(
      normalizePublicationTitle("Campus Update"),
    );
  });

  it("strips zero-width and invisible formatting characters outright", () => {
    expect(normalizePublicationTitle("Cam​pus‌‍⁠Update﻿")).toBe("campusupdate");
    expect(normalizePublicationTitle("Cam­pus")).toBe("campus");
  });

  it("does not fold distinct CJK bracket/quote punctuation styles", () => {
    // NFKC does not decompose these; two titles differing only by this
    // punctuation style are deliberately NOT folded together.
    expect(normalizePublicationTitle("《规划纲要》发布")).not.toBe(
      normalizePublicationTitle("〈规划纲要〉发布"),
    );
  });

  it("must NOT fold titles that are genuinely different articles", () => {
    expect(normalizePublicationTitle("学校召开教学工作会议")).not.toBe(
      normalizePublicationTitle("学校召开科研工作会议"),
    );
    expect(normalizePublicationTitle("关于2026年放假安排的通知")).not.toBe(
      normalizePublicationTitle("关于2027年放假安排的通知"),
    );
  });

  it("must NOT fold titles that differ only by trailing distinguishing text", () => {
    expect(normalizePublicationTitle("重要通知（一）")).not.toBe(
      normalizePublicationTitle("重要通知（二）"),
    );
  });

  it("is idempotent", () => {
    const once = normalizePublicationTitle("  Ｃａｍｐｕｓ　Ｕｐｄａｔｅ  ");
    expect(normalizePublicationTitle(once)).toBe(once);
  });
});
