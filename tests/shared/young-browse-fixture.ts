import type { TestPrismaClient } from "./prisma";

export async function createYoungBrowseFixture(
  db: Pick<TestPrismaClient, "youngOrganizer" | "youngEvent">,
) {
  const marker = `young-browse-${crypto.randomUUID()}`;
  const organizerIds = Array.from(
    { length: 24 },
    (_, index) => `${marker}-org-${String(index).padStart(2, "0")}`,
  );
  const eventIds = Array.from(
    { length: 13 },
    (_, index) => `${marker}-event-${String(index).padStart(2, "0")}`,
  );
  const search = `${marker} Event`;
  const category = `${marker}-category`;
  for (const index of Array.from({ length: 24 }, (_, i) => 23 - i)) {
    await db.youngOrganizer.create({
      data: {
        id: organizerIds[index],
        name: `${index < 6 ? "Z" : "A"} ${marker} ${index < 12 ? "tie" : String(index)}`,
        normalizedName: organizerIds[index],
      },
    });
    await db.youngEvent.create({
      data: {
        youngId: `${marker}-organizer-event-${index}`,
        name: `${marker} Organizer activity ${index}`,
        organizerId: organizerIds[index],
        isActive: index < 6,
        rawJson: {},
      },
    });
  }
  for (const index of Array.from({ length: 13 }, (_, i) => 12 - i)) {
    const day =
      index === 6 || index === 9
        ? "16"
        : index === 8 || index === 11 || index === 12
          ? "14"
          : "15";
    await db.youngEvent.create({
      data: {
        youngId: eventIds[index],
        name: `${search} ${String(index).padStart(2, "0")}`,
        organizerId: organizerIds[0],
        organizer: `Z ${marker} tie`,
        category: index === 6 ? `${category}-other` : category,
        module:
          index === 7
            ? "未知模块"
            : index === 6
              ? "体"
              : index === 9
                ? "劳"
                : "智",
        activityLevel: index === 7 ? "未知级别" : index === 6 ? "院级" : "校级",
        isActive: index !== 6 && index !== 11,
        startAt:
          index === 7
            ? null
            : new Date(
                `2035-09-${day}T${index === 10 ? "23:59:59" : "10:00:00"}+08:00`,
              ),
        endAt:
          index === 10 || index === 12
            ? null
            : new Date(
                index === 8
                  ? "2035-09-15T10:00:00+08:00"
                  : index === 11
                    ? "2035-09-15T00:00:00+08:00"
                    : `2035-09-${day}T12:00:00+08:00`,
              ),
        applyStartAt:
          index === 10
            ? null
            : new Date(
                `2035-09-${index === 6 ? "16" : index === 8 || index === 11 || index === 12 ? "14" : "15"}T08:00:00+08:00`,
              ),
        applyEndAt:
          index === 10
            ? null
            : new Date(
                `2035-09-${index === 6 ? "16" : index === 8 || index === 11 || index === 12 ? "14" : "15"}T09:00:00+08:00`,
              ),
        rawJson: {},
      },
    });
  }
  return { marker, organizerIds, eventIds, search, category };
}
export type YoungBrowseFixture = Awaited<
  ReturnType<typeof createYoungBrowseFixture>
>;
