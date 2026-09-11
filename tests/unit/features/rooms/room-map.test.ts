import { afterEach, describe, expect, it, vi } from "vitest";
import {
  roomCodeSchema,
  roomMapManifestSchema,
} from "@/features/rooms/server/room-map-schema";
import {
  lookupRoomMap,
  type RoomMapAssets,
} from "@/features/rooms/server/room-map-service";

const assets: RoomMapAssets = {
  manifest: {
    rooms: [
      {
        code: "3A204",
        building: "第三教学楼",
        floor: "2",
        imagePath: "imgs/rooms/3A204.png",
        sourceImagePath: "imgs/三教主_02.png",
      },
    ],
  },
  rules: [{ regex: "3[AB]2\\d{2}", path: "./imgs/三教主_02.png" }],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("room map lookup", () => {
  it("normalizes case and full-width room codes and prefers exact annotations", () => {
    expect(lookupRoomMap(" ３ａ２０４ ", assets)).toMatchObject({
      code: "3A204",
      status: "highlighted",
      floor: "2",
      imageUrl: expect.stringContaining("/imgs/rooms/3A204.png"),
    });
  });
  it("does not treat a matching floor rule as a verified room", () => {
    expect(lookupRoomMap("3A299", assets)).toMatchObject({
      status: "overview",
      building: null,
      floor: null,
    });
    expect(lookupRoomMap("UNKNOWN", assets)).toMatchObject({
      status: "unavailable",
      imageUrl: null,
    });
  });
  it.each([
    "",
    "../3A204",
    "3A204/../../",
    "3A204\n3A205",
    "3A204,3A205",
    "A".repeat(65),
  ])("rejects invalid room input %s", (input) => {
    expect(roomCodeSchema.safeParse(input).success).toBe(false);
  });
  it("rejects annotation paths outside the static image directory", () => {
    const room = assets.manifest.rooms[0];
    expect(
      roomMapManifestSchema.safeParse({
        rooms: [{ ...room, imagePath: "imgs/../secret.png" }],
      }).success,
    ).toBe(false);
  });
  it("retries a missing manifest instead of retaining missing highlights", async () => {
    vi.resetModules();
    let requests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("building_img_rules.json"))
          return Response.json(assets.rules);
        requests += 1;
        return requests === 1
          ? new Response("missing", { status: 404 })
          : Response.json(assets.manifest);
      }),
    );
    const { getRoomMap } = await import(
      "@/features/rooms/server/room-map-service"
    );
    expect((await getRoomMap("3A204")).status).toBe("overview");
    expect((await getRoomMap("3A204")).status).toBe("highlighted");
    expect((await getRoomMap("3A204")).status).toBe("highlighted");
    expect(requests).toBe(2);
  });
});
