import { describe } from "vitest";
import { staticImporterTest as it } from "../shared/static-importer-fixture";

const permissions = { tags: ["@Database/Permissions"] };

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "restricted static importer",
  () => {
    it(
      "connects with an independent unprivileged identity",
      permissions,
      async ({ importer, expect }) => {
        const [role] = await importer.$queryRaw<Array<Record<string, unknown>>>`
      SELECT current_user AS "currentUser", session_user AS "sessionUser",
        rolsuper, rolbypassrls, rolinherit, rolcreatedb, rolcreaterole, rolreplication,
        EXISTS (SELECT 1 FROM pg_auth_members WHERE member = pg_roles.oid) AS membership,
        EXISTS (SELECT 1 FROM pg_class WHERE relowner = pg_roles.oid) AS "ownsRelation",
        EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = pg_roles.oid) AS "ownsSchema"
      FROM pg_roles WHERE rolname = current_user
    `;
        expect(role).toEqual({
          currentUser: "life_ustc_importer",
          sessionUser: "life_ustc_importer",
          rolsuper: false,
          rolbypassrls: false,
          rolinherit: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolreplication: false,
          membership: false,
          ownsRelation: false,
          ownsSchema: false,
        });
      },
    );

    it(
      "denies private data even with a forged user context",
      permissions,
      async ({ importer, isolatedDatabase: { owner }, expect }) => {
        const actor = await owner.user.create({
          data: {
            email: "importer-role@example.test",
            name: "Importer role contract",
            isAdmin: true,
          },
        });
        for (const table of [
          "User",
          "Session",
          "Account",
          "Todo",
          "UserSectionSubscription",
          "Homework",
          "Comment",
          "Upload",
          "AuditLog",
          "Publication",
          "PrometheusCounter",
          "_prisma_migrations",
        ]) {
          await expect(
            importer.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.user_id', ${actor.id}, true)`;
              await tx.$queryRawUnsafe(`SELECT * FROM "${table}"`);
            }),
            table,
          ).rejects.toThrow(/permission denied/);
        }
        await expect(
          importer.$executeRaw`INSERT INTO "User" ("id", "email", "updatedAt") VALUES ('forged', 'forged@example.test', now())`,
        ).rejects.toThrow(/permission denied/);
      },
    );

    it(
      "denies DDL, TEMP, role escalation and privileged functions",
      permissions,
      async ({ importer, expect }) => {
        for (const sql of [
          "CREATE TABLE public.importer_forbidden (id int)",
          "CREATE TEMP TABLE importer_forbidden (id int)",
          'ALTER TABLE "Course" ADD COLUMN importer_forbidden int',
          "SET ROLE life_ustc_function_owner",
          "SET ROLE life_ustc_runtime",
          "SET ROLE postgres",
          "SELECT public.maintain_audit_log_retention(now()::timestamp, 1)",
          'TRUNCATE "Section" CASCADE',
        ])
          await expect(importer.$executeRawUnsafe(sql), sql).rejects.toThrow(
            /permission denied|must be owner/,
          );
        const publicFunctions = await importer.$queryRaw<
          Array<{ name: string }>
        >`
      SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND has_function_privilege(current_user, p.oid, 'EXECUTE')
    `;
        expect(publicFunctions).toEqual([]);
      },
    );

    it(
      "restricts direct table and sequence privileges to import facts",
      permissions,
      async ({ importer, expect }) => {
        const grants = await importer.$queryRaw<Array<{ name: string }>>`
      SELECT table_name || ':' || privilege_type AS name FROM information_schema.role_table_grants
      WHERE grantee = current_user AND table_schema = 'public'
      ORDER BY name
    `;
        const catalogTables = [
          "AdminClass",
          "Building",
          "Campus",
          "ClassType",
          "Course",
          "CourseCategory",
          "CourseClassify",
          "CourseGradation",
          "CourseType",
          "Department",
          "EducationLevel",
          "Exam",
          "ExamBatch",
          "ExamMode",
          "ExamRoom",
          "Room",
          "RoomType",
          "Schedule",
          "ScheduleGroup",
          "Section",
          "SectionTeacher",
          "Semester",
          "StaticImportState",
          "TeachLanguage",
          "Teacher",
          "TeacherAssignment",
          "TeacherLessonType",
          "TeacherTitle",
          "YoungEvent",
          "YoungOrganizer",
          "_ScheduleTeachers",
          "_SectionAdminClasses",
          "_SectionTeachers",
        ];
        const deleteTables = [
          "ScheduleGroup",
          "Schedule",
          "Exam",
          "TeacherAssignment",
          "ExamRoom",
          "_SectionTeachers",
          "_SectionAdminClasses",
          "_ScheduleTeachers",
        ];
        const expectedGrants = catalogTables.flatMap((table) =>
          ["SELECT", "INSERT", "UPDATE"].map(
            (privilege) => `${table}:${privilege}`,
          ),
        );
        expectedGrants.push(...deleteTables.map((table) => `${table}:DELETE`));
        expect(grants.map((row) => row.name)).toEqual(expectedGrants.sort());
        const sequences = await importer.$queryRaw<Array<{ name: string }>>`
        SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S'
        AND has_sequence_privilege(current_user, c.oid, 'USAGE') ORDER BY name
      `;
        expect(sequences.map((row) => row.name)).toEqual(
          [
            "AdminClass_id_seq",
            "Building_id_seq",
            "Campus_id_seq",
            "ClassType_id_seq",
            "CourseCategory_id_seq",
            "CourseClassify_id_seq",
            "CourseGradation_id_seq",
            "CourseType_id_seq",
            "Course_id_seq",
            "Department_id_seq",
            "EducationLevel_id_seq",
            "ExamBatch_id_seq",
            "ExamMode_id_seq",
            "ExamRoom_id_seq",
            "Exam_id_seq",
            "RoomType_id_seq",
            "Room_id_seq",
            "ScheduleGroup_id_seq",
            "Schedule_id_seq",
            "SectionTeacher_id_seq",
            "Section_id_seq",
            "Semester_id_seq",
            "TeachLanguage_id_seq",
            "TeacherAssignment_id_seq",
            "TeacherLessonType_id_seq",
            "TeacherTitle_id_seq",
            "Teacher_id_seq",
            "YoungEvent_id_seq",
          ].sort(),
        );
        for (const table of [
          "Course",
          "Section",
          "Teacher",
          "YoungEvent",
          "YoungOrganizer",
          "StaticImportState",
        ])
          await expect(
            importer.$executeRawUnsafe(`DELETE FROM "${table}"`),
            table,
          ).rejects.toThrow(/permission denied/);
        const forbidden = await importer.$queryRaw<Array<{ name: string }>>`
      SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'S'
      AND has_sequence_privilege(current_user, c.oid, 'UPDATE')
    `;
        expect(forbidden).toEqual([]);
        await expect(
          importer.$queryRaw`SELECT nextval('"VerifiedEmail_id_seq"')`,
        ).rejects.toThrow(/permission denied/);
      },
    );

    it(
      "only appends lifecycle audit rows without private attribution",
      permissions,
      async ({ importer, isolatedDatabase: { owner, app, auth }, expect }) => {
        const allowed = {
          action: "section_retire" as const,
          targetType: "section",
          targetId: "1",
          metadata: { source: "static-loader", snapshotSha256: "a".repeat(64) },
        };
        expect(
          await owner.prometheusCounter.count({ where: { kind: "audit" } }),
        ).toBe(0);
        await importer.auditLog.createMany({
          data: [allowed, { ...allowed, action: "section_reactivate" }],
        });
        for (const override of [
          { action: "homework_create" as const },
          { targetType: "homework" },
          { outcome: "failure" as const },
          { channel: "auth" as const },
          { targetId: null },
          { metadata: { source: "forged" } },
        ]) {
          await expect(
            importer.auditLog.createMany({
              data: [{ ...allowed, ...override }],
            }),
          ).rejects.toThrow(/row-level security/);
        }
        for (const column of [
          "userId",
          "subjectUserId",
          "oauthClientId",
          "oauthGrantId",
          "sessionId",
          "requestId",
          "ipAddress",
          "userAgent",
        ]) {
          await expect(
            importer.$executeRawUnsafe(
              `INSERT INTO "AuditLog" ("id", "action", "targetType", "targetId", "metadata", "${column}") VALUES ('forged', 'section_retire', 'section', '1', '{"source":"static-loader"}', 'forged')`,
            ),
            column,
          ).rejects.toThrow(/permission denied/);
        }
        await expect(
          importer.$executeRaw`UPDATE "AuditLog" SET "targetId" = '2'`,
        ).rejects.toThrow(/permission denied/);
        await expect(
          importer.$executeRaw`DELETE FROM "AuditLog"`,
        ).rejects.toThrow(/permission denied/);
        await app.auditLog.createMany({
          data: [
            {
              action: "homework_create",
              targetType: "homework",
              targetId: "existing-app-contract",
            },
          ],
        });
        await auth.auditLog.createMany({
          data: [
            {
              action: "account_sign_in",
              targetType: "session",
              targetId: "existing-auth-contract",
            },
          ],
        });
        const rows = await owner.auditLog.findMany({
          orderBy: { action: "asc" },
          select: { action: true, userId: true, subjectUserId: true },
        });
        expect(
          rows.sort((left, right) => left.action.localeCompare(right.action)),
        ).toEqual([
          { action: "account_sign_in", userId: null, subjectUserId: null },
          { action: "homework_create", userId: null, subjectUserId: null },
          { action: "section_reactivate", userId: null, subjectUserId: null },
          { action: "section_retire", userId: null, subjectUserId: null },
        ]);
        const counters = await owner.prometheusCounter.findMany({
          where: { kind: "audit" },
        });
        expect(
          counters
            .map((row) => ({
              ...JSON.parse(row.labels),
              value: row.value.toNumber(),
            }))
            .sort((left, right) => left.action.localeCompare(right.action)),
        ).toEqual([
          {
            action: "account_sign_in",
            channel: "web",
            outcome: "success",
            value: 1,
          },
          {
            action: "homework_create",
            channel: "web",
            outcome: "success",
            value: 1,
          },
          {
            action: "section_reactivate",
            channel: "web",
            outcome: "success",
            value: 1,
          },
          {
            action: "section_retire",
            channel: "web",
            outcome: "success",
            value: 1,
          },
        ]);
      },
    );
  },
);
