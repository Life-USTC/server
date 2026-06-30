import { describe, expect, it } from "vitest";
import {
  commentMcpTargetMutationInputSchema,
  commentMcpTargetReadInputSchema,
} from "@/features/comments/lib/comment-target-input-schemas";
import { HOMEWORK_DESCRIPTION_MAX_LENGTH } from "@/features/homeworks/lib/homework-limits";
import { TODO_CONTENT_MAX_LENGTH } from "@/features/todos/lib/todo-limits";
import {
  busNextDeparturesQuerySchema,
  calendarSubscriptionAppendRequestSchema,
  calendarSubscriptionBatchRequestSchema,
  calendarSubscriptionCreateRequestSchema,
  calendarSubscriptionQueryRequestSchema,
  commentCreateRequestSchema,
  commentReactionRequestSchema,
  commentsQuerySchema,
  commentUpdateRequestSchema,
  coursesQuerySchema,
  descriptionUpsertRequestSchema,
  homeworkCompletionBatchRequestSchema,
  homeworkCreateRequestSchema,
  localeUpdateRequestSchema,
  matchSectionCodesRequestSchema,
  schedulesQuerySchema,
  sectionsQuerySchema,
  semestersQuerySchema,
  subscribedSchedulesQuerySchema,
  teachersQuerySchema,
  todoCompletionBatchRequestSchema,
  todoCreateRequestSchema,
  todosQuerySchema,
  uploadCompleteRequestSchema,
  uploadCreateRequestSchema,
  uploadRenameRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import {
  meResponseSchema,
  oauthErrorResponseSchema,
  openApiErrorSchema,
} from "@/lib/api/schemas/response-schemas";
import generatedOpenApiDocument from "../../public/openapi.generated.json";

const openApiSchemas = (
  generatedOpenApiDocument as {
    components?: { schemas?: Record<string, Record<string, unknown>> };
  }
).components?.schemas;

function openApiSchema(name: string) {
  const schema = openApiSchemas?.[name];
  if (!schema) {
    throw new Error(`OpenAPI schema ${name} not found`);
  }
  return schema;
}

describe("matchSectionCodesRequestSchema", () => {
  it("接受有效 payload", () => {
    const result = matchSectionCodesRequestSchema.safeParse({
      codes: ["COMP101.01", "MATH204.02"],
      semesterId: "12",
    });

    expect(result.success).toBe(true);
  });

  it("拒绝空 code 和无效 code 格式", () => {
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
  it("接受有效 payload", () => {
    const result = homeworkCreateRequestSchema.safeParse({
      sectionId: "12",
      title: "  作业 1  ",
      description: "desc",
      isMajor: true,
    });
    expect(result.success).toBe(true);
  });

  it("接受可空 description，与 MCP 创建工具一致", () => {
    const result = homeworkCreateRequestSchema.safeParse({
      sectionJwId: "12345",
      title: "作业 1",
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it("拒绝缺失 title", () => {
    const result = homeworkCreateRequestSchema.safeParse({
      sectionId: 3,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("在去除 homework description 首尾空白后校验长度", () => {
    const description = "x".repeat(HOMEWORK_DESCRIPTION_MAX_LENGTH);
    const result = homeworkCreateRequestSchema.safeParse({
      sectionId: "12",
      title: "作业 1",
      description: ` ${description} `,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe(description);
    }
  });
});

describe("todoCreateRequestSchema", () => {
  it("在去除 todo content 首尾空白后校验长度", () => {
    const content = "x".repeat(TODO_CONTENT_MAX_LENGTH);
    const result = todoCreateRequestSchema.safeParse({
      title: "Read Chapter 1",
      content: ` ${content} `,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe(content);
    }
  });
});

describe("homeworkCompletionBatchRequestSchema", () => {
  it("接受完成状态更新", () => {
    const result = homeworkCompletionBatchRequestSchema.safeParse({
      items: [
        { homeworkId: "homework-1", completed: true },
        { homeworkId: "homework-2", completed: false },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("拒绝空 item 列表和空 homework ID", () => {
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

describe("todoCompletionBatchRequestSchema", () => {
  it("接受有效批量完成状态更新", () => {
    const result = todoCompletionBatchRequestSchema.safeParse({
      items: [
        { todoId: "todo-1", completed: true },
        { todoId: "todo-2", completed: false },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("拒绝空 item 列表和空 todo ID", () => {
    expect(
      todoCompletionBatchRequestSchema.safeParse({ items: [] }).success,
    ).toBe(false);
    expect(
      todoCompletionBatchRequestSchema.safeParse({
        items: [{ todoId: "", completed: true }],
      }).success,
    ).toBe(false);
  });

  it("拒绝超过最大批量大小", () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      todoId: `todo-${i}`,
      completed: true,
    }));
    expect(todoCompletionBatchRequestSchema.safeParse({ items }).success).toBe(
      false,
    );
  });
});

describe("descriptionUpsertRequestSchema", () => {
  it("接受 homework 字符串 targetId", () => {
    const result = descriptionUpsertRequestSchema.safeParse({
      targetType: "homework",
      targetId: "hw_123",
      content: "text",
    });
    expect(result.success).toBe(true);
  });

  it("拒绝带有无效 id 的数字目标", () => {
    const result = descriptionUpsertRequestSchema.safeParse({
      targetType: "section",
      targetId: "abc",
      content: "text",
    });
    expect(result.success).toBe(false);
  });

  it("在 OpenAPI 中记录必填的目标引用可选方案", () => {
    const schema = openApiSchema("descriptionUpsertRequestSchema");
    expect(schema.required).toEqual(
      expect.arrayContaining(["targetType", "content"]),
    );
    expect(schema.anyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ required: ["targetId"] }),
        expect.objectContaining({ required: ["sectionJwId"] }),
        expect.objectContaining({ required: ["courseJwId"] }),
        expect.objectContaining({ required: ["teacherId"] }),
        expect.objectContaining({ required: ["homeworkId"] }),
      ]),
    );
  });
});

describe("其他请求 schema", () => {
  it("校验 upload 创建 payload", () => {
    const valid = uploadCreateRequestSchema.safeParse({
      filename: "a.txt",
      size: "123",
    });
    expect(valid.success).toBe(true);
  });

  it("拒绝包含控制字符的 upload 文件名", () => {
    expect(
      uploadCreateRequestSchema.safeParse({
        filename: "a\nb.txt",
        size: "123",
      }).success,
    ).toBe(false);
    expect(
      uploadCompleteRequestSchema.safeParse({
        key: "uploads/user-1/a.txt",
        filename: "a\rb.txt",
      }).success,
    ).toBe(false);
    expect(
      uploadRenameRequestSchema.safeParse({
        filename: "a\u0000b.txt",
      }).success,
    ).toBe(false);
  });

  it("校验评论列表公开目标标识符", () => {
    expect(
      commentsQuerySchema.safeParse({
        targetType: "section",
        sectionJwId: "9902001",
      }).success,
    ).toBe(true);
    expect(
      commentsQuerySchema.safeParse({
        targetType: "course",
        courseJwId: "9901001",
      }).success,
    ).toBe(true);
    expect(
      commentsQuerySchema.safeParse({
        targetType: "section-teacher",
        sectionTeacherId: "123",
      }).success,
    ).toBe(true);
    expect(
      commentsQuerySchema.safeParse({
        targetType: "section",
        sectionJwId: "abc",
      }).success,
    ).toBe(false);
  });

  it("校验评论创建公开目标标识符", () => {
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "section",
        sectionJwId: "9902001",
        body: "hello",
      }).success,
    ).toBe(true);
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "course",
        courseJwId: "9901001",
        body: "hello",
      }).success,
    ).toBe(true);
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "homework",
        homeworkId: "homework-1",
        body: "hello",
      }).success,
    ).toBe(true);
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "section-teacher",
        sectionTeacherId: "123",
        body: "hello",
      }).success,
    ).toBe(true);
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "section",
        targetId: "123",
        sectionJwId: "abc",
        body: "hello",
      }).success,
    ).toBe(false);
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "course",
        targetId: "123",
        courseJwId: "0",
        body: "hello",
      }).success,
    ).toBe(false);
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "section-teacher",
        targetId: "123",
        sectionTeacherId: "",
        body: "hello",
      }).success,
    ).toBe(false);
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "section-teacher",
        targetId: "123",
        sectionTeacherId: 0,
        body: "hello",
      }).success,
    ).toBe(false);
  });

  it("拒绝不支持的匿名评论可见性", () => {
    expect(
      commentCreateRequestSchema.safeParse({
        targetType: "section",
        sectionJwId: "9902001",
        body: "hello",
        visibility: "anonymous",
      }).success,
    ).toBe(false);
    expect(
      commentUpdateRequestSchema.safeParse({
        body: "hello",
        visibility: "anonymous",
      }).success,
    ).toBe(false);
  });

  it("校验集中式 MCP 评论目标标识符", () => {
    expect(
      commentMcpTargetReadInputSchema.safeParse({
        targetType: "section",
        sectionJwId: 9902001,
      }).success,
    ).toBe(true);
    expect(
      commentMcpTargetReadInputSchema.safeParse({
        targetType: "course",
        courseJwId: 9901001,
      }).success,
    ).toBe(true);
    expect(
      commentMcpTargetReadInputSchema.safeParse({
        targetType: "homework",
        homeworkId: "homework-1",
      }).success,
    ).toBe(true);
    expect(
      commentMcpTargetReadInputSchema.safeParse({
        targetType: "section-teacher",
        sectionTeacherId: 123,
      }).success,
    ).toBe(true);
    expect(
      commentMcpTargetMutationInputSchema.safeParse({
        targetType: "section-teacher",
        sectionId: "123",
        teacherId: "456",
      }).success,
    ).toBe(true);
    expect(
      commentMcpTargetReadInputSchema.safeParse({
        targetType: "section",
        sectionJwId: "9902001",
      }).success,
    ).toBe(false);
  });

  it("校验日历订阅 payload", () => {
    const valid = calendarSubscriptionCreateRequestSchema.safeParse({
      sectionIds: [1, 2, 3],
    });
    expect(valid.success).toBe(true);
  });

  it("校验日历订阅追加 payload", () => {
    const valid = calendarSubscriptionAppendRequestSchema.safeParse({
      sectionIds: [1, 2, 3],
    });
    const missingIds = calendarSubscriptionAppendRequestSchema.safeParse({});

    expect(valid.success).toBe(true);
    expect(missingIds.success).toBe(false);
  });

  it("校验日历订阅查询 payload", () => {
    expect(
      calendarSubscriptionQueryRequestSchema.safeParse({
        codes: ["COMP3001", "COMP3001.01"],
        sectionIds: [1],
        semesterId: "12",
      }).success,
    ).toBe(true);
    expect(calendarSubscriptionQueryRequestSchema.safeParse({}).success).toBe(
      false,
    );
  });

  it("校验日历订阅批量变更 payload", () => {
    expect(
      calendarSubscriptionBatchRequestSchema.safeParse({
        action: "add",
        codes: ["COMP3001"],
      }).success,
    ).toBe(true);
    expect(
      calendarSubscriptionBatchRequestSchema.safeParse({ action: "set" })
        .success,
    ).toBe(true);
    expect(
      calendarSubscriptionBatchRequestSchema.safeParse({ action: "remove" })
        .success,
    ).toBe(false);
  });

  it("在 OpenAPI 中记录正数日历订阅 section ID", () => {
    for (const name of [
      "calendarSubscriptionAppendRequestSchema",
      "calendarSubscriptionBatchRequestSchema",
      "calendarSubscriptionRemoveRequestSchema",
    ]) {
      const schema = openApiSchema(name);
      const properties = schema.properties as
        | Record<string, { items?: Record<string, unknown> }>
        | undefined;
      const items = properties?.sectionIds?.items;

      expect(items).toMatchObject({ minimum: 1, type: "integer" });
      expect(items).not.toHaveProperty("exclusiveMinimum");
    }
  });

  it("拒绝无效 reaction 类型", () => {
    const invalid = commentReactionRequestSchema.safeParse({
      type: "boom",
    });
    expect(invalid.success).toBe(false);
  });

  it("拒绝不支持的 locale", () => {
    const invalid = localeUpdateRequestSchema.safeParse({
      locale: "fr-fr",
    });
    expect(invalid.success).toBe(false);
  });

  it("校验查询 schema", () => {
    expect(
      sectionsQuerySchema.safeParse({ courseId: "1", ids: "1,2" }).success,
    ).toBe(true);
    expect(
      schedulesQuerySchema.safeParse({ weekday: "2", page: "1" }).success,
    ).toBe(true);
    expect(
      schedulesQuerySchema.safeParse({ dateFrom: "2026-03-01" }).success,
    ).toBe(true);
    expect(
      todosQuerySchema.safeParse({ dueBefore: "2026-03-01" }).success,
    ).toBe(true);
    expect(coursesQuerySchema.safeParse({ search: "math" }).success).toBe(true);

    expect(sectionsQuerySchema.safeParse({ courseId: "abc" }).success).toBe(
      false,
    );
    expect(schedulesQuerySchema.safeParse({ weekday: "x" }).success).toBe(
      false,
    );
    expect(schedulesQuerySchema.safeParse({ weekday: "0" }).success).toBe(
      false,
    );
    expect(schedulesQuerySchema.safeParse({ weekday: "8" }).success).toBe(
      false,
    );
    expect(schedulesQuerySchema.safeParse({ dateFrom: "" }).success).toBe(
      false,
    );
    expect(
      schedulesQuerySchema.safeParse({ dateFrom: "not-a-date" }).success,
    ).toBe(false);
    expect(todosQuerySchema.safeParse({ dueBefore: "" }).success).toBe(false);
    expect(
      todosQuerySchema.safeParse({ dueBefore: "not-a-date" }).success,
    ).toBe(false);
  });

  it("校验文档中记录的查询 limit 边界", () => {
    for (const schema of [
      coursesQuerySchema,
      sectionsQuerySchema,
      schedulesQuerySchema,
      teachersQuerySchema,
      semestersQuerySchema,
    ]) {
      expect(schema.safeParse({ limit: "100" }).success).toBe(true);
      expect(schema.safeParse({ limit: "101" }).success).toBe(false);
      expect(schema.safeParse({ limit: "0" }).success).toBe(false);
    }

    const validBusNextQuery = {
      destinationCampusId: "2",
      limit: "50",
      originCampusId: "1",
    };
    expect(
      busNextDeparturesQuerySchema.safeParse(validBusNextQuery).success,
    ).toBe(true);
    expect(
      busNextDeparturesQuerySchema.safeParse({
        ...validBusNextQuery,
        limit: "51",
      }).success,
    ).toBe(false);
    expect(todosQuerySchema.safeParse({ limit: "200" }).success).toBe(true);
    expect(todosQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
    expect(
      subscribedSchedulesQuerySchema.safeParse({ weekday: "7", limit: "300" })
        .success,
    ).toBe(true);
    expect(
      subscribedSchedulesQuerySchema.safeParse({ weekday: "8" }).success,
    ).toBe(false);
    expect(
      subscribedSchedulesQuerySchema.safeParse({ limit: "301" }).success,
    ).toBe(false);
  });

  it("校验筛选扩展中新增的 section 查询字段", () => {
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

  it("校验筛选扩展中新增的 schedule 查询字段", () => {
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

  it("校验共享响应 schema", () => {
    expect(
      meResponseSchema.safeParse({
        id: "user_1",
        email: null,
        name: "User",
        image: null,
        username: "user",
        isAdmin: false,
        createdAt: "2026-01-01T00:00:00+08:00",
        updatedAt: "2026-01-01T00:00:00+08:00",
      }).success,
    ).toBe(true);

    expect(openApiErrorSchema.safeParse({ error: "bad request" }).success).toBe(
      true,
    );
    expect(
      oauthErrorResponseSchema.safeParse({
        error: "invalid_request",
        error_description: "Use POST",
      }).success,
    ).toBe(true);
  });
});
