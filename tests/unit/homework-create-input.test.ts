import { describe, expect, it } from "vitest";
import { parseCreateHomeworkInput } from "@/lib/api/routes/homework-create-input";

describe("homework create input parsing", () => {
  it("accepts a public section JW ID as an alternate section reference", () => {
    const result = parseCreateHomeworkInput({
      sectionJwId: 12345,
      title: "Homework 1",
    });

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      sectionId: null,
      sectionJwId: 12345,
      title: "Homework 1",
    });
  });

  it("keeps accepting the internal section ID for compatibility", () => {
    const result = parseCreateHomeworkInput({
      sectionId: "42",
      title: "Homework 1",
    });

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      sectionId: 42,
      sectionJwId: null,
    });
  });
});
