import { beforeEach, expect, it, vi } from "vitest";

const { rooms, buildings } = vi.hoisted(() => ({
  rooms: vi.fn(),
  buildings: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ room: { findMany: rooms } }),
}));
vi.mock("@/features/rooms/server/room-map-service", () => ({
  listRoomMapBuildings: buildings,
}));

import { listRoomMapDirectory } from "@/features/rooms/server/room-map-directory";

beforeEach(() => {
  rooms.mockReset();
  buildings.mockReset();
  buildings.mockResolvedValue([
    {
      building: "三教主",
      floors: [{ floor: "2", codes: ["3A204", "3A205"] }],
      roomCount: 2,
    },
    {
      building: "五教",
      floors: [{ floor: "2", codes: ["5201"] }],
      roomCount: 1,
    },
  ]);
});
it("uses only matching catalog campus identities and localizes their labels", async () => {
  rooms.mockResolvedValue([
    {
      code: "3A204",
      nameCn: "3A204",
      building: { campus: { id: 1, nameCn: "西校区", nameEn: "West campus" } },
    },
  ]);
  const result = await listRoomMapDirectory("en-us");
  expect(result.map((building) => building.campus)).toEqual([
    "West campus",
    null,
  ]);
  expect(rooms).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        OR: [
          { code: { in: ["3A204", "3A205", "5201"] } },
          { nameCn: { in: ["3A204", "3A205", "5201"] } },
        ],
      },
    }),
  );
});
it("does not pick a campus when the same manifest building has conflicting or missing catalog associations", async () => {
  for (const second of [{ id: 2, nameCn: "东校区", nameEn: null }, null]) {
    rooms.mockResolvedValue([
      {
        code: "3A204",
        nameCn: "3A204",
        building: {
          campus: { id: 1, nameCn: "西校区", nameEn: "West campus" },
        },
      },
      { code: "3A205", nameCn: "3A205", building: { campus: second } },
    ]);
    expect((await listRoomMapDirectory("zh-cn"))[0].campus).toBeNull();
  }
});
it("does not query the catalog when the map manifest is absent", async () => {
  buildings.mockResolvedValue([]);
  expect(await listRoomMapDirectory("zh-cn")).toEqual([]);
  expect(rooms).not.toHaveBeenCalled();
});
