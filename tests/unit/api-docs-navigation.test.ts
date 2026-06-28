import { describe, expect, it } from "vitest";
import {
  getApiDocsSelection,
  type OpenApiDocument,
  slugifyDocsSegment,
} from "@/features/api-docs/lib/docs-navigation";
import generatedOpenApiDocument from "../../public/openapi.generated.json";

const document = generatedOpenApiDocument as OpenApiDocument;

describe("API 文档导航选择", () => {
  it("从生成的 OpenAPI 文档构建路由链接", () => {
    const selection = getApiDocsSelection(document, "/api/docs");
    const tag = selection.groups.flatMap((group) => group.tags)[0];
    const operation = tag?.operations[0];

    expect(tag?.href).toBe(
      `/api/docs/tag/${slugifyDocsSegment(tag?.name ?? "")}`,
    );
    expect(operation?.href).toMatch(/^\/api\/docs\/tag\/[^/]+\/[A-Z]+\//);
    expect(operation?.href).not.toContain("#");
  });

  it("使用紧凑的操作摘要作为侧边栏导航", () => {
    const selection = getApiDocsSelection(document, "/api/docs");
    const operations = selection.groups
      .flatMap((group) => group.tags)
      .flatMap((tag) => tag.operations);

    expect(
      operations.find((operation) => operation.path === "/api/sections"),
    ).toMatchObject({
      summary: "List sections",
    });
    expect(
      operations.find((operation) => operation.path === "/api/teachers"),
    ).toMatchObject({
      summary: "List teachers",
    });
    expect(
      operations.find((operation) => operation.path === "/api/semesters"),
    ).toMatchObject({
      summary: "List semesters",
    });
  });

  it("展示生成的 OPTIONS 操作", () => {
    const selection = getApiDocsSelection(document, "/api/docs");
    const operation = selection.groups
      .flatMap((group) => group.tags)
      .flatMap((tag) => tag.operations)
      .find(
        (candidate) =>
          candidate.method === "options" && candidate.path === "/api/mcp",
      );

    expect(operation).toBeDefined();

    const operationSelection = getApiDocsSelection(
      document,
      operation?.href ?? "",
    );
    expect(operationSelection.activeHref).toBe(operation?.href);
    expect(
      operationSelection.document.paths["/api/mcp"]?.options,
    ).toBeDefined();
  });

  it("tag 页面仅过滤到选中的 tag", () => {
    const rootSelection = getApiDocsSelection(document, "/api/docs");
    const tag = rootSelection.groups
      .flatMap((group) => group.tags)
      .find((candidate) => candidate.operations.length);

    if (!tag) throw new Error("Generated OpenAPI document has no operations");

    const selection = getApiDocsSelection(document, tag.href);
    const operations = Object.values(selection.document.paths).flatMap(
      (pathItem) =>
        Object.values(pathItem).filter(
          (value): value is { tags?: string[] } =>
            value !== null && typeof value === "object" && "tags" in value,
        ),
    );

    expect(Object.keys(selection.document.paths).length).toBeGreaterThan(0);
    expect(
      operations.every((operation) => operation.tags?.includes(tag.name)),
    ).toBe(true);
  });

  it("operation 页面仅过滤到选中的 operation", () => {
    const rootSelection = getApiDocsSelection(document, "/api/docs");
    const operation = rootSelection.groups
      .flatMap((group) => group.tags)
      .flatMap((tag) => tag.operations)[0];

    if (!operation) {
      throw new Error("Generated OpenAPI document has no operations");
    }

    const selection = getApiDocsSelection(document, operation.href);
    const pathItem = selection.document.paths[operation.path];
    const extraEntries = Object.keys(pathItem ?? {}).filter(
      (key) => key !== operation.method && key !== "parameters",
    );

    expect(selection.activeHref).toBe(operation.href);
    expect(Object.keys(selection.document.paths)).toEqual([operation.path]);
    expect(pathItem?.[operation.method]).toBeDefined();
    expect(extraEntries).toEqual([]);
  });
});
