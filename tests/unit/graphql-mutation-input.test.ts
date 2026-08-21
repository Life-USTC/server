import { describe, expect, it } from "vitest";
import { dateTimeInput } from "@/lib/graphql/mutation-input";
import { MALFORMED_HOMEWORK_UPDATE_DATE_STRINGS } from "../shared/scenarios/homework-update-invalid-date";

describe("dateTimeInput", () => {
  it("returns null and undefined unchanged", () => {
    expect(dateTimeInput(null)).toBeNull();
    expect(dateTimeInput(undefined)).toBeUndefined();
  });

  it("parses valid date-time strings", () => {
    expect(dateTimeInput("2026-07-20T08:00:00+08:00")).toEqual(
      new Date("2026-07-20T00:00:00.000Z"),
    );
  });

  it.each(MALFORMED_HOMEWORK_UPDATE_DATE_STRINGS)(
    "rejects malformed date string %s",
    (value) => {
      expect(() => dateTimeInput(value)).toThrow(/Invalid date\/time input\./);
      try {
        dateTimeInput(value);
      } catch (error) {
        expect(error).toMatchObject({
          extensions: { code: "BAD_USER_INPUT" },
          message: "Invalid date/time input.",
        });
      }
    },
  );
});
