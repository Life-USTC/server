import type { RequestEvent } from "@sveltejs/kit";
import { expect, vi } from "vitest";
import { GET } from "@/routes/media/avatars/[userId]/[avatarId].webp/+server";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

const { getObject } = vi.hoisted(() => ({ getObject: vi.fn() }));
// The object transport is controlled; route validation and profile authorization
// execute against PostgreSQL using the restricted application role.
vi.mock("@/lib/storage/r2-object", () => ({
  getStorageObjectResponse: getObject,
  putStorageObject: vi.fn(),
  deleteStorageObject: vi.fn(),
}));
// The object spy belongs to this single-case isolated runner file. It does not
// provide isolation for concurrent cases sharing the same module environment.
it("user.avatar-current-reference", async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
}) => {
  await protocolRuntime.run(async () => {
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
      protocolRuntime.request(() =>
        GET({
          params: { userId: owner, avatarId: id },
        } as unknown as RequestEvent<
          { userId: string; avatarId: string },
          "/media/avatars/[userId]/[avatarId].webp"
        >),
      );
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
      const response = await read(owner);
      expect(response.status).toBe(404);
      await response.text();
      expect(getObject).not.toHaveBeenCalled();
    }
    for (const id of ["../private", "not-a-uuid"]) {
      getObject.mockClear();
      const response = await read(userId, id);
      expect(response.status).toBe(404);
      await response.text();
      expect(getObject).not.toHaveBeenCalled();
    }
    await db.user.update({
      where: { id: userId },
      data: { image: null, profilePictures: [] },
    });
    getObject.mockClear();
    const unreferenced = await read(userId);
    expect(unreferenced.status).toBe(404);
    await unreferenced.text();
    expect(getObject).not.toHaveBeenCalled();
    await db.user.update({ where: { id: userId }, data: { image: url } });
    getObject.mockResolvedValueOnce(null);
    const missingObject = await read(userId);
    expect(missingObject.status).toBe(404);
    await missingObject.text();
    await db.user.delete({ where: { id: userId } });
    getObject.mockClear();
    const deletedOwner = await read(userId);
    expect(deletedOwner.status).toBe(404);
    await deletedOwner.text();
    expect(getObject).not.toHaveBeenCalled();
  });
});
