import { describe, expect, it } from "vitest";
import {
  type RoomOccurrence,
  selectLatestRoomInfrastructure,
} from "@/static-loader/room-selection";

const old = {
  semesterCode: 201,
  room: {
    jwId: 1,
    nameCn: "101",
    nameEn: "Room 101",
    code: "101",
    seats: 60,
    seatsForSection: 50,
    virtual: false,
    remark: "旧备注",
    buildingJwId: 10,
    roomTypeJwId: 20,
  },
  building: { jwId: 10, nameCn: "旧教学楼", code: "B", campusJwId: 30 },
  campus: { jwId: 30, nameCn: "校区", code: "C" },
  roomType: { jwId: 20, nameCn: "旧类型", code: "T" },
} satisfies RoomOccurrence;

const latest: RoomOccurrence = {
  semesterCode: 421,
  room: {
    ...old.room,
    nameEn: undefined,
    remark: undefined,
    seats: 0,
    seatsForSection: 0,
    buildingJwId: 11,
    roomTypeJwId: 21,
  },
  building: { jwId: 11, nameCn: "新教学楼", code: "B2", campusJwId: 31 },
  campus: { jwId: 31, nameCn: "新校区", code: "C2" },
  roomType: { jwId: 21, nameCn: "新类型", code: "T2" },
};

describe("latest room infrastructure", () => {
  it("imports lesson-only types and selects the latest whole type across sources", () => {
    const types = [
      {
        semesterCode: 221,
        roomType: { jwId: 27, code: "LAB", nameCn: "实验室" },
      },
      {
        semesterCode: 421,
        roomType: { jwId: 20, code: "NEW", nameCn: "新类型" },
      },
    ];
    const selected = selectLatestRoomInfrastructure([old], types);
    expect(selected.roomTypes).toEqual([types[1].roomType, types[0].roomType]);
    expect(selected.rooms).toEqual([old.room]);
    expect(selectLatestRoomInfrastructure([old], types.toReversed())).toEqual(
      selected,
    );
    const older = [
      { semesterCode: 1, roomType: { ...old.roomType, nameCn: "更早类型" } },
    ];
    expect(selectLatestRoomInfrastructure([old], older).roomTypes).toEqual([
      old.roomType,
    ]);
  });

  it("selects the newest whole record regardless of input order", () => {
    const forward = selectLatestRoomInfrastructure([old, latest]);
    expect(selectLatestRoomInfrastructure([latest, old])).toEqual(forward);
    expect(forward.rooms).toEqual([latest.room]);
    expect(forward.rooms[0]).toMatchObject({
      nameEn: undefined,
      remark: undefined,
      seats: 0,
      seatsForSection: 0,
    });
    expect(forward.buildings).toContainEqual(latest.building);
    expect(forward.roomTypes).toContainEqual(latest.roomType);
    expect(forward.campusOccurrences).toContainEqual({
      semesterCode: 421,
      source: "building",
      campus: latest.campus,
    });
  });

  it("collects references still used by rooms only seen in an earlier semester", () => {
    const historicRoom = { ...old, room: { ...old.room, jwId: 2 } };
    const selected = selectLatestRoomInfrastructure([
      old,
      latest,
      historicRoom,
    ]);
    expect(selected.rooms).toEqual([latest.room, historicRoom.room]);
    expect(selected.buildings).toEqual([old.building, latest.building]);
    expect(selected.roomTypes).toEqual([old.roomType, latest.roomType]);
    expect(selected.campusOccurrences.map(({ campus }) => campus)).toEqual([
      old.campus,
      latest.campus,
    ]);
  });

  it("updates shared building and room type metadata independently of room iteration order", () => {
    const corrected: RoomOccurrence = {
      ...old,
      semesterCode: 401,
      building: { ...old.building, nameCn: "更正楼名", campusJwId: 31 },
      campus: latest.campus,
      roomType: { ...old.roomType, nameCn: "更正类型" },
    };
    // The newest room moved away, but the other room still uses this building.
    const anotherRoom = { ...old, room: { ...old.room, jwId: 2 } };
    const rows = [corrected, latest, anotherRoom, old];
    const selected = selectLatestRoomInfrastructure(rows);
    expect(selectLatestRoomInfrastructure(rows.toReversed())).toEqual(selected);
    expect(selected.buildings).toEqual([corrected.building, latest.building]);
    expect(selected.roomTypes).toEqual([corrected.roomType, latest.roomType]);
    expect(selected.campusOccurrences).not.toContainEqual(
      expect.objectContaining({ campus: old.campus }),
    );
  });

  it("keeps removed optional references empty and resolves same-semester ties deterministically", () => {
    const cleared: RoomOccurrence = {
      semesterCode: 421,
      room: {
        ...latest.room,
        buildingJwId: undefined,
        roomTypeJwId: undefined,
      },
    };
    expect(selectLatestRoomInfrastructure([old, cleared]).rooms).toEqual([
      cleared.room,
    ]);
    const corrected = {
      ...latest,
      room: { ...latest.room, remark: "更正备注" },
    };
    expect(selectLatestRoomInfrastructure([latest, corrected])).toEqual(
      selectLatestRoomInfrastructure([corrected, latest]),
    );
  });
});
