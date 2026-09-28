import type { TestPrismaClient } from "../../shared/prisma";
import {
  test as browseTest,
  type PublicBrowsePolicyFixture,
} from "./public-browse-policy-fixture";

export async function arrangeOtherCollectionPolicyFixture(
  db: TestPrismaClient,
  catalog: PublicBrowsePolicyFixture,
) {
  const privateData = await db.$transaction(async (db) => {
    const admin = await db.user.create({
      data: {
        name: "Collection policy administrator",
        username: `ca${catalog.marker.replaceAll("-", "")}`,
        email: `admin-${catalog.marker}@example.test`,
        isAdmin: true,
      },
    });
    const members = [];
    for (let index = 0; index < 25; index++) {
      const suffix = String(index).padStart(2, "0");
      const youngId = `${catalog.marker}-E-${index}`;
      members.push(
        await db.user.create({
          data: {
            name: `${catalog.marker}-member-${suffix} with a distinguishing long account name`,
            email: `${catalog.marker}-member-${suffix}@example.test`,
            username: `${catalog.marker.replaceAll("-", "")}m${suffix}`,
          },
        }),
      );
      await db.upload.create({
        data: {
          userId: admin.id,
          key: `${catalog.marker}/upload-${index}`,
          filename: `${catalog.marker}-file-${suffix}-with-a-long-readable-filename.txt`,
          contentType: "text/plain",
          size: 1024 + index,
        },
      });
      await db.userYoungEventSubscription.create({
        data: {
          userId: admin.id,
          youngId,
          observedState: JSON.stringify([
            `${catalog.marker} event ${suffix} with a complete public activity title`,
            null,
            null,
            null,
            false,
            "2035-09-15T02:00:00.000Z",
            "2035-09-15T04:00:00.000Z",
            "2035-09-14T00:00:00.000Z",
            "2035-09-14T04:00:00.000Z",
          ]),
        },
      });
      await db.userYoungOrganizerSubscription.create({
        data: { userId: admin.id, organizerId: catalog.organizers[index].id },
      });
      await db.youngNotification.create({
        data: {
          userId: admin.id,
          youngId,
          kind: "event_changed",
          title: `${catalog.marker} notification ${suffix} with a full activity title`,
          body: "A complete notification body with public activity context.",
          dedupeKey: `${catalog.marker}-${index}`,
          expiresAt: new Date("2099-01-01T00:00:00Z"),
        },
      });
      await db.section.update({
        where: { id: catalog.sections[index].id },
        data: {
          courseId: catalog.courses[0].id,
          teachers: { set: { id: catalog.teachers[0].id } },
        },
      });
    }
    return { admin, members };
  });
  return { ...privateData, catalog };
}
export type OtherCollectionPolicyFixture = Awaited<
  ReturnType<typeof arrangeOtherCollectionPolicyFixture>
>;
export const test = browseTest.extend<{
  collection: OtherCollectionPolicyFixture;
}>({
  collection: async ({ isolatedWorker, browse }, use) => {
    await use(
      await arrangeOtherCollectionPolicyFixture(
        isolatedWorker.database.owner,
        browse,
      ),
    );
  },
});
