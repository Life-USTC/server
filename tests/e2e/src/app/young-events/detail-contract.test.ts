import { expect, type Page, test } from "@playwright/test";
import type { Prisma } from "../../../../../src/generated/prisma-node/client";
import {
  createFixturePrisma,
  disconnectTestPrisma,
} from "../../../../shared/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

async function withEvent(
  page: Page,
  data: Partial<Prisma.YoungEventCreateInput>,
  run: (youngId: string) => Promise<void>,
) {
  const db = createFixturePrisma();
  const youngId = `detail-contract-${crypto.randomUUID()}`;
  await db.youngEvent.create({
    data: { youngId, name: youngId, isActive: true, rawJson: {}, ...data },
  });
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, `/catalog/young-events/${youngId}`);
      await run(youngId);
    }
  } finally {
    await db.youngEvent.delete({ where: { youngId } });
    await disconnectTestPrisma(db);
  }
}

test("young-event.display-known-values", async ({ page }) => {
  await withEvent(
    page,
    {
      requiresSignupInfo: true,
      allowedAttachmentTypes: ["pdf", "docx"],
      isOnline: true,
      onlineMeetingInfo: "800-414-186",
      externalSponsor: "External sponsor fixture",
    },
    async () => {
      await expect(
        page.getByText("800-414-186", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("PDF, DOCX", { exact: true })).toBeVisible();
      await expect(
        page.getByText("External sponsor fixture", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          /报名时需填写补充信息|Additional information required at registration/,
        ),
      ).toBeVisible();
    },
  );
});

test("young-event.online-option-uncertainty", async ({ page }) => {
  for (const isOnline of [true, false, null]) {
    await withEvent(page, { isOnline }, async () => {
      const online = page.getByText(
        /^(提供线上会议|Online meeting available)$/,
      );
      if (isOnline === true) await expect(online).toBeVisible();
      else await expect(online).toHaveCount(0);
      await expect(page.getByText(/^(线下活动|In-person event)$/)).toHaveCount(
        0,
      );
    });
  }
});

test("young-event.scope-uncertainty", async ({ page }) => {
  await withEvent(
    page,
    {
      signupScopeCode: "unrecognized-scope-99",
      signupDepartmentIds: ["opaque-department"],
    },
    async () => {
      await expect(
        page.getByText(
          /报名资格与面向范围请以第二课堂平台为准|Check the Second Classroom platform for eligibility/,
        ),
      ).toBeVisible();
      await expect(
        page.getByText("unrecognized-scope-99", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("opaque-department", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText(
          /^(所有学生均可报名|All students are eligible|仅本院学生|Department members only)$/,
        ),
      ).toHaveCount(0);
    },
  );
});

test("young-event.partial-time-uncertainty", async ({ page }) => {
  for (const endpoint of ["startAt", "endAt"] as const) {
    await withEvent(
      page,
      { [endpoint]: new Date("2035-09-24T00:30:00Z") },
      async () => {
        const overview = page.getByTestId("young-event-overview");
        await expect(overview).toContainText(
          endpoint === "startAt"
            ? /开始：2035-09-24 08:30|Starts: 2035-09-24 08:30/
            : /截止：2035-09-24 08:30|Ends: 2035-09-24 08:30/,
        );
        await expect(overview).not.toContainText("Invalid Date");
      },
    );
  }
});

test("young-event.occupancy-uncertainty", async ({ page }) => {
  for (const appliedCount of [null, 0]) {
    await withEvent(page, { appliedCount, capacity: 20 }, async (youngId) => {
      const registered = page
        .locator("dt")
        .filter({ hasText: /^(已报名|Applied)$/ });
      if (appliedCount === null) await expect(registered).toHaveCount(0);
      else await expect(registered).toBeVisible();
      await gotoAndWaitForReady(
        page,
        `/catalog/young-events?search=${encodeURIComponent(youngId)}`,
      );
      if ((page.viewportSize()?.width ?? 0) >= 1280) {
        await expect(
          page.getByRole("cell", {
            name:
              appliedCount === null
                ? /未提供 \/ 20|Not provided \/ 20/
                : /^0 \/ 20$/,
          }),
        ).toBeVisible();
      }
    });
  }
});
