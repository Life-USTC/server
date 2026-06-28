import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("match_section_codes — 班级代码匹配", () => {
  it("在当前学期匹配单个班级代码", async () => {
    const result = await context.client.call<{
      success?: boolean;
      semester?: { id?: number; nameCn?: string; code?: string };
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      suggestions?: Record<string, unknown>;
      sections?: Array<{ code?: string; jwId?: number }>;
      total?: number;
      note?: string;
    }>("match_section_codes", {
      codes: [fixtures.DEV_SEED.section.code],
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.semester?.nameCn).toBe(fixtures.DEV_SEED.semesterNameCn);
    expect(result.matchedCodes).toContain(fixtures.DEV_SEED.section.code);
    expect(result.unmatchedCodes).toEqual([]);
    expect(result.total).toBe(1);
    expect(result.sections?.[0]?.code).toBe(fixtures.DEV_SEED.section.code);
    expect(result.note).toContain("Life@USTC");
  });

  it("支持多个代码并区分匹配与未匹配，且为未匹配代码提供建议", async () => {
    const unmatchedCode = fixtures.DEV_SEED.section.code.replace(
      /\.\d+$/,
      ".02",
    );

    const result = await context.client.call<{
      success?: boolean;
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      suggestions?: Record<string, string[]>;
      total?: number;
    }>("match_section_codes", {
      codes: [fixtures.DEV_SEED.section.code, unmatchedCode],
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.matchedCodes).toContain(fixtures.DEV_SEED.section.code);
    expect(result.matchedCodes).not.toContain(unmatchedCode);
    expect(result.unmatchedCodes).toContain(unmatchedCode);
    expect(result.total).toBe(1);
    expect(result.suggestions?.[unmatchedCode]).toContain(
      fixtures.DEV_SEED.section.code,
    );
  });

  it("可按 semesterId 查询历史学期班级代码", async () => {
    const previousSemester = await fixtures.prisma.semester.findUnique({
      where: { jwId: fixtures.DEV_SEED.previousSemesterJwId },
      select: { id: true, nameCn: true },
    });
    expect(previousSemester).toBeTruthy();

    const previousSection = fixtures.DEV_SEED.sections.find(
      (section) => section.code === "MATH2001.01",
    );
    expect(previousSection).toBeTruthy();
    if (!previousSemester || !previousSection) {
      throw new Error("Previous semester or section seed data missing");
    }

    const result = await context.client.call<{
      success?: boolean;
      semester?: { id?: number; nameCn?: string };
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      total?: number;
    }>("match_section_codes", {
      codes: [previousSection.code],
      semesterId: previousSemester.id,
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.semester?.id).toBe(previousSemester.id);
    expect(result.semester?.nameCn).toBe(
      fixtures.DEV_SEED.previousSemesterNameCn,
    );
    expect(result.matchedCodes).toContain(previousSection.code);
    expect(result.unmatchedCodes).toEqual([]);
    expect(result.total).toBe(1);
  });

  it("在 semesterId 不存在时返回失败提示", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("match_section_codes", {
      codes: [fixtures.DEV_SEED.section.code],
      semesterId: 2_147_483_647,
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No semester found");
  });

  it("拒绝空代码数组", async () => {
    await expect(
      context.client.call("match_section_codes", {
        codes: [],
        locale: "zh-cn",
      }),
    ).rejects.toThrow();
  });

  it("拒绝非法格式班级代码", async () => {
    await expect(
      context.client.call("match_section_codes", {
        codes: ["bad code!"],
        locale: "zh-cn",
      }),
    ).rejects.toThrow();
  });
});
