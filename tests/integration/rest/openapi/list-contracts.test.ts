import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import { signInAsDevAdminApi } from "../_harness/auth";

type Schema = { $ref?: string; properties?: Record<string, Schema> };

test("openapi.paginated-list-envelope", async ({ request }) => {
  await signInAsDevAdminApi(request);
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
  const paths = Object.entries(spec.paths).filter(([, { get }]) => {
    const schema =
      get?.responses?.["200"]?.content?.["application/json"]?.schema;
    return schema && resolve(schema).properties?.pagination;
  });
  expect(paths.map(([path]) => path)).toEqual(
    expect.arrayContaining([
      "/api/catalog/courses",
      "/api/catalog/sections",
      "/api/community/comments",
      "/api/workspace/exams",
      "/api/admin/users",
    ]),
  );
  let nonempty = 0;
  for (const [path, { get }] of paths) {
    const query = new URLSearchParams({ page: "1", pageSize: "1" });
    if (path === "/api/community/comments") {
      query.set("targetType", "section");
      query.set("sectionJwId", String(DEV_SEED.section.jwId));
    }
    if (path === "/api/community/section-homeworks")
      query.set("sectionJwId", String(DEV_SEED.section.jwId));
    for (const parameter of get?.parameters ?? [])
      if (parameter.required)
        expect(
          query.has(parameter.name),
          `${path} requires a fixture for ${parameter.name}`,
        ).toBe(true);
    let total: number | undefined;
    for (const page of [1, 2]) {
      query.set("page", String(page));
      const response = await request.get(`${path}?${query}`);
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
      expect(body.pagination.totalPages, path).toBe(
        Math.max(1, Math.ceil(body.pagination.total)),
      );
      expect(body.data.length, path).toBe(
        Math.min(1, Math.max(0, body.pagination.total - page + 1)),
      );
      if (total !== undefined) expect(body.pagination.total, path).toBe(total);
      total = body.pagination.total;
      if (body.data.length) nonempty++;
    }
  }
  expect(nonempty).toBeGreaterThan(0);
});
