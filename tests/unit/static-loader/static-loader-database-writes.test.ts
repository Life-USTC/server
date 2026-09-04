import { describe, expect, it } from "vitest";
import {
  bulkUpdate,
  bulkUpsert,
  chunks,
} from "@/static-loader/database-writes";

describe("static loader database write guards", () => {
  it("rejects invalid chunk sizes", () => {
    expect(() => chunks([1], 0)).toThrow("positive integer");
  });

  it("rejects mismatched bulk upsert values before executing SQL", async () => {
    await expect(
      bulkUpsert(
        {} as never,
        "Teacher",
        "jwId",
        "int",
        ["nameCn"],
        ["text"],
        [{ key: 1, values: [] }],
      ),
    ).rejects.toThrow("Record values do not match columns for Teacher");
  });

  it("rejects unsafe identifiers before executing SQL", async () => {
    await expect(
      bulkUpdate({} as never, 'Teacher"', ["nameCn"], ["text"], []),
    ).rejects.toThrow("Invalid table name");
  });
});
