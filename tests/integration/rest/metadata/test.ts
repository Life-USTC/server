/**
 * E2E tests for GET /api/catalog/metadata
 *
 * ## Endpoints
 * - `GET /api/catalog/metadata` — Get metadata dictionaries for UI filters.
 *
 * ## Request
 * - No query params
 *
 * ## Response
 * - 200: `{ educationLevels, courseCategories, courseClassifies, classTypes,
 *           courseTypes, courseGradations, examModes, teachLanguages, campuses }`
 *   All values are arrays. `campuses` includes nested `buildings`.
 *
 * ## Auth Requirements
 * - Public (no authentication required)
 *
 * ## Edge Cases
 * - All 9 dictionary keys must be present and be arrays
 * - campuses includes buildings relation
 */
import { expect, test } from "@playwright/test";
import { metadataResponseSchema } from "@/lib/api/schemas/academic-metadata-response-schemas";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import { assertApiContract } from "../_shared/api-contract";

const EXPECTED_KEYS = [
  "educationLevels",
  "courseCategories",
  "courseClassifies",
  "classTypes",
  "courseTypes",
  "courseGradations",
  "examModes",
  "teachLanguages",
  "campuses",
] as const;

test.describe("GET /api/catalog/metadata - 元数据字典", () => {
  test("契约", async ({ request }) => {
    await assertApiContract(request, { routePath: "/api/catalog/metadata" });
  });

  test("所有字典键存在且为数组", async ({ request }) => {
    const response = await request.get("/api/catalog/metadata");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    for (const key of EXPECTED_KEYS) {
      expect(Array.isArray(body[key]), `${key} should be an array`).toBe(true);
    }
  });

  test("seed 数据严格匹配 schema 并按 locale 推导名称", async ({ request }) => {
    const response = await request.get("/api/catalog/metadata?locale=en-us");
    expect(response.status()).toBe(200);
    const body = metadataResponseSchema.parse(await response.json());

    const campus = body.campuses.find(
      (item) => item.nameCn === DEV_SEED.campus.nameCn,
    );
    expect(campus?.namePrimary).toBe(DEV_SEED.campus.nameEn);
    expect(campus?.nameSecondary).toBe(DEV_SEED.campus.nameCn);

    const building = campus?.buildings.find(
      (item) => item.nameCn === DEV_SEED.building.nameCn,
    );
    expect(building?.namePrimary).toBe(DEV_SEED.building.nameEn);
    expect(building?.nameSecondary).toBe(DEV_SEED.building.nameCn);
  });

  test("seed 授课语言存在", async ({ request }) => {
    const response = await request.get("/api/catalog/metadata");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      teachLanguages?: Array<{ nameCn?: string }>;
    };
    expect(
      body.teachLanguages?.some(
        (item) => item.nameCn === DEV_SEED.metadata.teachLanguageNameCn,
      ),
    ).toBe(true);
  });

  test("seed 课程分类存在", async ({ request }) => {
    const response = await request.get("/api/catalog/metadata");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      courseClassifies?: Array<{ nameCn?: string }>;
    };
    expect(
      body.courseClassifies?.some(
        (item) => item.nameCn === DEV_SEED.metadata.courseClassifyNameCn,
      ),
    ).toBe(true);
  });

  test("seed 校区及楼栋存在", async ({ request }) => {
    const response = await request.get("/api/catalog/metadata");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      campuses?: Array<{
        nameCn?: string;
        buildings?: Array<{ nameCn?: string }>;
      }>;
    };
    const campus = body.campuses?.find(
      (item) => item.nameCn === DEV_SEED.metadata.campusNameCn,
    );
    expect(campus).toBeDefined();
    expect(
      campus?.buildings?.some(
        (building) => building.nameCn === DEV_SEED.metadata.buildingNameCn,
      ),
    ).toBe(true);
  });
});
