import { describe, expect, it } from "vitest";
import {
  calendarSubscriptionCreateRequestSchema,
  commentReactionRequestSchema,
  coursesQuerySchema,
  descriptionUpsertRequestSchema,
  homeworkCompletionBatchRequestSchema,
  homeworkCreateRequestSchema,
  localeUpdateRequestSchema,
  matchSectionCodesRequestSchema,
  schedulesQuerySchema,
  sectionsQuerySchema,
  uploadCreateRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import {
  meResponseSchema,
  openApiErrorSchema,
} from "@/lib/api/schemas/response-schemas";

describe("matchSectionCodesRequestSchema", () => {
  it("accepts valid payload", () => {
    const result = matchSectionCodesRequestSchema.safeParse({
      codes: ["COMP101.01", "MATH204.02"],
      semesterId: "12",
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty codes and invalid code format", () => {
    const empty = matchSectionCodesRequestSchema.safeParse({
      codes: [],
    });
    expect(empty.success).toBe(false);

    const invalidCode = matchSectionCodesRequestSchema.safeParse({
      codes: [""],
    });
    expect(invalidCode.success).toBe(false);
  });
});

describe("homeworkCreateRequestSchema", () => {
  it("accepts valid payload", () => {
    const result = homeworkCreateRequestSchema.safeParse({
      sectionId: "12",
      title: "  作业 1  ",
      description: "desc",
      isMajor: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = homeworkCreateRequestSchema.safeParse({
      sectionId: 3,
      title: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("homeworkCompletionBatchRequestSchema", () => {
  it("accepts completion updates", () => {
    const result = homeworkCompletionBatchRequestSchema.safeParse({
      items: [
        { homeworkId: "homework-1", completed: true },
        { homeworkId: "homework-2", completed: false },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty item lists and blank homework IDs", () => {
    expect(
      homeworkCompletionBatchRequestSchema.safeParse({ items: [] }).success,
    ).toBe(false);
    expect(
      homeworkCompletionBatchRequestSchema.safeParse({
        items: [{ homeworkId: "", completed: true }],
      }).success,
    ).toBe(false);
  });
});

describe("descriptionUpsertRequestSchema", () => {
  it("accepts homework string targetId", () => {
    const result = descriptionUpsertRequestSchema.safeParse({
      targetType: "homework",
      targetId: "hw_123",
      content: "text",
    });
    expect(result.success).toBe(true);
  });

  it("rejects numeric targets with invalid id", () => {
    const result = descriptionUpsertRequestSchema.safeParse({
      targetType: "section",
      targetId: "abc",
      content: "text",
    });
    expect(result.success).toBe(false);
  });
});

describe("other request schemas", () => {
  it("validates upload create payload", () => {
    const valid = uploadCreateRequestSchema.safeParse({
      filename: "a.txt",
      size: "123",
    });
    expect(valid.success).toBe(true);
  });

  it("validates calendar subscription payload", () => {
    const valid = calendarSubscriptionCreateRequestSchema.safeParse({
      sectionIds: [1, 2, 3],
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid reaction type", () => {
    const invalid = commentReactionRequestSchema.safeParse({
      type: "boom",
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects unsupported locale", () => {
    const invalid = localeUpdateRequestSchema.safeParse({
      locale: "fr-fr",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates query schemas", () => {
    expect(
      sectionsQuerySchema.safeParse({ courseId: "1", ids: "1,2" }).success,
    ).toBe(true);
    expect(
      schedulesQuerySchema.safeParse({ weekday: "2", page: "1" }).success,
    ).toBe(true);
    expect(coursesQuerySchema.safeParse({ search: "math" }).success).toBe(true);

    expect(sectionsQuerySchema.safeParse({ courseId: "abc" }).success).toBe(
      false,
    );
    expect(schedulesQuerySchema.safeParse({ weekday: "x" }).success).toBe(
      false,
    );
  });

  it("validates new section query fields added in filter expansion", () => {
    // JW-id aliases and string-based filters
    expect(
      sectionsQuerySchema.safeParse({
        courseJwId: "101",
        semesterJwId: "202",
        teacherCode: "DEV-T-001",
        jwIds: "9902001,9902002",
      }).success,
    ).toBe(true);
    // teacherCode cannot be an empty string (min(1) after trim)
    expect(sectionsQuerySchema.safeParse({ teacherCode: "" }).success).toBe(
      false,
    );
    // jwIds is a plain string field — any non-empty string is accepted
    expect(sectionsQuerySchema.safeParse({ jwIds: "1" }).success).toBe(true);
  });

  it("validates new schedule query fields added in filter expansion", () => {
    expect(
      schedulesQuerySchema.safeParse({
        sectionJwId: "9902001",
        sectionCode: "DEV-CS201.01",
        teacherCode: "DEV-T-001",
        roomJwId: "9910031",
      }).success,
    ).toBe(true);
    // sectionCode cannot be an empty string
    expect(schedulesQuerySchema.safeParse({ sectionCode: "" }).success).toBe(
      false,
    );
    // numeric alias fields must parse as integers
    expect(schedulesQuerySchema.safeParse({ sectionJwId: "abc" }).success).toBe(
      false,
    );
  });

  it("validates shared response schemas", () => {
    expect(
      meResponseSchema.safeParse({
        id: "user_1",
        email: null,
        name: "User",
        image: null,
        username: "user",
        isAdmin: false,
      }).success,
    ).toBe(true);

    expect(openApiErrorSchema.safeParse({ error: "bad request" }).success).toBe(
      true,
    );
  });
});
