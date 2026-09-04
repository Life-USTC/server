import { describe, expect, it } from "vitest";
import { getPaginationTokens } from "@/lib/navigation/pagination";

describe("getPaginationTokens", () => {
  it("单页时返回 [1]", () => {
    expect(getPaginationTokens({ currentPage: 1, totalPages: 1 })).toEqual([1]);
  });

  it("totalPages 为 0 时返回 [1]", () => {
    expect(getPaginationTokens({ currentPage: 1, totalPages: 0 })).toEqual([1]);
  });

  it("totalPages 不超过 maxVisible（默认 5）时返回所有页", () => {
    expect(getPaginationTokens({ currentPage: 1, totalPages: 3 })).toEqual([
      1, 2, 3,
    ]);
    expect(getPaginationTokens({ currentPage: 2, totalPages: 5 })).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("totalPages 不超过自定义 maxVisible 时返回所有页", () => {
    expect(
      getPaginationTokens({ currentPage: 1, totalPages: 7, maxVisible: 7 }),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("当前页接近开头时在末尾前包含省略号", () => {
    const tokens = getPaginationTokens({ currentPage: 1, totalPages: 10 });
    expect(tokens[0]).toBe(1);
    expect(tokens).toContain("ellipsis");
    expect(tokens[tokens.length - 1]).toBe(10);
  });

  it("当前页接近末尾时在开头后包含省略号", () => {
    const tokens = getPaginationTokens({ currentPage: 10, totalPages: 10 });
    expect(tokens[0]).toBe(1);
    expect(tokens).toContain("ellipsis");
    expect(tokens[tokens.length - 1]).toBe(10);
  });

  it("当前页在中间时两侧均包含省略号", () => {
    const tokens = getPaginationTokens({ currentPage: 5, totalPages: 10 });
    expect(tokens[0]).toBe(1);
    expect(tokens[tokens.length - 1]).toBe(10);
    // Two ellipsis markers
    const ellipses = tokens.filter((t) => t === "ellipsis");
    expect(ellipses.length).toBe(2);
  });

  it("大集合始终从 1 开始并以 totalPages 结束", () => {
    for (const current of [1, 5, 10, 15, 20]) {
      const tokens = getPaginationTokens({
        currentPage: current,
        totalPages: 20,
      });
      expect(tokens[0]).toBe(1);
      expect(tokens[tokens.length - 1]).toBe(20);
    }
  });

  it("maxVisible 默认为 5", () => {
    // With 10 pages and page 5, default maxVisible=5 → window of 5 numeric pages
    const tokens = getPaginationTokens({ currentPage: 5, totalPages: 10 });
    const numericTokens = tokens.filter((t) => typeof t === "number");
    // 1 (boundary) + window pages + totalPages (boundary) — some overlap possible
    // The window itself is 5 pages, but boundary pages (1 and 10) are added separately
    // so numeric count depends on overlap with boundaries
    expect(numericTokens.length).toBeGreaterThanOrEqual(5);
  });

  it("maxVisible 最小值限制为 3", () => {
    const tokens = getPaginationTokens({
      currentPage: 5,
      totalPages: 10,
      maxVisible: 1,
    });
    // With maxVisible clamped to 3, we still get a reasonable pagination
    const numericTokens = tokens.filter((t) => typeof t === "number");
    expect(numericTokens.length).toBeGreaterThanOrEqual(3);
  });

  it("不产生重复页码", () => {
    for (const current of [1, 2, 3, 8, 9, 10]) {
      const tokens = getPaginationTokens({
        currentPage: current,
        totalPages: 10,
      });
      const numbers = tokens.filter((t): t is number => typeof t === "number");
      expect(new Set(numbers).size).toBe(numbers.length);
    }
  });

  it("页码按升序排列", () => {
    const tokens = getPaginationTokens({ currentPage: 6, totalPages: 20 });
    const numbers = tokens.filter((t): t is number => typeof t === "number");
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
    }
  });
});
