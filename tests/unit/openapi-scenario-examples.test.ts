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
  "options",
  "head",
] as const;

type GeneratedOperation = {
  description?: string;
  parameters?: Array<{
    name?: string;
    example?: unknown;
    schema?: GeneratedSchema;
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, GeneratedMediaType>;
  };
  responses?: Record<
    string,
    {
      content?: Record<string, GeneratedMediaType>;
    }
  >;
  security?: unknown[];
  summary?: string;
};

type GeneratedMediaType = {
  example?: unknown;
  schema?: GeneratedSchema;
};

type GeneratedSchema = {
  $ref?: string;
  format?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  type?: string;
};

type GeneratedOpenApiDocument = {
  components?: {
    schemas?: Record<string, GeneratedSchema>;
    securitySchemes?: Record<string, unknown>;
  };
  paths: Record<
    string,
    Partial<Record<(typeof OPENAPI_HTTP_METHODS)[number], GeneratedOperation>>
  >;
};

function resolveGeneratedSchema(
  spec: GeneratedOpenApiDocument,
  schema: GeneratedSchema | undefined,
) {
  const ref = schema?.$ref;
  if (!ref) return schema;
  const schemaName = ref.match(/^#\/components\/schemas\/(.+)$/)?.[1];
  return schemaName ? spec.components?.schemas?.[schemaName] : undefined;
}

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

    const courseListExample = paginatedCourseResponseSchema.parse(
      examples["GET /api/courses"]?.response,
    );
    const metadataExample = metadataResponseSchema.parse(
      examples["GET /api/metadata"]?.response,
    );
    expect(courseListExample.data[0]?.classifyId).toBeNull();
    expect(courseListExample.data[0]?.classify).toBeNull();
    expect(metadataExample.courseClassifies).toEqual([]);
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
    expect(spec.paths["/api/mcp"]?.get?.summary).toBe(
      "Open an MCP Streamable HTTP transport session",
    );
    expect(spec.paths["/api/mcp"]?.post?.summary).toBe(
      "Send an MCP Streamable HTTP JSON-RPC message",
    );
    expect(spec.paths["/api/mcp"]?.delete?.summary).toBe(
      "Close an MCP Streamable HTTP transport session",
    );
    expect(spec.paths["/api/mcp"]?.options?.summary).toBe(
      "Return MCP transport CORS preflight headers",
    );
  });

  it("documents request bodies and implemented preflight routes", () => {
    const spec = generatedOpenApiDocument as GeneratedOpenApiDocument;

    const todoCreateBody = spec.paths["/api/todos"]?.post?.requestBody;
    expect(todoCreateBody?.required).toBe(true);
    expect(todoCreateBody?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/todoCreateRequestSchema",
    );

    const uploadObjectBody =
      spec.paths["/api/uploads/object"]?.put?.requestBody;
    expect(uploadObjectBody?.required).toBe(true);
    expect(
      uploadObjectBody?.content?.["application/octet-stream"]?.schema,
    ).toEqual({
      type: "string",
      format: "binary",
    });

    const deviceAuthorizationPost =
      spec.paths["/api/auth/oauth2/device-authorization"]?.post;
    expect(deviceAuthorizationPost?.requestBody?.required).toBe(true);
    expect(
      deviceAuthorizationPost?.requestBody?.content?.[
        "application/x-www-form-urlencoded"
      ]?.schema?.$ref,
    ).toBe("#/components/schemas/oauthDeviceAuthorizationRequestSchema");

    const deviceAuthorizationOptions =
      spec.paths["/api/auth/oauth2/device-authorization"]?.options;
    expect(deviceAuthorizationOptions?.summary).toBe(
      "Return OAuth device authorization CORS preflight headers",
    );
    expect(deviceAuthorizationOptions?.responses?.["204"]).toBeTruthy();
  });

  it("documents auth security for protected REST and MCP operations", () => {
    const spec = generatedOpenApiDocument as GeneratedOpenApiDocument;

    expect(Object.keys(spec.components?.securitySchemes ?? {})).toEqual(
      expect.arrayContaining([
        "bearerAuth",
        "sessionCookie",
        "mcpBearerAuth",
        "internalBearerAuth",
        "calendarFeedToken",
      ]),
    );

    expect(spec.paths["/api/uploads"]?.get?.security).toEqual([
      { bearerAuth: [] },
      { sessionCookie: [] },
    ]);
    expect(spec.paths["/api/todos"]?.get?.security).toEqual([
      { bearerAuth: [] },
      { sessionCookie: [] },
    ]);
    expect(spec.paths["/api/admin/users"]?.get?.security).toEqual([
      { bearerAuth: [] },
      { sessionCookie: [] },
    ]);
    expect(spec.paths["/api/dashboard-links/pin"]?.post?.security).toEqual([
      { bearerAuth: [] },
      { sessionCookie: [] },
    ]);
    expect(
      spec.paths["/api/users/{userId}/calendar.ics"]?.get?.security,
    ).toEqual([
      { bearerAuth: [] },
      { sessionCookie: [] },
      { calendarFeedToken: [] },
    ]);
    expect(spec.paths["/api/mcp"]?.get?.security).toEqual([
      { mcpBearerAuth: [] },
    ]);
    expect(spec.paths["/api/readiness"]?.get?.security).toEqual([
      { internalBearerAuth: [] },
    ]);
    expect(spec.paths["/api/metrics"]?.get?.security).toEqual([
      { internalBearerAuth: [] },
    ]);
    expect(spec.paths["/api/health"]?.get?.security).toBeUndefined();
    expect(spec.paths["/api/mcp"]?.options?.security).toBeUndefined();
    expect(spec.paths["/api/users/profile"]?.get?.security).toBeUndefined();
    expect(
      spec.paths["/api/auth/oauth2/token"]?.post?.security,
    ).toBeUndefined();
    expect(
      spec.paths["/api/users/{userId}/calendar.ics"]?.get?.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: "query", name: "token" }),
      ]),
    );
  });

  it("documents operational endpoint response shapes", () => {
    const spec = generatedOpenApiDocument as GeneratedOpenApiDocument;

    expect(
      spec.paths["/api/health"]?.get?.responses?.["200"]?.content?.[
        "text/plain"
      ]?.schema,
    ).toEqual({ type: "string" });
    expect(
      spec.paths["/api/metrics"]?.get?.responses?.["200"]?.content?.[
        "text/plain"
      ]?.schema,
    ).toEqual({ type: "string" });
    expect(
      spec.paths["/api/readiness"]?.get?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema?.$ref,
    ).toBe("#/components/schemas/readinessResponseSchema");
  });

  it("documents OAuth success response bodies", () => {
    const spec = generatedOpenApiDocument as GeneratedOpenApiDocument;
    const deviceSchema = resolveGeneratedSchema(
      spec,
      spec.paths["/api/auth/oauth2/device-authorization"]?.post?.responses?.[
        "200"
      ]?.content?.["application/json"]?.schema,
    );
    const tokenSchema = resolveGeneratedSchema(
      spec,
      spec.paths["/api/auth/oauth2/token"]?.post?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema,
    );

    expect(deviceSchema?.required).toEqual(
      expect.arrayContaining([
        "device_code",
        "user_code",
        "verification_uri",
        "verification_uri_complete",
        "expires_in",
        "interval",
      ]),
    );
    expect(Object.keys(deviceSchema?.properties ?? {})).toEqual(
      expect.arrayContaining([
        "device_code",
        "user_code",
        "verification_uri",
        "verification_uri_complete",
        "expires_in",
        "interval",
      ]),
    );
    expect(tokenSchema?.required).toEqual(
      expect.arrayContaining(["access_token", "token_type", "expires_in"]),
    );
    expect(Object.keys(tokenSchema?.properties ?? {}).sort()).toEqual(
      [
        "access_token",
        "expires_in",
        "expires_at",
        "id_token",
        "refresh_token",
        "scope",
        "token_type",
      ].sort(),
    );
  });

  it("documents OAuth error response details", () => {
    const spec = generatedOpenApiDocument as GeneratedOpenApiDocument;
    const deviceErrorSchema = resolveGeneratedSchema(
      spec,
      spec.paths["/api/auth/oauth2/device-authorization"]?.post?.responses?.[
        "400"
      ]?.content?.["application/json"]?.schema,
    );
    const tokenGetErrorSchema = resolveGeneratedSchema(
      spec,
      spec.paths["/api/auth/oauth2/token"]?.get?.responses?.["405"]?.content?.[
        "application/json"
      ]?.schema,
    );
    const tokenPostErrorSchema = resolveGeneratedSchema(
      spec,
      spec.paths["/api/auth/oauth2/token"]?.post?.responses?.["400"]?.content?.[
        "application/json"
      ]?.schema,
    );

    for (const schema of [
      deviceErrorSchema,
      tokenGetErrorSchema,
      tokenPostErrorSchema,
    ]) {
      expect(schema?.required).toEqual(expect.arrayContaining(["error"]));
      expect(Object.keys(schema?.properties ?? {})).toEqual(
        expect.arrayContaining(["error", "error_description"]),
      );
    }
  });
});
