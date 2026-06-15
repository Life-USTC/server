import { describe, expect, it } from "vitest";
import { matchSectionCodesRequestSchema } from "@/lib/api/schemas/request-schemas";
import {
  courseDetailSchema,
  matchSectionCodesResponseSchema,
  metadataResponseSchema,
  paginatedCourseResponseSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterResponseSchema,
  paginatedTeacherResponseSchema,
  sectionDetailSchema,
  semesterSchema,
  teacherDetailSchema,
} from "@/lib/api/schemas/response-schemas";
import generatedOpenApiDocument from "../../public/openapi.generated.json";
import { buildScenarioOpenApiExamples } from "../../tools/build/openapi/scenario-examples";

const examples = buildScenarioOpenApiExamples();
const OPENAPI_HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
] as const;

type GeneratedOperation = {
  description?: string;
  summary?: string;
};

type GeneratedOpenApiDocument = {
  paths: Record<
    string,
    Partial<Record<(typeof OPENAPI_HTTP_METHODS)[number], GeneratedOperation>>
  >;
};

describe("buildScenarioOpenApiExamples", () => {
  it("uses scenario fixture values for catalog response examples", () => {
    expect(() =>
      paginatedSectionResponseSchema.parse(
        examples["GET /api/sections"]?.response,
      ),
    ).not.toThrow();
    expect(() =>
      sectionDetailSchema.parse(examples["GET /api/sections/{jwId}"]?.response),
    ).not.toThrow();
    expect(() =>
      paginatedCourseResponseSchema.parse(
        examples["GET /api/courses"]?.response,
      ),
    ).not.toThrow();
    expect(() =>
      courseDetailSchema.parse(examples["GET /api/courses/{jwId}"]?.response),
    ).not.toThrow();
    expect(() =>
      paginatedTeacherResponseSchema.parse(
        examples["GET /api/teachers"]?.response,
      ),
    ).not.toThrow();
    expect(() =>
      teacherDetailSchema.parse(examples["GET /api/teachers/{id}"]?.response),
    ).not.toThrow();
    expect(() =>
      paginatedSemesterResponseSchema.parse(
        examples["GET /api/semesters"]?.response,
      ),
    ).not.toThrow();
    expect(() =>
      semesterSchema.parse(examples["GET /api/semesters/current"]?.response),
    ).not.toThrow();
    expect(() =>
      metadataResponseSchema.parse(examples["GET /api/metadata"]?.response),
    ).not.toThrow();
  });

  it("uses scenario fixture values for section match request and response examples", () => {
    const example = examples["POST /api/sections/match-codes"];

    expect(() =>
      matchSectionCodesRequestSchema.parse(example?.requestBody),
    ).not.toThrow();
    expect(() =>
      matchSectionCodesResponseSchema.parse(example?.response),
    ).not.toThrow();
  });

  it("writes examples into the generated OpenAPI document", () => {
    const spec = generatedOpenApiDocument;

    expect(
      spec.paths["/api/sections"]?.get?.parameters?.some(
        (parameter) =>
          parameter.name === "semesterJwId" &&
          parameter.example ===
            examples["GET /api/sections"]?.parameters?.semesterJwId,
      ),
    ).toBe(true);
    expect(
      spec.paths["/api/sections"]?.get?.responses["200"]?.content?.[
        "application/json"
      ]?.example,
    ).toEqual(examples["GET /api/sections"]?.response);
    expect(
      spec.paths["/api/sections/match-codes"]?.post?.requestBody?.content?.[
        "application/json"
      ]?.example,
    ).toEqual(examples["POST /api/sections/match-codes"]?.requestBody);
  });

  it("keeps generated API operations discoverable", () => {
    const spec = generatedOpenApiDocument as GeneratedOpenApiDocument;
    const missingSummaries: string[] = [];
    const emptyDescriptions: string[] = [];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!path.startsWith("/api/")) continue;
      for (const method of OPENAPI_HTTP_METHODS) {
        const operation = pathItem[method];
        if (!operation) continue;

        const operationName = `${method.toUpperCase()} ${path}`;
        if (!operation.summary?.trim()) missingSummaries.push(operationName);
        if ("description" in operation && !operation.description?.trim()) {
          emptyDescriptions.push(operationName);
        }
      }
    }

    expect(missingSummaries).toEqual([]);
    expect(emptyDescriptions).toEqual([]);
    expect(spec.paths["/api/comments"]?.post?.summary).toBe(
      "Create one comment",
    );
    expect(spec.paths["/api/comments/{id}"]?.patch?.summary).toBe(
      "Update one comment",
    );
    expect(spec.paths["/api/auth/{auth}"]).toBeUndefined();
    expect(spec.paths["/api/mcp"]).toBeUndefined();
  });
});
