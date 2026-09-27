import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, expect, it, vi } from "vitest";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { GET } from "@/routes/media/avatars/[userId]/[avatarId].webp/+server";
import { createFixturePrisma } from "../shared/prisma";

const { getObject } = vi.hoisted(() => ({ getObject: vi.fn() }));
// The object transport is controlled; route validation and profile authorization
// execute against PostgreSQL using the restricted application role.
vi.mock("@/lib/storage/r2-object", () => ({
  getStorageObjectResponse: getObject,
  putStorageObject: vi.fn(),
  deleteStorageObject: vi.fn(),
}));
const db = createFixturePrisma();
afterAll(async () => {
  await Promise.all([db.$disconnect(), runtimePrisma.$disconnect()]);
});

it("user.avatar-current-reference", async () => {
  const userId = crypto.randomUUID();
  const otherId = crypto.randomUUID();
  const avatarId = crypto.randomUUID();
  const url = `/media/avatars/${userId}/${avatarId}.webp`;
  await db.user.createMany({
    data: [
      { id: userId, email: `${userId}@avatar.test`, image: url },
      { id: otherId, email: `${otherId}@avatar.test` },
    ],
  });
  getObject.mockImplementation(
    async () =>
      new Response("controlled-image-bytes", {
        headers: { "Content-Type": "image/webp" },
      }),
  );
  const read = (owner: string, id: string = avatarId) =>
    GET({ params: { userId: owner, avatarId: id } } as unknown as RequestEvent<
      { userId: string; avatarId: string },
      "/media/avatars/[userId]/[avatarId].webp"
    >);
  try {
    for (const reference of ["current", "choice"] as const) {
      await db.user.update({
        where: { id: userId },
        data: {
          image: reference === "current" ? url : null,
          profilePictures: reference === "choice" ? [url] : [],
        },
      });
      getObject.mockClear();
      const response = await read(userId);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("controlled-image-bytes");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(getObject).toHaveBeenCalledExactlyOnceWith({
        key: `avatars/${userId}/${avatarId}.webp`,
        contentType: "image/webp",
        contentDisposition: 'inline; filename="avatar.webp"',
      });
    }
    for (const owner of [otherId, "missing-user"]) {
      getObject.mockClear();
      expect((await read(owner)).status).toBe(404);
      expect(getObject).not.toHaveBeenCalled();
    }
    for (const id of ["../private", "not-a-uuid"]) {
      getObject.mockClear();
      expect((await read(userId, id)).status).toBe(404);
      expect(getObject).not.toHaveBeenCalled();
    }
    await db.user.update({
      where: { id: userId },
      data: { image: null, profilePictures: [] },
    });
    getObject.mockClear();
    expect((await read(userId)).status).toBe(404);
    expect(getObject).not.toHaveBeenCalled();
    await db.user.update({ where: { id: userId }, data: { image: url } });
    getObject.mockResolvedValueOnce(null);
    expect((await read(userId)).status).toBe(404);
    await db.user.delete({ where: { id: userId } });
    getObject.mockClear();
    expect((await read(userId)).status).toBe(404);
    expect(getObject).not.toHaveBeenCalled();
  } finally {
    await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  }
});
