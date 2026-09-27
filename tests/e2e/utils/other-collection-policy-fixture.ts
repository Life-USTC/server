import { youngEventState } from "../../../src/features/young/server/young-notification-state";
import { withE2ePrisma } from "./e2e-db/prisma";
import {
  cleanupPublicBrowsePolicyFixture,
  createPublicBrowsePolicyFixture,
} from "./public-browse-policy-fixture";

export async function createOtherCollectionPolicyFixture() {
  const catalog = await createPublicBrowsePolicyFixture();
  const privateData = await withE2ePrisma(async (db) => {
    const admin = await db.user.create({
      data: {
        name: "Collection policy administrator",
        username: `ca${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
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
          observedState: youngEventState(
            await db.youngEvent.findUniqueOrThrow({ where: { youngId } }),
          ),
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
  ReturnType<typeof createOtherCollectionPolicyFixture>
>;
export async function cleanupOtherCollectionPolicyFixture(
  f: OtherCollectionPolicyFixture,
) {
  await withE2ePrisma((db) =>
    db.user.deleteMany({
      where: { id: { in: [f.admin.id, ...f.members.map((user) => user.id)] } },
    }),
  );
  await cleanupPublicBrowsePolicyFixture(f.catalog);
}
