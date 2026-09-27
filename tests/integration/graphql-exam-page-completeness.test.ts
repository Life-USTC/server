import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
afterAll(async () => {
  await Promise.all([
    db.$disconnect(),
    authPrisma.$disconnect(),
    runtimePrisma.$disconnect(),
  ]);
});

it("exam.graphql-page-completeness", async () => {
  const nonce = crypto.randomUUID();
  const userId = `exam-graphql-${nonce}`;
  const clientId = `exam-graphql-client-${nonce}`;
  const resource = getOAuthGraphqlResourceUrl();
  const scopes = ["workspace.exam:read"];
  const serial = Math.floor(Math.random() * 100_000_000) + 1_500_000_000;
  const course = await db.course.findFirstOrThrow({ select: { id: true } });
  const semesterIds: number[] = [];
  const sectionIds: number[] = [];
  const expected: {
    jwId: number;
    examDate: string | null;
    semesterName: string;
  }[] = [];
  try {
    await db.user.create({
      data: { id: userId, email: `${userId}@example.test` },
    });
    for (let index = 0; index < 2; index++) {
      const semester = await db.semester.create({
        data: {
          jwId: serial + index,
          nameCn: `GraphQL term ${index}`,
          code: `${nonce}-${index}`,
        },
      });
      semesterIds.push(semester.id);
    }
    for (let index = 0; index < 4; index++) {
      const section = await db.section.create({
        data: {
          jwId: serial + index,
          code: `${nonce}-${index}`,
          courseId: course.id,
          semesterId: semesterIds[index % 2],
          retiredAt: index === 2 ? new Date() : null,
        },
      });
      sectionIds.push(section.id);
      if (index !== 3)
        await db.userSectionSubscription.create({
          data: { userId, sectionId: section.id },
        });
      for (const [offset, date] of ["2000-01-01", null].entries()) {
        const jwId = serial + index * 2 + offset;
        await db.exam.create({
          data: {
            jwId,
            sectionId: section.id,
            examDate: date ? new Date(`${date}T00:00:00.000Z`) : null,
          },
        });
        if (index < 2)
          expected.push({
            jwId,
            examDate: date,
            semesterName: `GraphQL term ${index}`,
          });
      }
    }
    await db.oAuthClient.create({
      data: {
        clientId,
        name: "GraphQL exam completeness",
        redirectUris: ["https://example.test/callback"],
        consents: { create: { userId, scopes } },
      },
    });
    const consent = await db.oAuthConsent.findFirstOrThrow({
      where: { clientId, userId },
      select: { grantId: true },
    });
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = await signResourceBoundOAuthAccessToken({
      clientId,
      userId,
      grantId: consent.grantId,
      scopes,
      resources: [resource],
      issuedAt,
      expiresAt: issuedAt + 300,
    });
    expect(token).toBeTruthy();
    const handler = createGraphqlRequestHandler(false);
    type Exam = {
      jwId: number;
      examDate: string | null;
      section: { semester: { nameCn: string } };
    };
    const observed: Exam[] = [];
    for (let page = 1; page <= expected.length + 1; page++) {
      const response = await handler({
        request: new Request(resource, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query:
              "query Exams($page: PageInput!) { workspace { exams(page: $page) { items { jwId examDate section { semester { nameCn } } } pageInfo { page pageSize total totalPages } } } }",
            variables: { page: { page, pageSize: 1 } },
          }),
        }),
        locals: {
          authUser: null,
          locale: "en-us",
          requestId: "graphql-exam-page-completeness",
        },
      } as unknown as RequestEvent);
      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        errors?: unknown;
        data: { workspace: { exams: { items: Exam[]; pageInfo: unknown } } };
      };
      expect(result.errors).toBeUndefined();
      const exams = result.data.workspace.exams;
      expect(exams.pageInfo).toMatchObject({
        page,
        pageSize: 1,
        total: expected.length,
        totalPages: expected.length,
      });
      expect(exams.items).toHaveLength(page <= expected.length ? 1 : 0);
      observed.push(...exams.items);
    }
    expect(
      observed
        .map((item) => ({
          jwId: item.jwId,
          examDate: item.examDate,
          semesterName: item.section.semester.nameCn,
        }))
        .sort((a, b) => a.jwId - b.jwId),
    ).toEqual(expected.sort((a, b) => a.jwId - b.jwId));
    expect(new Set(observed.map((item) => item.jwId)).size).toBe(
      expected.length,
    );
  } finally {
    await db.oAuthClient.deleteMany({ where: { clientId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.section.deleteMany({ where: { id: { in: sectionIds } } });
    await db.semester.deleteMany({ where: { id: { in: semesterIds } } });
  }
});
