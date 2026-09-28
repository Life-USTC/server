import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";

type Runtime = ReturnType<typeof createNodeRuntime>;

export const rlsTest = isolatedDatabaseTest.extend<{
  rlsRuntime: Runtime;
  rlsActors: {
    firstUserId: string;
    secondUserId: string;
    adminUserId: string;
  };
  rlsSections: { sectionId: number; writeProbeSectionId: number };
  rlsCampuses: { id: number }[];
}>({
  rlsRuntime: async ({ isolatedDatabase }, use) => {
    const runtime = createNodeRuntime({
      HYPERDRIVE: { connectionString: isolatedDatabase.connections.app },
      HYPERDRIVE_AUTH: { connectionString: isolatedDatabase.connections.auth },
    });
    try {
      await use(runtime);
    } finally {
      await runtime.close();
    }
  },
  rlsActors: async ({ isolatedDatabase }, use) => {
    // Repeated IDs are confined to a private database with production RLS/grants.
    const actors = {
      firstUserId: "rls-owner",
      secondUserId: "rls-other",
      adminUserId: "rls-admin",
    };
    await isolatedDatabase.owner.user.createMany({
      data: Object.values(actors).map((id) => ({
        id,
        email: `${id}@example.test`,
        isAdmin: id === actors.adminUserId,
      })),
    });
    await use(actors);
  },
  rlsSections: async ({ isolatedDatabase }, use) => {
    const sections = await isolatedDatabase.owner.$transaction(async (db) => {
      const semester = await db.semester.create({
        data: { jwId: 1, code: "rls-semester", nameCn: "权限测试学期" },
      });
      const course = await db.course.create({
        data: { jwId: 1, code: "RLS", nameCn: "权限测试课程" },
      });
      const sections = [];
      for (const jwId of [1, 2]) {
        sections.push(
          await db.section.create({
            data: {
              jwId,
              code: `RLS-${jwId}`,
              courseId: course.id,
              semesterId: semester.id,
            },
          }),
        );
      }
      return sections;
    });
    await use({
      sectionId: sections[0].id,
      writeProbeSectionId: sections[1].id,
    });
  },
  rlsCampuses: async ({ isolatedDatabase }, use) => {
    const campuses = [
      { id: 1, nameCn: "东校区", latitude: 31.84, longitude: 117.26 },
      { id: 2, nameCn: "西校区", latitude: 31.84, longitude: 117.24 },
    ];
    await isolatedDatabase.owner.busCampus.createMany({ data: campuses });
    await use(campuses);
  },
});
