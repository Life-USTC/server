/**
 * E2E tests for PUT /api/homeworks/[id]/completion.
 *
 * ## PUT /api/homeworks/[id]/completion
 * - Body: { completed: boolean }
 * - Response: { completed: boolean, completedAt: string | null }
 * - Auth required (401 if unauthenticated)
 * - Toggles the homework completion status for the current user
 * - Returns 404 for non-existent homework
 *
 * ## Edge cases
 * - Unauthenticated PUT → 401
 * - Toggle off then on (seed homework is pre-completed), verifying completedAt changes
 * - Restores original completion state in finally block
 *
 * ## Test isolation note
 * The toggle test uses DEV_SEED.homeworks.completedTitle ("迭代一需求拆解"), which is
 * pre-seeded as completed.  This avoids a parallelism race with the MCP and
 * calendar.ics tests, which both check that DEV_SEED.homeworks.title
 * ("迭代二系统设计评审") appears in the incomplete-homework list.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../../utils/auth";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import { assertApiContract } from "../../../../_shared/api-contract";

/** Resolve the seed section's internal DB id via match-codes. */
async function resolveSeedSectionId(
  request: import("@playwright/test").APIRequestContext,
) {
  const response = await request.post("/api/sections/match-codes", {
    data: { codes: [DEV_SEED.section.code] },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    sections?: Array<{ id?: number; code?: string | null }>;
  };
  const section = body.sections?.find((s) => s.code === DEV_SEED.section.code);
  expect(section?.id).toBeDefined();
  // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
  return section!.id!;
}

/** Find the seed homework's id by matching on known title. */
async function findSeedHomeworkId(
  request: import("@playwright/test").APIRequestContext,
  sectionId: number,
) {
  const listResponse = await request.get(
    `/api/homeworks?sectionId=${sectionId}`,
  );
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    homeworks?: Array<{ id?: string; title?: string }>;
  };
  // Use the pre-seeded completed homework to avoid racing with tests that
  // check for the main seed homework ("迭代二系统设计评审") in the incomplete list.
  const hw = listBody.homeworks?.find(
    (h) => h.title === DEV_SEED.homeworks.completedTitle,
  );
  expect(hw?.id).toBeTruthy();
  // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
  return hw!.id!;
}

test("/api/homeworks/[id]/completion 接口契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/homeworks/[id]/completion",
  });
});

test("/api/homeworks/[id]/completion PUT 未登录返回 401", async ({
  request,
}) => {
  const response = await request.put("/api/homeworks/invalid-e2e/completion", {
    data: { completed: true },
  });
  expect(response.status()).toBe(401);
});

test("/api/homeworks/[id]/completion PUT 可切换完成状态并还原", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const homeworkId = await findSeedHomeworkId(page.request, sectionId);

  try {
    // Undo completion (seed homework starts as completed)
    await expect(async () => {
      const undoResponse = await page.request.put(
        `/api/homeworks/${homeworkId}/completion`,
        { data: { completed: false } },
      );
      expect(undoResponse.status()).toBe(200);
      expect(
        (await undoResponse.json()) as {
          completed?: boolean;
          completedAt?: string | null;
        },
      ).toMatchObject({ completed: false, completedAt: null });
    }).toPass({ timeout: 10_000 });

    // Re-mark as completed
    await expect(async () => {
      const completeResponse = await page.request.put(
        `/api/homeworks/${homeworkId}/completion`,
        { data: { completed: true } },
      );
      expect(completeResponse.status()).toBe(200);
      expect(
        (await completeResponse.json()) as {
          completed?: boolean;
          completedAt?: string | null;
        },
      ).toMatchObject({ completed: true });
    }).toPass({ timeout: 10_000 });
  } finally {
    // Restore to completed state (matches seed)
    await page.request.put(`/api/homeworks/${homeworkId}/completion`, {
      data: { completed: true },
    });
  }
});
