import { afterAll, describe, expect, it } from "vitest";
import { authPostRoute } from "@/lib/api/routes/auth";
import { authPrisma } from "@/lib/db/auth-prisma";
import { createTestPrisma } from "../shared/prisma";

const authOrigin = "http://localhost:3000";
const encoder = new TextEncoder();
const createdUserIds: string[] = [];
const adminPrisma = createTestPrisma(
  process.env.FUNCTION_OWNER_DATABASE_URL ?? process.env.DATABASE_URL,
);

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

async function createSessionCookie(userId: string) {
  const token = crypto.randomUUID();
  await authPrisma.session.create({
    data: {
      expires: new Date(Date.now() + 60 * 60 * 1000),
      sessionToken: token,
      userId,
    },
  });
  const { getBetterAuthInstance } = await import("@/lib/auth/core");
  const context = await getBetterAuthInstance().$context;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(context.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(token),
  );
  const value = encodeURIComponent(
    `${token}.${base64(new Uint8Array(signature))}`,
  );
  return `${context.authCookies.sessionToken.name}=${value}`;
}

function updateUserRequest(cookie: string, body: Record<string, unknown>) {
  return authPostRoute(
    new Request(`${authOrigin}/api/auth/update-user`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: authOrigin,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe.sequential("Better Auth update-user field security", () => {
  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await adminPrisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await Promise.all([authPrisma.$disconnect(), adminPrisma.$disconnect()]);
  });

  it("rejects self-promotion while preserving legitimate profile updates", async () => {
    const marker = crypto.randomUUID();
    const usernameSuffix = marker.slice(0, 8);
    const originalPictures: string[] = [];
    const user = await authPrisma.user.create({
      data: {
        email: `better-auth-update-${marker}@example.test`,
        name: "Original Name",
      },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    const cookie = await createSessionCookie(user.id);

    const escalationResponse = await updateUserRequest(cookie, {
      isAdmin: true,
    });

    expect(escalationResponse.status).toBe(400);
    await expect(escalationResponse.json()).resolves.toMatchObject({
      message: "isAdmin is not allowed to be set",
    });
    await expect(
      authPrisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { isAdmin: true, profilePictures: true },
      }),
    ).resolves.toEqual({
      isAdmin: false,
      profilePictures: originalPictures,
    });

    const pictureInjectionResponse = await updateUserRequest(cookie, {
      profilePictures: ["https://attacker.example/avatar.svg"],
    });

    expect(pictureInjectionResponse.status).toBe(400);
    await expect(pictureInjectionResponse.json()).resolves.toMatchObject({
      message: "profilePictures is not allowed to be set",
    });
    await expect(
      authPrisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { profilePictures: true },
      }),
    ).resolves.toEqual({ profilePictures: originalPictures });

    const invalidUsernameResponse = await updateUserRequest(cookie, {
      username: "id",
    });

    expect(invalidUsernameResponse.status).toBe(400);
    await expect(invalidUsernameResponse.json()).resolves.toMatchObject({
      message: "Invalid username",
    });

    const updatedName = "Updated Name";
    const updatedUsername = `after-${usernameSuffix}`;
    const profileResponse = await updateUserRequest(cookie, {
      name: updatedName,
      username: updatedUsername,
    });

    expect(profileResponse.status).toBe(200);
    await expect(
      authPrisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { isAdmin: true, name: true, username: true },
      }),
    ).resolves.toEqual({
      isAdmin: false,
      name: updatedName,
      username: updatedUsername,
    });
  });
});
