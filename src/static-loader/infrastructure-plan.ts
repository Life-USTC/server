import { selectLatestAdminClasses } from "./admin-class-selection";
import { type CampusOccurrence, selectCampuses } from "./campus-selection";
import {
  type AdminClassBuild,
  type BuildingBuild,
  firstChild,
  mapAdminClass,
  mapBuilding,
  mapCampus,
  mapCampusFromSection,
  mapRoom,
  mapRoomType,
  type RoomBuild,
  type RoomTypeBuild,
} from "./mappers";
import type { Snapshot } from "./snapshot";
import { asInt, type SnapshotRow } from "./snapshot-values";

export function loadScheduleInfrastructure(snapshot: Snapshot) {
  const roomsByJwId = new Map<number, RoomBuild>();
  const buildingsByJwId = new Map<number, BuildingBuild>();
  const roomTypesByJwId = new Map<number, RoomTypeBuild>();
  const campusOccurrences: CampusOccurrence[] = [];

  const buildings = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_scheduleList_room_building",
  );
  const campuses = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_scheduleList_room_building_campus",
  );
  const roomTypes = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_scheduleList_room_roomType",
  );
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_scheduleList_room",
  )) {
    const parentId = asInt(row.store_id);
    if (parentId == null) continue;
    const buildingRow = firstChild(buildings, parentId);
    const roomTypeRow = firstChild(roomTypes, parentId);
    const room = mapRoom(row, buildingRow, roomTypeRow);
    if (room == null || roomsByJwId.has(room.jwId)) continue;
    roomsByJwId.set(room.jwId, room);

    if (buildingRow != null) {
      const campusRow = firstChild(campuses, asInt(buildingRow.store_id) ?? -1);
      const campus = campusRow == null ? undefined : mapCampus(campusRow);
      if (campus != null) {
        campusOccurrences.push({
          campus,
          semesterCode: asInt(campusRow?.semester_id) ?? 0,
          source: "building",
        });
      }
      const building = mapBuilding(buildingRow, campusRow);
      if (building != null) buildingsByJwId.set(building.jwId, building);
    }
    if (roomTypeRow != null) {
      const roomType = mapRoomType(roomTypeRow);
      if (roomType != null) roomTypesByJwId.set(roomType.jwId, roomType);
    }
  }

  const scheduleLessonByJwId = new Map<number, SnapshotRow>();
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList",
  )) {
    const jwId = asInt(row.id);
    if (jwId != null) scheduleLessonByJwId.set(jwId, row);
  }
  const catalogCampuses = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_campus",
  );
  for (const lesson of snapshot.queryAll(
    "catalog_teach_lesson_list_for_teach",
  )) {
    const lessonJwId = asInt(lesson.id);
    const parentId = asInt(lesson.store_id);
    if (lessonJwId == null || parentId == null) continue;
    const campus = mapCampusFromSection(
      scheduleLessonByJwId.get(lessonJwId),
      firstChild(catalogCampuses, parentId),
    );
    if (campus != null) {
      campusOccurrences.push({
        campus,
        semesterCode: asInt(lesson.semester_id) ?? 0,
        source: "catalog",
      });
    }
  }

  const adminClassOccurrences: Array<{
    semesterCode: number;
    adminClass: AdminClassBuild;
  }> = [];
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList_adminclasses",
  )) {
    const adminClass = mapAdminClass(row);
    const semesterCode = asInt(row.semester_id);
    if (adminClass != null && semesterCode != null) {
      adminClassOccurrences.push({ semesterCode, adminClass });
    }
  }

  return {
    campuses: selectCampuses(campusOccurrences),
    roomTypes: [...roomTypesByJwId.values()],
    buildings: [...buildingsByJwId.values()],
    rooms: [...roomsByJwId.values()],
    adminClasses: selectLatestAdminClasses(adminClassOccurrences),
  };
}
