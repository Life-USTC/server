import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getSubscribedExamsRoute } from "@/lib/api/routes/subscribed-exam-routes";
import { subscribedExamsResponseSchema } from "@/lib/api/schemas/subscribed-exams-schemas";
import { getOAuthRestAudienceUrls } from "@/lib/mcp/urls";
import { nodeProtocolTest } from "./node-protocol-fixture";

// Each consumer has one native case per isolated runner file. The real Better
// Auth singleton and its JWT/JWKS state remain owned by that module environment;
// these cases do not claim concurrency safety in a shared module environment.
export const workspaceExamTest = nodeProtocolTest.extend(
  "exams",
  async ({ isolatedDatabase: { owner: db }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const { users, sectionIds, semesterIds, examIds, clientId, grantIds } =
        await db.$transaction(async (tx) => {
          const users: string[] = [crypto.randomUUID(), crypto.randomUUID()];
          const sectionIds: number[] = [];
          const semesterIds: number[] = [];
          const examIds: number[] = [];
          const clientId = `exam-bearer-${crypto.randomUUID()}`;
          const grantIds: string[] = [];
          const scopes = ["workspace.exam:read", "workspace.overview:read"];
          const course = await tx.course.create({
            data: { jwId: 1, code: "EXAM-LIST", nameCn: "Exam list course" },
          });
          for (let i = 0; i < 2; i += 1) {
            const semester = await tx.semester.create({
              data: {
                jwId: i + 1,
                code: `exam-semester-${i}`,
                nameCn: `Semester ${i}`,
              },
            });
            semesterIds.push(semester.id);
          }
          await tx.user.createMany({
            data: users.map((id) => ({
              id,
              email: `${id}@test.invalid`,
              name: "Exam list test",
            })),
          });
          await tx.oAuthClient.create({
            data: {
              clientId,
              name: "Exam bearer test",
              scopes,
              redirectUris: ["https://exam-client.example/callback"],
            },
          });
          for (const userId of users) {
            const consent = await tx.oAuthConsent.create({
              data: { clientId, userId, scopes },
              select: { grantId: true },
            });
            grantIds.push(consent.grantId);
          }
          for (let i = 0; i < 4; i += 1) {
            const section = await tx.section.create({
              data: {
                courseId: course.id,
                semesterId: semesterIds[i % 2],
                jwId: i + 1,
                code: `[integration-test] exam-${i}`,
                retiredAt: i === 3 ? new Date("2026-09-01T00:00:00Z") : null,
              },
            });
            sectionIds.push(section.id);
            await tx.userSectionSubscription.create({
              data: { sectionId: section.id, userId: users[i === 2 ? 1 : 0] },
            });
          }
          for (let i = 0; i < 6; i += 1) {
            const exam = await tx.exam.create({
              data: {
                jwId: i + 1,
                sectionId: sectionIds[i === 5 ? 3 : Math.floor(i / 2)],
                examDate:
                  i === 3 ? null : new Date(`2026-09-${14 + i}T00:00:00Z`),
                startTime: 900,
                endTime: 1100,
              },
            });
            examIds.push(exam.id);
          }
          return {
            users,
            sectionIds,
            semesterIds,
            examIds,
            clientId,
            grantIds,
          };
        });
      async function signedRequest(
        userIndex: number,
        scope: string,
        audience = getOAuthRestAudienceUrls()[0],
      ) {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await protocolRuntime.request(() =>
          signResourceBoundOAuthAccessToken({
            clientId,
            userId: users[userIndex],
            grantId: grantIds[userIndex],
            scopes: [scope],
            resources: [audience],
            issuedAt,
            expiresAt: issuedAt + 300,
          }),
        );
        if (!token) throw new Error("Expected a signed resource-bound token");
        return new Request("https://example.test/api/workspace/exams", {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      async function read(userId: string, input: Record<string, string> = {}) {
        const signed = await signedRequest(
          users.indexOf(userId),
          "workspace.exam:read",
        );
        const url = new URL(signed.url);
        url.search = new URLSearchParams(input).toString();
        const response = await protocolRuntime.request(() =>
          getSubscribedExamsRoute(
            new Request(url, { headers: signed.headers }),
          ),
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        return subscribedExamsResponseSchema.parse(await response.json());
      }

      return {
        db,
        users,
        sectionIds,
        semesterIds,
        examIds,
        signedRequest,
        read,
      };
    }),
);
