import { createServer, type Server } from "node:http";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma } from "@/lib/db/prisma";
import openapi from "../../public/openapi.generated.json";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const modules = import.meta.glob<Record<string, RequestHandler>>(
  "../../src/routes/api/**/+server.ts",
);
const routes = Object.entries(modules)
  .map(([file, load]) => {
    const path = file
      .replace("../../src/routes", "")
      .replace("/+server.ts", "");
    const names: string[] = [];
    const pattern = new RegExp(
      `^${path.replace(/\[([^\]]+)\]/g, (_, name: string) => {
        names.push(name);
        return "([^/]+)";
      })}$`,
    );
    return { path, names, pattern, load };
  })
  .sort((a, b) => a.names.length - b.names.length);
let origin: string;
let server: Server;
beforeAll(async () => {
  setCalendarExportRebuildSenderForTest(async () => {});
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      const url = new URL(request.url);
      const route = routes.find(({ pattern }) => pattern.test(url.pathname));
      if (!route) throw new Error("Unknown fixture route");
      const match = route.pattern.exec(url.pathname);
      if (!match) throw new Error("Route did not match");
      const params = Object.fromEntries(
        route.names.map((name, i) => [name, match[i + 1]]),
      );
      const handler = (await route.load())[request.method];
      await setResponse(
        outgoing,
        await handler({
          request,
          url,
          params,
          locals: { locale: "en-us" },
        } as unknown as RequestEvent),
      );
    } catch (error) {
      outgoing.statusCode = 500;
      outgoing.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  setCalendarExportRebuildSenderForTest();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await Promise.all([
    db.$disconnect(),
    authPrisma.$disconnect(),
    prisma.$disconnect(),
  ]);
});

