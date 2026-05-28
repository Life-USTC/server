import scenarioData from "../../../tests/e2e/fixtures/scenario.json";
import type { ToolPrismaClient } from "../../shared/tool-prisma";
import {
  DEV_SCENARIO_IDS,
  DEV_SCENARIO_KEY_PREFIX,
  DEV_SCENARIO_MARKER,
  DEV_SEED,
} from "./dev-seed";

type CleanupDevScenarioOptions = {
  removeCatalogMetadata?: boolean;
  removePersonalState?: boolean;
  removeBusVersion?: boolean;
  userSuspensions?: "byMarker" | "byUser";
};

const scenario = scenarioData;
const sectionJwIds = [...DEV_SCENARIO_IDS.sectionJwIds];
const courseJwIds = [...DEV_SCENARIO_IDS.courseJwIds];
const teacherCodes = [...DEV_SCENARIO_IDS.teacherCodes];
const scheduleGroupJwIds = [...DEV_SCENARIO_IDS.scheduleGroupJwIds];
const STATIC_BUS_VERSION_KEY = "static-bus-structured";
const LEGACY_DEV_BUS_VERSION_KEYS = ["scenario-bus-2025"] as const;

export async function cleanupDevScenarioData(
  prisma: ToolPrismaClient,
  userIds: string[],
  options: CleanupDevScenarioOptions = {},
) {
  const {
    removeCatalogMetadata = false,
    removePersonalState = true,
    removeBusVersion = true,
    userSuspensions = "byMarker",
  } = options;

  await prisma.user.deleteMany({
    where: { username: { startsWith: "e2e-" } },
  });

  // Independent of each other (different tables, all keyed by scenario prefix
  // or constant; userSuspension also fits because it doesn't FK into the
  // tables above).
  await Promise.all([
    prisma.session.deleteMany({
      where: {
        sessionToken: { startsWith: `${DEV_SCENARIO_KEY_PREFIX}session-` },
      },
    }),
    prisma.account.deleteMany({
      where: { provider: { startsWith: "dev-scenario-" } },
    }),
    prisma.authenticator.deleteMany({
      where: {
        credentialID: { startsWith: `${DEV_SCENARIO_KEY_PREFIX}credential-` },
      },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: { startsWith: DEV_SCENARIO_KEY_PREFIX } },
    }),
    prisma.verifiedEmail.deleteMany({
      where: { provider: "dev-scenario" },
    }),
    prisma.uploadPending.deleteMany({
      where: { key: { startsWith: DEV_SCENARIO_KEY_PREFIX } },
    }),
    prisma.userSuspension.deleteMany({
      where:
        userSuspensions === "byUser"
          ? { userId: { in: userIds } }
          : { reason: { contains: DEV_SCENARIO_MARKER } },
    }),
  ]);

  await Promise.all(
    userIds.map((userId) =>
      prisma.user.update({
        where: { id: userId },
        data: { subscribedSections: { set: [] } },
      }),
    ),
  );

  await Promise.all([
    prisma.comment.deleteMany({
      where: {
        OR: [
          { body: { contains: DEV_SCENARIO_MARKER } },
          { section: { jwId: { in: sectionJwIds } } },
        ],
      },
    }),
    prisma.upload.deleteMany({
      where: { key: { startsWith: DEV_SCENARIO_KEY_PREFIX } },
    }),
  ]);

  const homeworks = await prisma.homework.findMany({
    where: {
      OR: [
        { title: { contains: DEV_SCENARIO_MARKER } },
        { section: { jwId: { in: sectionJwIds } } },
      ],
    },
    select: { id: true },
  });

  if (homeworks.length > 0) {
    const homeworkIds = homeworks.map((item) => item.id);
    await prisma.homeworkCompletion.deleteMany({
      where: { homeworkId: { in: homeworkIds } },
    });
    await prisma.homework.deleteMany({ where: { id: { in: homeworkIds } } });
  }

  await prisma.descriptionEdit.deleteMany({
    where: {
      OR: [
        { nextContent: { contains: DEV_SCENARIO_MARKER } },
        { description: { section: { jwId: { in: sectionJwIds } } } },
        { description: { course: { jwId: { in: courseJwIds } } } },
        { description: { teacher: { code: { in: teacherCodes } } } },
        {
          description: {
            homework: { section: { jwId: { in: sectionJwIds } } },
          },
        },
      ],
    },
  });
  await prisma.description.deleteMany({
    where: {
      OR: [
        { content: { contains: DEV_SCENARIO_MARKER } },
        { section: { jwId: { in: sectionJwIds } } },
        { course: { jwId: { in: courseJwIds } } },
        { teacher: { code: { in: teacherCodes } } },
        { homework: { section: { jwId: { in: sectionJwIds } } } },
      ],
    },
  });

  // Section-keyed deletes that don't FK each other (examRoom must precede
  // exam since it FKs into it).
  await Promise.all([
    prisma.schedule.deleteMany({
      where: { section: { jwId: { in: sectionJwIds } } },
    }),
    prisma.teacherAssignment.deleteMany({
      where: { section: { jwId: { in: sectionJwIds } } },
    }),
    prisma.sectionTeacher.deleteMany({
      where: { section: { jwId: { in: sectionJwIds } } },
    }),
    prisma.homeworkAuditLog.deleteMany({
      where: { section: { jwId: { in: sectionJwIds } } },
    }),
    (async () => {
      await prisma.examRoom.deleteMany({
        where: { exam: { section: { jwId: { in: sectionJwIds } } } },
      });
      await prisma.exam.deleteMany({
        where: { section: { jwId: { in: sectionJwIds } } },
      });
    })(),
  ]);

  await prisma.scheduleGroup.deleteMany({
    where: {
      OR: [
        { section: { jwId: { in: sectionJwIds } } },
        { jwId: { in: scheduleGroupJwIds } },
      ],
    },
  });
  await prisma.section.deleteMany({
    where: { jwId: { in: sectionJwIds } },
  });

  await Promise.all([
    prisma.teacher.deleteMany({ where: { code: { in: teacherCodes } } }),
    prisma.course.deleteMany({ where: { jwId: { in: courseJwIds } } }),
    prisma.examBatch.deleteMany({
      where: {
        OR: [
          { nameCn: DEV_SEED.examBatch.nameCn },
          { nameCn: "DEV 测试考试批次" },
        ],
      },
    }),
    prisma.adminClass.deleteMany({
      where: {
        OR: [
          { jwId: scenario.catalog.adminClass.jwId },
          { code: scenario.catalog.adminClass.code },
          { nameCn: "DEV 测试班级" },
        ],
      },
    }),
  ]);
  await prisma.semester.deleteMany({
    where: { jwId: DEV_SCENARIO_IDS.semesterJwId },
  });

  if (removeCatalogMetadata) {
    await prisma.room.deleteMany({
      where: { jwId: DEV_SCENARIO_IDS.roomJwId },
    });
    await prisma.building.deleteMany({
      where: { jwId: DEV_SCENARIO_IDS.buildingJwId },
    });
    await prisma.roomType.deleteMany({
      where: { jwId: DEV_SCENARIO_IDS.roomTypeJwId },
    });
    await prisma.campus.deleteMany({
      where: { jwId: DEV_SCENARIO_IDS.campusJwId },
    });
    await prisma.teacherLessonType.deleteMany({
      where: { jwId: DEV_SCENARIO_IDS.teacherLessonTypeJwId },
    });
    await prisma.teacherTitle.deleteMany({
      where: { jwId: DEV_SCENARIO_IDS.teacherTitleJwId },
    });
    await prisma.department.deleteMany({
      where: { code: scenario.catalog.department.code },
    });
    await prisma.teachLanguage.deleteMany({
      where: { nameCn: DEV_SEED.section.teachLanguageNameCn },
    });
    await prisma.examMode.deleteMany({
      where: { nameCn: DEV_SEED.section.examModeNameCn },
    });
    await prisma.educationLevel.deleteMany({
      where: { nameCn: DEV_SEED.course.educationLevelNameCn },
    });
    await prisma.courseCategory.deleteMany({
      where: { nameCn: DEV_SEED.course.categoryNameCn },
    });
    await prisma.classType.deleteMany({
      where: { nameCn: DEV_SEED.course.classTypeNameCn },
    });
    await prisma.courseClassify.deleteMany({
      where: { nameCn: scenario.catalog.classify.nameCn },
    });
    await prisma.courseGradation.deleteMany({
      where: { nameCn: scenario.catalog.gradation.nameCn },
    });
    await prisma.courseType.deleteMany({
      where: { nameCn: scenario.catalog.courseType.nameCn },
    });
  }

  if (removePersonalState) {
    await Promise.all([
      prisma.todo.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.dashboardLinkClick.deleteMany({
        where: { userId: { in: userIds } },
      }),
      prisma.dashboardLinkPin.deleteMany({
        where: { userId: { in: userIds } },
      }),
      prisma.busUserPreference.deleteMany({
        where: { userId: { in: userIds } },
      }),
    ]);
  }

  if (removeBusVersion) {
    const removableBusVersionKeys =
      DEV_SEED.bus.versionKey === STATIC_BUS_VERSION_KEY
        ? [...LEGACY_DEV_BUS_VERSION_KEYS]
        : [DEV_SEED.bus.versionKey];

    if (removableBusVersionKeys.length > 0) {
      // busTrip FKs into busScheduleVersion → must precede.
      await prisma.busTrip.deleteMany({
        where: { version: { key: { in: removableBusVersionKeys } } },
      });
      await prisma.busScheduleVersion.deleteMany({
        where: { key: { in: removableBusVersionKeys } },
      });
    }
  }
}
