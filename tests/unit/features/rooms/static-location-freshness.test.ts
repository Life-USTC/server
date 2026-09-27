import { expect, it, vi } from "vitest";

it("rendering-and-cache.static-location-freshness", async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  const start = new Date("2031-01-12T00:00:00Z").getTime();
  vi.setSystemTime(start);
  let revision = "before";
  let latitude = 31;
  const calls = new Map<string, number>();
  vi.stubGlobal("fetch", async (url: string) => {
    const file = new URL(url).pathname.split("/").at(-1) ?? "";
    calls.set(file, (calls.get(file) ?? 0) + 1);
    if (file === "room_maps.json")
      return Response.json({
        rooms: [
          {
            code: "3A204",
            building: "Teaching building",
            floor: "2",
            imagePath: `imgs/rooms/${revision}.png`,
            sourceImagePath: `imgs/${revision}.png`,
          },
        ],
      });
    if (file === "building_img_rules.json")
      return Response.json([
        { regex: "3A2\\d{2}", path: `./imgs/${revision}.png` },
      ]);
    if (file === "geo_data.json")
      return Response.json({
        locations: [{ name: "Teaching building", latitude, longitude: 117 }],
      });
    throw new Error(`Unexpected static asset ${url}`);
  });
  try {
    const { getRoomMap } = await import(
      "@/features/rooms/server/room-map-service"
    );
    const { getLocationGeo } = await import(
      "@/shared/lib/location/static-geo-data"
    );
    async function assertAssets(
      expectedRevision: string,
      expectedLatitude: number,
    ) {
      expect(await getRoomMap("3A204")).toMatchObject({
        status: "highlighted",
        imageUrl: expect.stringContaining(
          `/imgs/rooms/${expectedRevision}.png`,
        ),
      });
      expect(await getRoomMap("3A205")).toMatchObject({
        status: "overview",
        imageUrl: expect.stringContaining(`/imgs/${expectedRevision}.png`),
      });
      expect(await getLocationGeo("Teaching building")).toEqual({
        name: "Teaching building",
        latitude: expectedLatitude,
        longitude: 117,
      });
    }
    await assertAssets("before", 31);
    revision = "after";
    latitude = 32;
    vi.setSystemTime(start + 299_999);
    await assertAssets("before", 31);
    expect([...calls.values()]).toEqual([1, 1, 1]);
    vi.setSystemTime(start + 300_000);
    await assertAssets("after", 32);
    expect([...calls.values()]).toEqual([2, 2, 2]);
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  }
});
