import { describe, expect, it } from "vitest";
import { officialAcademicProfileSchema } from "@/features/catalog/lib/official-academic-profile";
import { toOfficialAcademicProfile } from "@/features/catalog/server/official-academic-profile";

describe("official academic profile", () => {
  it("exposes only the public fields and converts upstream rich text to text", () => {
    const profile = toOfficialAcademicProfile({
      credit: 0,
      hour: 40,
      examType: "Project",
      lessonLang: "中文",
      lang: "English",
      internal: "unpublished",
      jw: { raw: "unpublished" },
      desc: { cn: "<p>第一段</p><p>第二段 &amp; 示例</p>", en: null },
      textbooks: [{ nameEn: "Python", author: "A. Author", internal: 42 }],
      syllabus: {
        documents: JSON.stringify({
          "language-zh": {
            paragraphs: [
              {
                title: "教学目标",
                content: "<script>hidden</script><p>数组</p>",
              },
              { title: "空条目", content: null },
            ],
          },
        }),
        periods: [{ nameZh: "练习", period: 2 }],
      },
    });

    expect(officialAcademicProfileSchema.safeParse(profile).success).toBe(true);
    expect(profile).toMatchObject({
      credits: 0,
      hours: 40,
      language: "中文",
      assessment: "Project",
      description: { zh: "第一段\n第二段 & 示例", en: null },
      syllabus: {
        zh: [{ title: "教学目标", content: "数组" }],
        en: [],
        topics: [{ name: "练习", hours: 2 }],
      },
    });
    expect(profile?.textbooks).toEqual([
      { nameZh: null, nameEn: "Python", author: "A. Author", isbn: null },
    ]);
    expect(profile).not.toHaveProperty("jw");
    expect(profile).not.toHaveProperty("internal");
  });

  it("keeps unknown values null and tolerates malformed optional documents", () => {
    expect(toOfficialAcademicProfile(null)).toBeNull();
    expect(
      toOfficialAcademicProfile({ examType: "", syllabus: { documents: "{" } }),
    ).toMatchObject({
      assessment: null,
      textbook: null,
      textbooks: [],
      syllabus: { zh: [], en: [], topics: [] },
    });
  });
});
