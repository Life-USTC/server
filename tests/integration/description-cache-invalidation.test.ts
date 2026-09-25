import { afterAll, describe, expect, it } from "vitest";
import { moderateDescription } from "@/features/admin/server/admin-api-service";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareCatalogInvalidator,
} from "@/lib/adapters/cloudflare-runtime";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { purgeEntrypointCatalogCache } from "@/lib/cloudflare/public-ssr-cache-purge";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const fixtures = createFixturePrisma();

afterAll(async () => {
  await Promise.all([fixtures.$disconnect(), runtimePrisma.$disconnect()]);
});

describe("description writes invalidate public representations", () => {
  it("invalidates only after commit, retries unchanged writes, and covers moderation", async () => {
    const marker = crypto.randomUUID();
    const user = await fixtures.user.create({
      data: {
        email: `${marker}@example.test`,
        name: "Description cache test",
        isAdmin: true,
      },
    });
    const teacher = await fixtures.teacher.create({
      data: {
        jwId: -Math.floor(Math.random() * 1_000_000_000) - 1,
        nameCn: marker,
      },
    });
    const description = await fixtures.description.create({
      data: {
        teacherId: teacher.id,
        content: "Original description",
        lastEditedById: user.id,
      },
    });
    let cachedRepresentation: string | undefined;
    let rejectPurge = true;
    let expectedCommittedContent = "Updated description";
    let purgeCount = 0;
    const render = async () => {
      if (cachedRepresentation !== undefined) return cachedRepresentation;
      const payload = await getDescriptionPayload(
        "teacher",
        teacher.id,
        await getViewerContext({ userId: null }),
        { includeHistory: false },
      );
      cachedRepresentation = payload.description.renderedHtml;
      return cachedRepresentation;
    };
    const request = <T>(action: () => Promise<T>) =>
      runWithCloudflareRuntimeEnv(
        { HYPERDRIVE: { connectionString: process.env.DATABASE_URL } },
        async () => {
          setCloudflareCatalogInvalidator(async () => {
            // A separate connection must already see the committed edit.
            expect(
              await fixtures.description.findUnique({
                where: { id: description.id },
                select: { content: true },
              }),
            ).toEqual({ content: expectedCommittedContent });
            const result = await purgeEntrypointCatalogCache({
              purge: async () => {
                purgeCount += 1;
                if (rejectPurge) return { success: false };
                cachedRepresentation = undefined;
                return { success: true };
              },
            });
            if (!result.ok) throw new Error("purge failed");
          });
          return action();
        },
      );
    const write = () =>
      upsertDescriptionContent({
        targetType: "teacher",
        targetId: teacher.id,
        userId: user.id,
        content: "Updated description",
      });

    try {
      expect(await render()).toContain("Original description");
      await expect(request(write)).rejects.toThrow("purge failed");
      expect(await render()).toContain("Original description");
      rejectPurge = false;
      await expect(request(write)).resolves.toMatchObject({
        ok: true,
        updated: false,
      });
      expect(await render()).toContain("Updated description");
      expect(
        await fixtures.descriptionEdit.count({
          where: { descriptionId: description.id },
        }),
      ).toBe(1);

      expectedCommittedContent = "";
      await expect(
        request(() =>
          moderateDescription(user.id, description.id, { content: "" }),
        ),
      ).resolves.toMatchObject({ ok: true });
      expect(await render()).not.toContain("Updated description");
      expect(purgeCount).toBe(3);
    } finally {
      await fixtures.auditLog.deleteMany({
        where: { targetId: description.id },
      });
      await fixtures.descriptionEdit.deleteMany({
        where: { descriptionId: description.id },
      });
      await fixtures.description.delete({ where: { id: description.id } });
      await fixtures.teacher.delete({ where: { id: teacher.id } });
      await fixtures.user.delete({ where: { id: user.id } });
    }
  });
});
