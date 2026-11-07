import { describe, expect, it } from "vitest";
import { homeworkCapabilities } from "@/features/homeworks/lib/homework-capabilities";

describe("homework capabilities", () => {
  it.each([
    [false, false, false, false, false, false],
    [true, false, false, false, true, true],
    [true, true, false, false, true, false],
    [true, false, true, false, false, false],
    [true, true, false, true, false, false],
  ])(
    "separates resolved personal progress from shared content (%s/%s/%s/%s)",
    (isAuthenticated, isSuspended, loading, failed, canComplete, canWriteShared) => {
      expect(
        homeworkCapabilities({ isAuthenticated, isSuspended, loading, failed }),
      ).toEqual({ canComplete, canWriteShared });
    },
  );
});
