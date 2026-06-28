import { describe, expect, test } from "vitest";
import {
  serializeDatesDeep,
  toShanghaiIsoString,
} from "@/lib/time/serialize-date-output";

describe("serialize-date-output", () => {
  test("将日期格式化为带偏移的上海 ISO", () => {
    const value = new Date("2026-03-26T04:00:00.000Z");
    expect(toShanghaiIsoString(value)).toBe("2026-03-26T12:00:00+08:00");
  });

  test("序列化嵌套的 Date 值", () => {
    const payload = {
      createdAt: new Date("2026-03-26T04:00:00.000Z"),
      nested: {
        dates: [new Date("2026-03-25T16:00:00.000Z")],
      },
    };
    expect(serializeDatesDeep(payload)).toEqual({
      createdAt: "2026-03-26T12:00:00+08:00",
      nested: {
        dates: ["2026-03-26T00:00:00+08:00"],
      },
    });
  });
});
