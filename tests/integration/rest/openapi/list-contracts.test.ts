import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";

type Schema = {
  $ref?: string;
  properties?: Record<string, Schema>;
  anyOf?: Schema[];
  oneOf?: Schema[];
};

test("openapi.paginated-list-envelope", { tag: "@OpenAPI/REST" }, async ({
  run,
  isolatedWorker,
}) => {
  await run(async () => {
    // Comparing totals across pages requires an unchanged dataset, including
    // global admin lists. Other tests must not insert rows into this Worker.
    const { request, id } = await isolatedWorker.createActor({ isAdmin: true });
    const db = isolatedWorker.database.owner;
    const catalog = await createCatalogContractFixture(db);
    const section = catalog.sections[0];
    await db.$transaction([
      db.comment.createMany({
        data: ["First comment", "Second comment"].map((body) => ({
          userId: id,
          sectionId: section.id,
          body,
        })),
      }),
      db.todo.createMany({
        data: ["First task", "Second task"].map((title) => ({
          userId: id,
          title,
        })),
      }),
    ]);
    const specResponse = await request.get("/api/openapi");
    expect(specResponse.status()).toBe(200);
    const spec = (await specResponse.json()) as {
      components: { schemas: Record<string, Schema> };
      paths: Record<
        string,
        {
          get?: {
            parameters?: { name: string; required?: boolean }[];
            responses?: Record<
              string,
              { content?: { "application/json"?: { schema?: Schema } } }
            >;
          };
        }
      >;
    };
    const resolve = (schema: Schema): Schema =>
      schema.$ref
        ? resolve(spec.components.schemas[schema.$ref.split("/").at(-1) ?? ""])
        : schema;
    const isPaginated = (schema: Schema): boolean => {
      const resolved = resolve(schema);
      return (
        Boolean(resolved.properties?.pagination) ||
        [...(resolved.anyOf ?? []), ...(resolved.oneOf ?? [])].some(isPaginated)
      );
    };
    const paths = Object.entries(spec.paths).filter(([, { get }]) => {
      const schema =
        get?.responses?.["200"]?.content?.["application/json"]?.schema;
      return schema && isPaginated(schema);
    });
    expect(paths.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/api/catalog/courses",
        "/api/catalog/courses/{jwId}/sections",
        "/api/catalog/sections",
        "/api/catalog/teachers/{id}/sections",
        "/api/community/comments",
        "/api/workspace/exams",
        "/api/workspace/todos",
        "/api/catalog/sections/{jwId}/schedules",
        "/api/admin/users",
      ]),
    );
    let nonempty = 0;
    const preparedTotals: Record<string, number> = {
      "/api/catalog/courses": 2,
      "/api/catalog/courses/{jwId}/sections": 1,
      "/api/catalog/sections": 2,
      "/api/catalog/teachers/{id}/sections": 1,
      "/api/community/comments": 2,
      "/api/workspace/todos": 2,
      "/api/admin/users": 1,
    };
    const preparedPaths: Record<string, string> = {
      "/api/catalog/courses/{jwId}/sections": `/api/catalog/courses/${catalog.courses[0].jwId}/sections`,
      "/api/catalog/sections/{jwId}/schedules": `/api/catalog/sections/${section.jwId}/schedules`,
      "/api/catalog/teachers/{id}/sections": `/api/catalog/teachers/${catalog.teachers[0].id}/sections`,
    };
    for (const [path, { get }] of paths) {
      const query = new URLSearchParams({ page: "1", pageSize: "1" });
      const requestPath = preparedPaths[path] ?? path;
      if (path === "/api/community/comments") {
        query.set("targetType", "section");
        query.set("sectionJwId", String(section.jwId));
      }
      if (path === "/api/community/section-homeworks")
        query.set("sectionJwId", String(section.jwId));
      for (const parameter of get?.parameters ?? [])
        if (parameter.required)
          expect(
            query.has(parameter.name) ||
              (path.includes(`{${parameter.name}}`) &&
                !requestPath.includes(`{${parameter.name}}`)),
            `${path} requires a fixture for ${parameter.name}`,
          ).toBe(true);
      let total: number | undefined;
      for (const page of [1, 2]) {
        query.set("page", String(page));
        const response = await request.get(`${requestPath}?${query}`);
        expect(response.status(), path).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body.data), path).toBe(true);
        expect(
          Object.keys(body).filter(
            (key) => !["data", "pagination", "meta"].includes(key),
          ),
          path,
        ).toEqual([]);
        expect(Object.keys(body.pagination).sort(), path).toEqual([
          "page",
          "pageSize",
          "total",
          "totalPages",
        ]);
        expect(body.pagination.page, path).toBe(page);
        expect(body.pagination.pageSize, path).toBe(1);
        expect(Number.isInteger(body.pagination.total), path).toBe(true);
        expect(body.pagination.total, path).toBeGreaterThanOrEqual(0);
        if (path in preparedTotals)
          expect(body.pagination.total, path).toBe(preparedTotals[path]);
        expect(body.pagination.totalPages, path).toBe(
          Math.max(1, Math.ceil(body.pagination.total)),
        );
        expect(body.data.length, path).toBe(
          Math.min(1, Math.max(0, body.pagination.total - page + 1)),
        );
        if (total !== undefined)
          expect(body.pagination.total, path).toBe(total);
        total = body.pagination.total;
        if (body.data.length) nonempty++;
      }
    }
    expect(nonempty).toBeGreaterThan(0);
  });
});
