import { describe, expect, it } from "vitest";
import {
  parseShanghaiDateTimeLocalInput,
  toShanghaiDateTimeLocalValue,
} from "@/lib/time/shanghai-format";

describe("上海日期时间表单辅助函数", () => {
  it("为 datetime-local 输入格式化 Date 和字符串值", () => {
    expect(
      toShanghaiDateTimeLocalValue(new Date("2026-03-17T10:30:00+08:00")),
    ).toBe("2026-03-17T10:30");
    expect(toShanghaiDateTimeLocalValue("2026-03-17T10:30:00+08:00")).toBe(
      "2026-03-17T10:30",
    );
  });

  it("对缺失或无效输入返回空表单值", () => {
    expect(toShanghaiDateTimeLocalValue(null)).toBe("");
    expect(toShanghaiDateTimeLocalValue(undefined)).toBe("");
    expect(toShanghaiDateTimeLocalValue("not-a-date")).toBe("");
  });

  it("将空白表单输入解析为已清除，无效输入解析为 undefined", () => {
    expect(parseShanghaiDateTimeLocalInput(" ")).toBeNull();
    expect(parseShanghaiDateTimeLocalInput("not-a-date")).toBeUndefined();
  });
});
