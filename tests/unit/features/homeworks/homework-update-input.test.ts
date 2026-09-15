import { describe, expect, it } from "vitest";
import { parseUpdateHomeworkInput } from "@/lib/api/routes/homework-update-input";
import {
  INVALID_PUBLISH_DATE_MESSAGE,
  MALFORMED_HOMEWORK_UPDATE_DATE_STRINGS,
} from "../../../shared/scenarios/homework-update-invalid-date";

describe("作业更新输入解析", () => {
  it.each(MALFORMED_HOMEWORK_UPDATE_DATE_STRINGS)(
    "rejects malformed publishedAt %s",
    async (malformedDate) => {
      const result = parseUpdateHomeworkInput(
        { publishedAt: malformedDate },
        "user-1",
      );

      expect(result).toBeInstanceOf(Response);
      if (!(result instanceof Response)) return;

      expect(result.status).toBe(400);
      await expect(result.json()).resolves.toEqual({
        error: INVALID_PUBLISH_DATE_MESSAGE,
      });
    },
  );
});