it("openapi.state-setting-status", async () => {
  const marker = crypto.randomUUID();
  const user = await db.user.create({
    data: { email: `${marker}@state-setting.test` },
  });
  const seed = await db.section.findFirstOrThrow({
    where: { retiredAt: null, semesterId: { not: null } },
  });
  const section = await db.section.create({
    data: {
      jwId: 1_400_000_000 + Math.floor(Math.random() * 100_000_000),
      code: `STATE.${marker.slice(0, 8)}`,
      courseId: seed.courseId,
      semesterId: seed.semesterId,
    },
  });
  const homework = await db.homework.create({
    data: { sectionId: section.id, title: marker, createdById: user.id },
  });
  const comment = await db.comment.create({
    data: { sectionId: section.id, body: marker, userId: user.id },
  });
  const organizer = await db.youngOrganizer.create({
    data: { name: marker, normalizedName: marker },
  });
  const event = await db.youngEvent.create({
    data: {
      youngId: marker,
      name: marker,
      organizerId: organizer.id,
      isActive: true,
      rawJson: {},
    },
  });
  const notification = await db.youngNotification.create({
    data: {
      userId: user.id,
      kind: "event",
      title: marker,
      body: marker,
      dedupeKey: marker,
    },
  });
  const todo = await db.todo.create({
    data: { userId: user.id, title: marker },
  });
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId: user.id,
      sessionToken: token,
      expires: new Date(Date.now() + 3600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
  const slug = USTC_CATALOG_LINKS[0].slug;
  const cases = [
    {
      path: "/api/community/descriptions",
      body: {
        targetType: "section",
        sectionJwId: section.jwId,
        content: "State setting description",
      },
      count: () => db.description.count({ where: { sectionId: section.id } }),
    },
    {
      path: "/api/workspace/bus-preferences",
      body: { showDepartedTrips: true },
      count: () =>
        db.busUserPreference.count({
          where: { userId: user.id, showDepartedTrips: true },
        }),
    },
    {
      path: "/api/workspace/link-pins",
      form: true,
      body: { slug, action: "pin", returnTo: "/" },
      count: () =>
        db.workspaceLinkPin.count({ where: { userId: user.id, slug } }),
    },
    {
      path: "/api/workspace/link-pins/batch",
      body: { items: [{ slug, action: "pin" }] },
      count: () =>
        db.workspaceLinkPin.count({ where: { userId: user.id, slug } }),
    },
    {
      path: "/api/workspace/subscriptions",
      method: "PATCH",
      body: { sectionIds: [section.id] },
      count: () =>
        db.userSectionSubscription.count({
          where: { userId: user.id, sectionId: section.id },
        }),
    },
    {
      path: "/api/workspace/subscriptions/batch",
      body: {
        sectionIds: [section.id],
        action: "add",
        semesterId: section.semesterId,
      },
      count: () =>
        db.userSectionSubscription.count({
          where: { userId: user.id, sectionId: section.id },
        }),
    },
    {
      path: "/api/workspace/subscriptions/import-codes",
      body: { codes: [section.code], semesterId: section.semesterId },
      count: () =>
        db.userSectionSubscription.count({
          where: { userId: user.id, sectionId: section.id },
        }),
    },
    {
      path: `/api/workspace/subscriptions/${section.jwId}`,
      declared: "/api/workspace/subscriptions/{jwId}",
      method: "PATCH",
      body: { kind: "regular" },
      count: () =>
        db.userSectionSubscription.count({
          where: { userId: user.id, sectionId: section.id, kind: "regular" },
        }),
    },
    {
      path: `/api/community/comments/${comment.id}/reactions`,
      declared: "/api/community/comments/{id}/reactions",
      body: { type: "heart" },
      count: () =>
        db.commentReaction.count({
          where: { userId: user.id, commentId: comment.id, type: "heart" },
        }),
    },
    {
      path: `/api/workspace/homeworks/${homework.id}/completion`,
      declared: "/api/workspace/homeworks/{id}/completion",
      method: "PUT",
      body: { completed: true },
      count: () =>
        db.homeworkCompletion.count({
          where: { userId: user.id, homeworkId: homework.id },
        }),
    },
    {
      path: "/api/workspace/homeworks/completions",
      method: "PUT",
      body: { items: [{ homeworkId: homework.id, completed: true }] },
      count: () =>
        db.homeworkCompletion.count({
          where: { userId: user.id, homeworkId: homework.id },
        }),
    },
    {
      path: `/api/workspace/todos/${todo.id}`,
      declared: "/api/workspace/todos/{id}",
      method: "PATCH",
      body: { completed: true },
      count: () =>
        db.todo.count({
          where: { userId: user.id, id: todo.id, completed: true },
        }),
    },
    {
      path: "/api/workspace/todos/batch",
      method: "PATCH",
      body: { items: [{ todoId: todo.id, completed: true }] },
      count: () =>
        db.todo.count({
          where: { userId: user.id, id: todo.id, completed: true },
        }),
    },
    {
      path: `/api/workspace/young-event-subscriptions/${event.youngId}`,
      declared: "/api/workspace/young-event-subscriptions/{youngId}",
      method: "PUT",
      body: { subscribed: true },
      count: () =>
        db.userYoungEventSubscription.count({
          where: { userId: user.id, youngId: event.youngId },
        }),
    },
    {
      path: `/api/workspace/young-organizer-subscriptions/${organizer.id}`,
      declared: "/api/workspace/young-organizer-subscriptions/{organizerId}",
      method: "PUT",
      body: { subscribed: true },
      count: () =>
        db.userYoungOrganizerSubscription.count({
          where: { userId: user.id, organizerId: organizer.id },
        }),
    },
    {
      path: `/api/workspace/young-notifications/${notification.id}/read`,
      declared: "/api/workspace/young-notifications/{id}/read",
      body: {},
      count: () =>
        db.youngNotification.count({
          where: {
            userId: user.id,
            id: notification.id,
            readAt: { not: null },
          },
        }),
    },
  ];
  try {
    for (const item of cases) {
      const method = item.method ?? "POST";
      const path = item.declared ?? item.path;
      const operation = (
        openapi.paths as Record<
          string,
          Record<string, { responses: Record<string, unknown> }>
        >
      )[path][method.toLowerCase()];
      expect(operation.responses, path).toHaveProperty("200");
      expect(operation.responses, path).not.toHaveProperty("201");
      for (const repeat of [0, 1]) {
        const response = await fetch(`${origin}${item.path}`, {
          method,
          headers: {
            cookie,
            origin,
            accept: "application/json",
            "content-type": item.form
              ? "application/x-www-form-urlencoded"
              : "application/json",
          },
          body: item.form
            ? new URLSearchParams(
                Object.entries(item.body).map(([key, value]) => [
                  key,
                  String(value),
                ]),
              )
            : JSON.stringify(item.body),
          redirect: "manual",
        });
        const body = await response.text();
        expect(
          response.status,
          `${method} ${path} attempt${repeat}: ${body}`,
        ).toBe(200);
        expect(await item.count(), path).toBe(1);
      }
    }
  } finally {
    await db.auditLog.deleteMany({ where: { userId: user.id } });
    await db.section.delete({ where: { id: section.id } });
    await db.userYoungEventSubscription.deleteMany({
      where: { userId: user.id },
    });
    await db.userYoungOrganizerSubscription.deleteMany({
      where: { userId: user.id },
    });
    await db.youngEvent.delete({ where: { id: event.id } });
    await db.youngOrganizer.delete({ where: { id: organizer.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
