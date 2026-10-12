import type { RequestEvent } from "@sveltejs/kit";
import { makeSignature } from "better-auth/crypto";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restReadScope } from "@/lib/oauth/scope-registry";
import { nodeProtocolTest } from "./node-protocol-fixture";

type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{
    message: string;
    extensions?: { code?: string; requiredScopes?: string[] };
  }>;
};

const allViewerScopes = [
  restReadScope("account.profile"),
  restReadScope("workspace.overview"),
  restReadScope("workspace.todo"),
  restReadScope("workspace.subscription"),
  restReadScope("workspace.homework"),
  restReadScope("workspace.schedule"),
  restReadScope("workspace.exam"),
];

// Each consumer has one native case per file: Better Auth owns module caches,
// while this fixture owns the database, handler and all admitted request work.
export const graphqlViewerTest = nodeProtocolTest
  .extend("viewerTransport", async ({ protocolRuntime }) => {
    const handler = createGraphqlRequestHandler(false);
    async function execute(body: unknown, headers: HeadersInit = {}) {
      return protocolRuntime.request(async () => {
        const event = {
          request: new Request(getOAuthGraphqlResourceUrl(), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...Object.fromEntries(new Headers(headers)),
            },
            body: JSON.stringify(body),
          }),
          locals: {
            authUser: null,
            locale: "zh-cn",
            requestId: "graphql-viewer-integration",
          },
        } as unknown as RequestEvent;
        const response = await handler(event);
        return { response, payload: (await response.json()) as GraphqlPayload };
      });
    }
    return { execute, run: protocolRuntime.run };
  })
  .extend(
    "viewer",
    async ({
      isolatedDatabase: { owner: fixturePrisma },
      protocolRuntime,
      viewerTransport,
    }) => {
      const marker = crypto.randomUUID();
      const oauthClientId = `graphql-viewer-${marker}`;
      const firstUserId = `graphql-viewer-a-${marker}`;
      const secondUserId = `graphql-viewer-b-${marker}`;
      const firstScheduleDate = new Date("2026-04-29T00:00:00Z");

      async function createSessionCookie(userId: string) {
        return protocolRuntime.request(async () => {
          const token = crypto.randomUUID();
          await fixturePrisma.session.create({
            data: {
              expires: new Date(Date.now() + 60 * 60 * 1000),
              sessionToken: token,
              userId,
            },
          });
          const context = await getBetterAuthInstance().$context;
          const value = encodeURIComponent(
            `${token}.${await makeSignature(token, context.secret)}`,
          );
          return `${context.authCookies.sessionToken.name}=${value}`;
        });
      }

      async function signToken(
        userId: string,
        scopes: string[],
        resource = getOAuthGraphqlResourceUrl(),
      ) {
        return protocolRuntime.request(async () => {
          const consent = await fixturePrisma.oAuthConsent.findFirstOrThrow({
            where: {
              clientId: oauthClientId,
              scopes: { hasEvery: scopes },
              userId,
            },
            select: { grantId: true },
          });
          const issuedAt = Math.floor(Date.now() / 1000);
          const token = await signResourceBoundOAuthAccessToken({
            clientId: oauthClientId,
            grantId: consent.grantId,
            expiresAt: issuedAt + 300,
            issuedAt,
            resources: [resource],
            scopes,
            userId,
          });
          if (!token) throw new Error("Expected a signed access token");
          return token;
        });
      }

      return protocolRuntime.run(async () => {
        const sections = await fixturePrisma.$transaction(async (db) => {
          // Repeated local IDs must not reuse another database's catalog cache.
          await db.staticImportState.create({
            data: {
              id: "global",
              snapshotSha256: marker.replaceAll("-", "").repeat(2),
              snapshotGeneratedAt: new Date(),
              transformRevision: 6,
            },
          });
          const semester = await db.semester.create({
            data: {
              jwId: 1,
              code: "graphql-viewer",
              nameCn: "2026春",
              startDate: new Date("2026-02-23T00:00:00Z"),
              endDate: new Date("2026-07-19T00:00:00Z"),
            },
          });
          const campus = await db.campus.create({
            data: {
              jwId: 1,
              code: "east",
              nameCn: "东校区",
              nameEn: "East campus",
            },
          });
          const department = await db.department.create({
            data: {
              jwId: 1,
              code: "viewer",
              nameCn: "测试院系",
              nameEn: "Viewer department",
              isCollege: true,
            },
          });
          const teacherTitle = await db.teacherTitle.create({
            data: {
              jwId: 1,
              code: "professor",
              nameCn: "教授",
              nameEn: "Professor",
            },
          });
          const examMode = await db.examMode.create({
            data: { nameCn: "闭卷", nameEn: "Closed book" },
          });
          const teachLanguage = await db.teachLanguage.create({
            data: { nameCn: "中文", nameEn: "Chinese" },
          });
          const category = await db.courseCategory.create({
            data: { nameCn: "专业课", nameEn: "Major course" },
          });
          const sections: Array<{ id: number; jwId: number }> = [];
          for (const [index, userId] of [firstUserId, secondUserId].entries()) {
            const jwId = index + 1;
            const teacher = await db.teacher.create({
              data: {
                jwId,
                nameCn: `测试教师${jwId}`,
                departmentId: department.id,
                teacherTitleId: teacherTitle.id,
              },
            });
            const course = await db.course.create({
              data: {
                jwId,
                code: `viewer-course-${jwId}`,
                nameCn: `测试课程${jwId}`,
                nameEn: `Viewer course ${jwId}`,
                categoryId: category.id,
              },
            });
            const section = await db.section.create({
              data: {
                jwId,
                code: `viewer-section-${jwId}`,
                courseId: course.id,
                semesterId: semester.id,
                campusId: campus.id,
                openDepartmentId: department.id,
                examModeId: examMode.id,
                teachLanguageId: teachLanguage.id,
                teachers: { connect: { id: teacher.id } },
              },
              select: { id: true, jwId: true },
            });
            sections.push(section);
            const group = await db.scheduleGroup.create({
              data: {
                jwId,
                sectionId: section.id,
                no: 1,
                limitCount: 30,
                stdCount: 10,
                actualPeriods: 2,
                isDefault: true,
              },
            });
            await db.schedule.create({
              data: {
                sectionId: section.id,
                scheduleGroupId: group.id,
                date: firstScheduleDate,
                weekday: 3,
                startTime: 800,
                endTime: 935,
                startUnit: 1,
                endUnit: 2,
                periods: 2,
                weekIndex: 10,
                teacherParticipations: {
                  create: {
                    teacherId: teacher.id,
                    periods: null,
                    exerciseClass: null,
                  },
                },
              },
            });
            await db.exam.create({
              data: {
                jwId,
                sectionId: section.id,
                examDate: new Date("2026-06-29T00:00:00Z"),
                startTime: 900,
                endTime: 1100,
                examRooms: {
                  create: { room: `Viewer room ${jwId}`, count: 30 },
                },
              },
            });
            await db.homework.create({
              data: {
                sectionId: section.id,
                title: `[integration-test] viewer homework ${jwId}`,
              },
            });
            await db.user.create({
              data: {
                id: userId,
                email: `${userId}@example.test`,
                username: userId,
                name: index === 0 ? "GraphQL Viewer A" : "GraphQL Viewer B",
                sectionSubscriptions: { create: { sectionId: section.id } },
                todos: { create: { title: `[integration-test] ${userId}` } },
              },
            });
          }
          await db.oAuthClient.create({
            data: {
              clientId: oauthClientId,
              consents: {
                create: { scopes: allViewerScopes, userId: firstUserId },
              },
              name: "GraphQL viewer integration",
              redirectUris: ["https://graphql.example/callback"],
            },
          });
          await db.userSuspension.create({
            data: {
              reason: "[integration-test] reads remain available",
              userId: firstUserId,
            },
          });
          return sections;
        });
        const sessionCookie = await createSessionCookie(firstUserId);
        const graphqlBearer = await signToken(firstUserId, allViewerScopes);
        return {
          ...viewerTransport,
          fixturePrisma,
          firstUserId,
          secondUserId,
          firstSectionId: sections[0].id,
          firstSectionJwId: sections[0].jwId,
          secondSectionId: sections[1].id,
          firstScheduleDate,
          sessionCookie,
          graphqlBearer,
          createSessionCookie,
          signToken,
        };
      });
    },
  );
