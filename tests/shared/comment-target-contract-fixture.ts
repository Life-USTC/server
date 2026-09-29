import { makeSignature } from "better-auth/crypto";
import { postCommentRoute as createCommentRequest } from "@/lib/api/routes/comments-create-route";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
import { patchCommentRoute as updateCommentRequest } from "@/lib/api/routes/comments-update-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { nodeProtocolTest } from "./node-protocol-fixture";

type Target = {
  type: string;
  id: string | number;
  public: Record<string, string | number>;
  column: string;
};

// Session reads use the runtime-bound auth Prisma proxy. Each case owns its
// target graph and session; immutable auth configuration can remain file shared.
export const commentTargetTest = nodeProtocolTest.extend(
  "commentTargets",
  async ({
    isolatedDatabase: { owner: db },
    protocolRuntime,
    task: {
      context: { expect },
    },
  }) =>
    protocolRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const userId = `comment-target-${marker}`;
      const origin = "http://localhost:3000";
      const sessionToken = crypto.randomUUID();
      const { sectionId, teacherId, targets } = await db.$transaction(
        async (tx) => {
          await tx.user.create({
            data: { id: userId, email: `${userId}@example.test` },
          });
          await tx.session.create({
            data: {
              userId,
              sessionToken,
              expires: new Date(Date.now() + 3600000),
            },
          });
          const semester = await tx.semester.create({
            data: { jwId: 1, code: marker, nameCn: "Comment target semester" },
          });
          const course = await tx.course.create({
            data: {
              jwId: 700_000_000 + Math.floor(Math.random() * 100000000),
              code: marker,
              nameCn: "Comment target course",
            },
          });
          const section = await tx.section.create({
            data: {
              courseId: course.id,
              semesterId: semester.id,
              jwId: 1_700_000_000 + Math.floor(Math.random() * 100000000),
              code: marker,
            },
          });
          const sectionId = section.id;
          const teacher = await tx.teacher.create({
            data: { jwId: -section.jwId, nameCn: marker },
          });
          const teacherId = teacher.id;
          await tx.section.update({
            where: { id: sectionId },
            data: { teachers: { connect: { id: teacherId } } },
          });
          const relationship = await tx.sectionTeacher.create({
            data: { sectionId, teacherId },
          });
          const homework = await tx.homework.create({
            data: { title: marker, sectionId },
          });
          const young = await tx.youngEvent.create({
            data: {
              youngId: `young-${marker}`,
              name: marker,
              isActive: true,
              rawJson: {},
            },
          });
          const targets: Target[] = [
            {
              type: "course",
              id: course.id,
              public: { courseJwId: course.jwId },
              column: "courseId",
            },
            {
              type: "section",
              id: sectionId,
              public: { sectionJwId: section.jwId },
              column: "sectionId",
            },
            {
              type: "teacher",
              id: teacherId,
              public: { teacherId },
              column: "teacherId",
            },
            {
              type: "homework",
              id: homework.id,
              public: { homeworkId: homework.id },
              column: "homeworkId",
            },
            {
              type: "section-teacher",
              id: relationship.id,
              public: { sectionTeacherId: relationship.id },
              column: "sectionTeacherId",
            },
            {
              type: "young-event",
              id: young.id,
              public: { youngId: young.youngId },
              column: "youngEventId",
            },
          ];
          return { sectionId, teacherId, targets };
        },
      );
      const context = await getBetterAuthInstance().$context;
      const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;

      // Preserve the actual REST adapters and their authentication/validation.
      // Each returned Response belongs to the nested request lifetime; callers
      // consume it and independently inspect DB state within an outer workflow.
      const postCommentRoute = (
        ...args: Parameters<typeof createCommentRequest>
      ) => protocolRuntime.request(() => createCommentRequest(...args));
      const patchCommentRoute = (
        ...args: Parameters<typeof updateCommentRequest>
      ) => protocolRuntime.request(() => updateCommentRequest(...args));
      function request(body: unknown, method = "POST") {
        return new Request(`${origin}/api/community/comments`, {
          method,
          headers: { cookie, origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      function read(params: Record<string, string | number>) {
        return protocolRuntime.request(() =>
          getCommentsRoute(
            new Request(
              `${origin}/api/community/comments?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`,
            ),
          ),
        );
      }
      async function create(
        target: Target,
        extra: Record<string, unknown> = {},
      ) {
        const response = await postCommentRoute(
          request({
            targetType: target.type,
            ...target.public,
            body: marker,
            ...extra,
          }),
        );
        const body = await response.json();
        expect(response.status, JSON.stringify(body)).toBe(201);
        return body.id as string;
      }
      return {
        db,
        marker,
        userId,
        sectionId,
        teacherId,
        targets,
        postCommentRoute,
        patchCommentRoute,
        request,
        read,
        create,
      };
    }),
);
