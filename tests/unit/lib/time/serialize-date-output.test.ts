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

  test("保留上海历史夏令时语义", () => {
    const value = new Date("1990-07-01T00:00:00.000Z");
    expect(toShanghaiIsoString(value)).toBe("1990-07-01T09:00:00+09:00");
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
  test("preserves fractional seconds for Date, string and historical timestamps", () => {
    for (const iso of [
      "2026-04-30T15:59:59.999Z",
      "2026-04-21T16:00:00.001Z",
      "1990-07-01T00:00:00.123Z",
    ]) {
      for (const input of [iso, new Date(iso)]) {
        const output = toShanghaiIsoString(input);
        expect(Date.parse(output)).toBe(Date.parse(iso));
        expect(output).toMatch(/\.\d{3}\+0[89]:00$/);
      }
      expect(serializeDatesDeep({ value: new Date(iso) })).toEqual({
        value: toShanghaiIsoString(iso),
      });
    }
  });
});
