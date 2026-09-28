import { DEV_SEED, prisma } from "./fixtures";

/** Seed facts are read only; every case owns its section and academic records. */
export async function createSubscribedAcademicFixture(userId: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
      include: {
        teachers: { select: { id: true } },
        scheduleGroups: {
          include: { schedules: { include: { teacherParticipations: true } } },
        },
        exams: { include: { examRooms: true } },
        homeworks: { include: { description: true } },
      },
    });
    const base = 1_750_000_000 + Math.floor(Math.random() * 100_000_000);
    const section = await tx.section.create({
      data: {
        jwId: base,
        code: `MCP-${crypto.randomUUID()}.01`,
        courseId: source.courseId,
        semesterId: source.semesterId,
        campusId: source.campusId,
        roomTypeId: source.roomTypeId,
        credits: source.credits,
        teachers: { connect: source.teachers },
      },
    });
    for (const [index, group] of source.scheduleGroups.entries()) {
      const createdGroup = await tx.scheduleGroup.create({
        data: {
          jwId: base + index,
          sectionId: section.id,
          no: group.no,
          limitCount: group.limitCount,
          stdCount: group.stdCount,
          actualPeriods: group.actualPeriods,
          isDefault: group.isDefault,
        },
      });
      for (const schedule of group.schedules) {
        const {
          id: _id,
          sectionId: _sectionId,
          scheduleGroupId: _groupId,
          teacherParticipations,
          ...data
        } = schedule;
        await tx.schedule.create({
          data: {
            ...data,
            sectionId: section.id,
            scheduleGroupId: createdGroup.id,
            teacherParticipations: {
              create: teacherParticipations.map(
                ({ teacherId, periods, exerciseClass }) => ({
                  teacherId,
                  periods,
                  exerciseClass,
                }),
              ),
            },
          },
        });
      }
    }
    for (const [index, exam] of source.exams.entries()) {
      const {
        id: _id,
        sectionId: _sectionId,
        jwId: _jwId,
        examRooms,
        monitors,
        ...data
      } = exam;
      await tx.exam.create({
        data: {
          ...data,
          monitors: monitors ?? undefined,
          sectionId: section.id,
          jwId: base + index,
          examRooms: {
            create: examRooms.map(({ room, count }) => ({ room, count })),
          },
        },
      });
    }
    for (const homework of source.homeworks) {
      const { id: _id, sectionId: _sectionId, description, ...data } = homework;
      await tx.homework.create({
        data: {
          ...data,
          sectionId: section.id,
          ...(description
            ? {
                description: {
                  create: {
                    content: description.content,
                    lastEditedAt: description.lastEditedAt,
                    lastEditedById: description.lastEditedById,
                  },
                },
              }
            : {}),
        },
      });
    }
    await tx.userSectionSubscription.create({
      data: { userId, sectionId: section.id },
    });
    return section;
  });
}

export async function deleteAcademicFixture(sectionId: number) {
  await prisma.$transaction(async (tx) => {
    await tx.schedule.deleteMany({ where: { sectionId } });
    await tx.scheduleGroup.deleteMany({ where: { sectionId } });
    await tx.section.deleteMany({ where: { id: sectionId } });
  });
}
