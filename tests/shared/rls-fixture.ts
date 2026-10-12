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
  rlsComments: {
    deleted: string;
    loggedIn: string;
    public: string;
    softbanned: string;
  };
  rlsReactions: { commentId: string };
  rlsHomework: { homeworkId: string };
}>({
  rlsRuntime: async ({ isolatedDatabase }, use) => {
    const runtime = createNodeRuntime({
      HYPERDRIVE: { connectionString: isolatedDatabase.connections.app },
      HYPERDRIVE_AUTH: { connectionString: isolatedDatabase.connections.auth },
      // RLS service calls enqueue invalidation; queue delivery has Worker tests.
      CALENDAR_EXPORT_REBUILD: { send: async () => {} },
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
  rlsComments: async ({ isolatedDatabase, rlsActors, rlsSections }, use) => {
    const ids = {
      deleted: "rls-test-comment-deleted",
      loggedIn: "rls-test-comment-logged-in",
      public: "rls-test-comment-public",
      softbanned: "rls-test-comment-softbanned",
    };
    await isolatedDatabase.owner.comment.createMany({
      data: (
        [
          { id: ids.public, status: "active", visibility: "public" },
          { id: ids.loggedIn, status: "active", visibility: "logged_in_only" },
          { id: ids.softbanned, status: "softbanned", visibility: "public" },
          { id: ids.deleted, status: "deleted", visibility: "public" },
        ] as const
      ).map((comment) => ({
        ...comment,
        body: "RLS comment visibility fixture",
        sectionId: rlsSections.sectionId,
        userId: rlsActors.firstUserId,
      })),
    });
    await use(ids);
  },
  rlsReactions: async ({ isolatedDatabase, rlsActors, rlsComments }, use) => {
    await isolatedDatabase.owner.commentReaction.createMany({
      data: [
        rlsComments.loggedIn,
        rlsComments.softbanned,
        rlsComments.deleted,
      ].map((commentId) => ({
        commentId,
        userId: rlsActors.secondUserId,
        type: "heart",
      })),
    });
    await use({ commentId: rlsComments.public });
  },
  rlsHomework: async ({ isolatedDatabase, rlsActors, rlsSections }, use) => {
    const homework = await isolatedDatabase.owner.homework.create({
      data: {
        id: "rls-homework",
        title: "RLS homework completion fixture",
        sectionId: rlsSections.sectionId,
        createdById: rlsActors.firstUserId,
      },
    });
    await use({ homeworkId: homework.id });
  },
});
