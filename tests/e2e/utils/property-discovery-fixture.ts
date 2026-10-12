import { createHash } from "node:crypto";
import type { TestPrismaClient } from "../../shared/prisma";
import {
  arrangePublicationFixture,
  type PutPublicationObject,
} from "./e2e-db/publications";
import { publicationStorageTest } from "./publication-fixture";

export async function arrangePropertyDiscoveryFixture(
  db: TestPrismaClient,
  putObject: PutPublicationObject,
) {
  const marker = "01234567-89ab-4cde-8fab-0123456789ab";
  const publication = await arrangePublicationFixture(
    db,
    putObject,
    `priority-${marker}`,
  );
  const bytes = Buffer.from(`Priority attachment ${marker}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const objectKey = `publications/asset/sha256/${hash.slice(0, 2)}/${hash}`;
  await putObject(objectKey, bytes, "application/pdf");
  const data = await db.$transaction(async (db) => {
    const user = await db.user.create({
      data: {
        name: "Priority reader",
        username: `priority-${marker}`,
        email: `priority-${marker}@example.test`,
        emailVerified: true,
        workspaceLinkPins: { create: { slug: "jw" } },
      },
    });
    const current = await db.publication.findUniqueOrThrow({
      where: { id: publication.id },
    });
    if (!current.currentRevisionId)
      throw new Error("Publication fixture has no current revision");
    const revision = await db.publicationRevision.update({
      where: { id: current.currentRevisionId },
      data: {
        summary: "Priority article summary",
        author: "Priority author",
        reporter: "Priority reporter",
        editor: "Priority editor",
        originalPublisher: "Priority publisher",
        rawMetadata: { privateMarker: `raw-publication-${marker}` },
      },
    });
    const asset = await db.publicationObject.create({
      data: {
        kind: "asset",
        sha256: hash,
        r2Key: objectKey,
        size: bytes.byteLength,
        contentType: "application/pdf",
        status: "verified",
        verifiedAt: new Date(),
      },
    });
    await db.publicationObjectLink.create({
      data: {
        revisionId: revision.id,
        objectId: asset.id,
        role: "asset",
        filename: "Priority attachment.pdf",
      },
    });
    const organizer = await db.youngOrganizer.create({
      data: {
        id: `priority-organizer-id-${marker}`,
        name: `Priority organizer ${marker.slice(0, 8)}`,
        normalizedName: `priority-organizer-${marker}`,
      },
    });
    const young = await db.youngEvent.create({
      data: {
        youngId: `priority-event-id-${marker}`,
        name: `Priority 活动 ${marker.slice(0, 8)}`,
        organizerId: organizer.id,
        organizer: organizer.name,
        rawJson: { privateMarker: `young-raw-${marker}` },
        isActive: true,
        sourceMissing: true,
        status: "报名中",
        category: "Priority category",
        module: "智",
        activityLevel: "校级",
        form: "讲座",
        grades: "2026 cohort",
        department: "Priority department",
        sponsor: "Priority sponsor",
        externalSponsor: "Priority partner",
        contactName: "Priority contact",
        contactTel: "0551-63600000",
        location: "Priority venue",
        imageUrl: `group1/priority-${marker}.png`,
        description: "<p>Priority event description</p>",
        participationNotes: "<p>Priority participation notes</p>",
        startAt: new Date("2035-09-15T10:00:00+08:00"),
        endAt: new Date("2035-09-15T12:00:00+08:00"),
        applyStartAt: new Date("2035-09-01T08:00:00+08:00"),
        applyEndAt: new Date("2035-09-14T20:00:00+08:00"),
        hours: 2.5,
        capacity: 47,
        appliedCount: 13,
        duration: 2,
        serviceHour: 3.5,
        sumHours: 59,
        sumPersons: 23,
        partakeNum: 17,
        favCount: 7,
        limitNum: 41,
        createdAtUpstream: new Date("2035-08-01T09:11:00+08:00"),
        auditedAt: new Date("2035-08-02T09:12:00+08:00"),
        updatedAtUpstream: new Date("2035-08-03T09:13:00+08:00"),
        requiresSignup: true,
        requiresSignupInfo: true,
        signupScopeCode: `opaque-scope-${marker}`,
        signupDepartmentIds: [`opaque-department-${marker}`],
        allowedAttachmentTypes: ["pdf", "docx"],
        isOnline: true,
        onlineMeetingInfo: "Priority meeting 8123",
        places: [
          {
            placeInfo: "Priority room 3A204",
            placeSt: "2035-09-15T10:00:00+08:00",
            placeEt: "2035-09-15T12:00:00+08:00",
          },
        ],
      },
    });
    const base = 1_600_000_000;
    const campuses = await Promise.all(
      [0, 1].map((i) =>
        db.busCampus.create({
          data: {
            id: base + i,
            nameCn: `优先级${i === 0 ? "甲" : "乙"}站${marker.slice(0, 4)}`,
            nameEn: `Priority ${i === 0 ? "Alpha" : "Beta"} ${marker.slice(0, 4)}`,
            latitude: 31.82 + i * 0.01,
            longitude: 117.26 + i * 0.01,
          },
        }),
      ),
    );
    const route = await db.busRoute.create({
      data: {
        id: base + 2,
        nameCn: "优先级测试线路",
        nameEn: "Priority route",
        stops: {
          create: campuses.map((campus, i) => ({
            campusId: campus.id,
            stopOrder: i + 1,
          })),
        },
      },
    });
    const rawCampuses = campuses.map((c) => ({
      id: c.id,
      name: c.nameCn,
      latitude: c.latitude,
      longitude: c.longitude,
    }));
    const rawRoute = { id: route.id, campuses: rawCampuses };
    const schedules = [
      {
        id: route.id,
        route: rawRoute,
        time: [
          ["13:00", "13:20"],
          ["00:00", "23:59"],
        ],
      },
    ];
    const version = await db.busScheduleVersion.create({
      data: {
        key: `priority-version-${marker}`,
        title: "Priority timetable",
        checksum: marker,
        isEnabled: true,
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        rawJson: {
          campuses: rawCampuses,
          routes: [rawRoute],
          weekday_routes: schedules,
          saturday_routes: schedules,
          sunday_routes: schedules,
        },
      },
    });
    const trips = [];
    for (const [dayIndex, dayType] of (
      ["weekday", "saturday", "sunday"] as const
    ).entries())
      for (const position of [0, 1])
        trips.push(
          await db.busTrip.create({
            data: {
              id: base + 10 + dayIndex * 2 + position,
              versionId: version.id,
              routeId: route.id,
              dayType,
              position,
              stopTimes: schedules[0].time[position],
            },
          }),
        );
    return {
      user,
      revision,
      asset,
      organizer,
      young,
      campuses,
      route,
      version,
      trips,
    };
  });
  return {
    ...data,
    publication,
    marker,
    attachmentBytes: bytes,
    attachmentKey: objectKey,
  };
}

export const test = publicationStorageTest.extend<{
  discoveryState: Awaited<ReturnType<typeof arrangePropertyDiscoveryFixture>>;
}>({
  discoveryState: async ({ isolatedWorker, publicationObjects, run }, use) => {
    await use(
      await run(() =>
        arrangePropertyDiscoveryFixture(
          isolatedWorker.database.owner,
          publicationObjects.put,
        ),
      ),
    );
  },
});
