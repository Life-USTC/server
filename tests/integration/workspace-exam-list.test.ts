import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { listSubscribedExamPage } from "@/features/subscriptions/server/subscription-read-model";
import { getSubscribedExamsRoute } from "@/lib/api/routes/subscribed-exam-routes";
import { getMyCompactOverviewRoute } from "@/lib/api/routes/workspace-overview-route";
import {
  subscribedExamDtoSchema,
  subscribedExamsQuerySchema,
  subscribedExamsResponseSchema,
} from "@/lib/api/schemas/subscribed-exams-schemas";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import { serializeDatesDeep } from "@/lib/time/serialize-date-output";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const users = [crypto.randomUUID(), crypto.randomUUID()];
const sectionIds: number[] = [];
const semesterIds: number[] = [];
const examIds: number[] = [];
const clientId = `exam-bearer-${crypto.randomUUID()}`;
const grantIds: string[] = [];
const scopes = ["workspace.exam:read", "workspace.overview:read"];
const jwBase = -Math.floor(Math.random() * 100000000) - 100;

beforeAll(async () => {
  const source = await db.section.findFirstOrThrow({
    select: { courseId: true },
  });
  for (let i = 0; i < 2; i += 1) {
    const semester = await db.semester.create({
      data: {
        jwId: jwBase - i,
        code: `test-${crypto.randomUUID()}`,
        nameCn: `Semester ${i}`,
      },
    });
    semesterIds.push(semester.id);
  }
  await db.user.createMany({
    data: users.map((id) => ({
      id,
      email: `${id}@test.invalid`,
      name: "Exam list test",
    })),
  });
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Exam bearer test",
      scopes,
      redirectUris: ["https://exam-client.example/callback"],
    },
  });
  for (const userId of users) {
    const consent = await db.oAuthConsent.create({
      data: { clientId, userId, scopes },
      select: { grantId: true },
    });
    grantIds.push(consent.grantId);
  }
  for (let i = 0; i < 4; i += 1) {
    const section = await db.section.create({
      data: {
        courseId: source.courseId,
        semesterId: semesterIds[i % 2],
        jwId: jwBase - i,
        code: `[integration-test] exam-${crypto.randomUUID()}`,
        retiredAt: i === 3 ? new Date("2026-09-01T00:00:00Z") : null,
      },
    });
    sectionIds.push(section.id);
    await db.userSectionSubscription.create({
      data: { sectionId: section.id, userId: users[i === 2 ? 1 : 0] },
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const exam = await db.exam.create({
      data: {
        jwId: jwBase - i,
        sectionId: sectionIds[i === 5 ? 3 : Math.floor(i / 2)],
        examDate: i === 3 ? null : new Date(`2026-09-${14 + i}T00:00:00Z`),
        startTime: 900,
        endTime: 1100,
      },
    });
    examIds.push(exam.id);
  }
});
afterAll(async () => {
  await db.oAuthConsent.deleteMany({ where: { clientId } });
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.section.deleteMany({ where: { id: { in: sectionIds } } });
  await db.semester.deleteMany({ where: { id: { in: semesterIds } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await Promise.all([
    db.$disconnect(),
    runtimePrisma.$disconnect(),
    authPrisma.$disconnect(),
  ]);
});

async function signedRequest(
  userIndex: number,
  scope: string,
  audience = getOAuthRestAudienceUrls()[0],
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    clientId,
    userId: users[userIndex],
    grantId: grantIds[userIndex],
    scopes: [scope],
    resources: [audience],
    issuedAt,
    expiresAt: issuedAt + 300,
  });
  if (!token) throw new Error("Expected a signed resource-bound token");
  return new Request("https://example.test/api/workspace/exams", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function read(userId: string, input: Record<string, string> = {}) {
  const { page, pageSize, locale, ...filters } =
    subscribedExamsQuerySchema.parse(input);
  const result = await listSubscribedExamPage(userId, {
    ...filters,
    locale,
    pagination: { page, pageSize },
  });
  return subscribedExamsResponseSchema.parse({
    ...result,
    data: result.data.map((exam) =>
      subscribedExamDtoSchema.parse(serializeDatesDeep(exam)),
    ),
  });
}

describe("complete subscribed exam pages", () => {
  it("excludes retired sections while preserving the owner's subscription relationship", async () => {
    expect(
      await db.userSectionSubscription.findUnique({
        where: {
          userId_sectionId: { userId: users[0], sectionId: sectionIds[3] },
        },
      }),
    ).not.toBeNull();
    const result = await read(users[0]);
    expect(result.pagination.total).toBe(4);
    expect(result.data.map((exam) => exam.id)).not.toContain(examIds[5]);
  });

  it("accepts real signed exam-read tokens and returns only their subject's subscribed exams", async () => {
    for (const userIndex of [0, 1]) {
      const response = await getSubscribedExamsRoute(
        await signedRequest(userIndex, "workspace.exam:read"),
      );
      expect(response.status).toBe(200);
      const result = subscribedExamsResponseSchema.parse(await response.json());
      expect(result.data.map((exam) => exam.id)).toEqual(
        userIndex === 0 ? examIds.slice(0, 4) : [examIds[4]],
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });

  it("rejects an active, correctly signed overview-only token without returning exam data", async () => {
    const request = await signedRequest(0, "workspace.overview:read");
    // The same JWT succeeds on its authorized feature, proving the denial is
    // the exam scope boundary rather than a broken signer or consent fixture.
    expect(
      (
        await getMyCompactOverviewRoute(
          new Request("https://example.test/api/workspace/overview", {
            headers: request.headers,
          }),
        )
      ).status,
    ).toBe(200);
    const response = await getSubscribedExamsRoute(request);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects a correctly signed exam-read token issued for GraphQL without returning data", async () => {
    const response = await getSubscribedExamsRoute(
      await signedRequest(
        0,
        "workspace.exam:read",
        getOAuthGraphqlResourceUrl(),
      ),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns four owned exams across real pages with semester context and unknown dates", async () => {
    const first = await read(users[0], { pageSize: "2" });
    const second = await read(users[0], { page: "2", pageSize: "2" });
    expect(first.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    expect(second.pagination).toEqual({
      page: 2,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    expect([...first.data, ...second.data].map((exam) => exam.id)).toEqual(
      examIds.slice(0, 4),
    );
    expect(second.data[1].examDate).toBeNull();
    expect(second.data[1].section.semester?.nameCn).toBe("Semester 1");
    expect((await read(users[1])).data.map((exam) => exam.id)).toEqual([
      examIds[4],
    ]);
    expect((await read(users[0], { page: "3", pageSize: "2" })).data).toEqual(
      [],
    );
  });
  it("filters normalized Shanghai dates and semester before counting and paging", async () => {
    const filtered = await read(users[0], {
      dateFrom: "2026-09-14T20:00:00Z",
      dateTo: "2026-09-15",
      includeDateUnknown: "false",
    });
    expect(filtered.data.map((exam) => exam.id)).toEqual([examIds[1]]);
    const unknownIncluded = await read(users[0], {
      dateFrom: "2026-09-15",
      dateTo: "2026-09-15",
    });
    expect(unknownIncluded.data.map((exam) => exam.id)).toEqual([
      examIds[1],
      examIds[3],
    ]);
    const semester = await read(users[0], {
      semesterId: String(semesterIds[1]),
      pageSize: "1",
    });
    expect(semester.pagination.total).toBe(2);
    expect(semester.data[0].id).toBe(examIds[2]);
  });
});
