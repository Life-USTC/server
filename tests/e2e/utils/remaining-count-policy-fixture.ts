import { withE2ePrisma } from "./e2e-db/prisma";

export async function createRemainingCountFixture(count: number) {
  const marker = `count-${crypto.randomUUID()}`;
  const base = 1_200_000_000 + Math.floor(Math.random() * 100_000_000);
  return withE2ePrisma(async (db) => {
    const owner = await db.user.create({
      data: {
        name: "Count grammar administrator",
        username: "countgrammar",
        email: `${marker}@example.test`,
        isAdmin: true,
      },
    });
    const semester = await db.semester.create({
      data: {
        jwId: base,
        code: marker,
        nameCn: "2026-2027学年第一学期",
      },
    });
    const course = await db.course.create({
      data: {
        jwId: base + 1,
        code: `CNP${base}`,
        nameCn: "计数语法测试课程",
        nameEn: "Count grammar course",
      },
    });
    const contextOrganizer = await db.youngOrganizer.create({
      data: {
        name: "Count grammar detail context",
        normalizedName: `${marker}-context`,
      },
    });
    const members = [];
    const sections = [];
    const organizers = [];
    const events = [];
    const sources = [];
    const publications = [];
    for (let index = 0; index < count; index++) {
      await db.auditLog.create({
        data: {
          userId: owner.id,
          subjectUserId: owner.id,
          action: "account_profile_update",
          outcome: "success",
          channel: "web",
          createdAt: new Date(Date.now() - index * 1000),
        },
      });
      members.push(
        await db.user.create({
          data: {
            name: `${marker}-member-${index}`,
            email: `${marker}-member-${index}@example.test`,
          },
        }),
      );
      const section = await db.section.create({
        data: {
          jwId: base + 10 + index,
          code: `${course.code}.${String(index + 1).padStart(2, "0")}`,
          courseId: course.id,
          semesterId: semester.id,
        },
      });
      sections.push(section);
      await db.description.create({
        data: {
          sectionId: section.id,
          content: `${marker} description ${index}`,
          lastEditedById: owner.id,
          lastEditedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });
      await db.comment.create({
        data: {
          courseId: course.id,
          userId: owner.id,
          body: "Signed-in discussion",
          visibility: "logged_in_only",
        },
      });
      await db.oAuthClient.create({
        data: {
          clientId: `${marker}-client-${index}`,
          userId: owner.id,
          name: `Count grammar client ${index + 1}`,
          public: true,
          redirectUris: ["https://example.test/callback"],
          tokenEndpointAuthMethod: "none",
          grantTypes: ["authorization_code"],
        },
      });
      organizers.push(
        await db.youngOrganizer.create({
          data: {
            name: `${marker} organizer ${index}`,
            normalizedName: `${marker}-organizer-${index}`,
          },
        }),
      );
      events.push(
        await db.youngEvent.create({
          data: {
            youngId: `${marker}-event-${index}`,
            name: `${marker} event ${index}`,
            organizerId: contextOrganizer.id,
            isActive: true,
            startAt: new Date("2035-09-15T10:00:00+08:00"),
            endAt: new Date("2035-09-15T12:00:00+08:00"),
            rawJson: {},
          },
        }),
      );
      await db.youngNotification.create({
        data: {
          userId: owner.id,
          organizerId: contextOrganizer.id,
          kind: "organizer_digest",
          title: `Activity digest ${index + 1}`,
          body: `${count} 个新活动 / new events: Count grammar activity`,
          dedupeKey: `${marker}-${index}`,
          expiresAt: new Date("2099-01-01T00:00:00Z"),
        },
      });
      const source = await db.publicationSource.create({
        data: {
          id: `${marker}-source-${index}`,
          name: `Count grammar source ${index + 1}`,
          organizationLevel: "university",
          allowedHosts: ["example.test"],
        },
      });
      sources.push(source);
      const publication = await db.publication.create({
        data: {
          sourceId: source.id,
          canonicalUrl: `https://example.test/${marker}/${index}`,
          title: `${marker} publication ${index}`,
          publicationType: "news",
          publishedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });
      const revision = await db.publicationRevision.create({
        data: {
          publicationId: publication.id,
          revisionHash: `${index}`.padStart(64, "a"),
          title: publication.title,
          publicationType: "news",
          publishedAt: publication.publishedAt,
          observedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });
      await db.publication.update({
        where: { id: publication.id },
        data: { currentRevisionId: revision.id },
      });
      publications.push(publication);
    }
    return {
      count,
      marker,
      owner,
      semester,
      course,
      contextOrganizer,
      members,
      sections,
      organizers,
      events,
      sources,
      publications,
    };
  });
}

export type RemainingCountFixture = Awaited<
  ReturnType<typeof createRemainingCountFixture>
>;

export async function setCountPublications(
  f: RemainingCountFixture,
  siblings: number | null,
) {
  await withE2ePrisma(async (db) => {
    await db.publication.deleteMany({
      where: { sourceId: { in: f.sources.map((source) => source.id) } },
    });
    if (siblings === null) return;
    for (const [index, source] of f.sources.entries()) {
      for (
        let sibling = 0;
        sibling <= (index === 0 ? siblings : 0);
        sibling++
      ) {
        const publication = await db.publication.create({
          data: {
            sourceId: source.id,
            canonicalUrl: `https://example.test/${f.marker}/${index}/${sibling}`,
            title: `${f.marker} publication ${index}`,
            publicationType: "news",
            publishedAt: new Date("2026-01-01T00:00:00Z"),
          },
        });
        const revision = await db.publicationRevision.create({
          data: {
            publicationId: publication.id,
            revisionHash: `${index}-${sibling}`.padStart(64, "a"),
            title: publication.title,
            publicationType: "news",
            publishedAt: publication.publishedAt,
            observedAt: new Date("2026-01-01T00:00:00Z"),
          },
        });
        await db.publication.update({
          where: { id: publication.id },
          data: { currentRevisionId: revision.id },
        });
      }
    }
  });
}

export async function resetCountSubscriptions(f: RemainingCountFixture) {
  await withE2ePrisma(async (db) => {
    await db.userSectionSubscription.deleteMany({
      where: { userId: f.owner.id },
    });
  });
}

export async function cleanupRemainingCountFixture(f: RemainingCountFixture) {
  await withE2ePrisma(async (db) => {
    await db.auditLog.deleteMany({ where: { subjectUserId: f.owner.id } });
    await db.user.deleteMany({
      where: { id: { in: [f.owner.id, ...f.members.map((user) => user.id)] } },
    });
    await db.section.deleteMany({
      where: { id: { in: f.sections.map((section) => section.id) } },
    });
    await db.course.delete({ where: { id: f.course.id } });
    await db.semester.delete({ where: { id: f.semester.id } });
    await db.youngEvent.deleteMany({
      where: { youngId: { in: f.events.map((event) => event.youngId) } },
    });
    await db.youngOrganizer.deleteMany({
      where: {
        id: {
          in: [
            f.contextOrganizer.id,
            ...f.organizers.map((organizer) => organizer.id),
          ],
        },
      },
    });
    await db.publicationSource.deleteMany({
      where: { id: { in: f.sources.map((source) => source.id) } },
    });
  });
}
