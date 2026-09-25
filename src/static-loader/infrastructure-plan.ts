import { selectLatestAdminClasses } from "./admin-class-selection";
import { selectCampuses } from "./campus-selection";
import {
  type AdminClassBuild,
  firstChild,
  mapAdminClass,
  mapBuilding,
  mapCampus,
  mapCampusFromSection,
  mapRoom,
  mapRoomType,
} from "./mappers";
import {
  type RoomOccurrence,
  selectLatestRoomInfrastructure,
} from "./room-selection";
import type { Snapshot } from "./snapshot";
import { asInt, type SnapshotRow } from "./snapshot-values";

export function loadScheduleInfrastructure(snapshot: Snapshot) {
  const roomOccurrences: RoomOccurrence[] = [];

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
    if (room == null) continue;
    const campusRow = firstChild(campuses, asInt(buildingRow?.store_id) ?? -1);
    roomOccurrences.push({
      semesterCode: asInt(row.semester_id) ?? 0,
      room,
      building:
        buildingRow == null ? undefined : mapBuilding(buildingRow, campusRow),
      campus: campusRow == null ? undefined : mapCampus(campusRow),
      roomType: roomTypeRow == null ? undefined : mapRoomType(roomTypeRow),
    });
  }
  const {
    rooms,
    buildings: selectedBuildings,
    roomTypes: selectedRoomTypes,
    campusOccurrences,
  } = selectLatestRoomInfrastructure(
    roomOccurrences,
    snapshot.queryAll("jw_room_types").map((row) => {
      const roomType = mapRoomType(row);
      const semesterCode = asInt(row.semester_id);
      if (roomType == null || semesterCode == null) {
        throw new Error(`Invalid supplemental RoomType jwId ${row.id}`);
      }
      return { semesterCode, roomType };
    }),
  );

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
    roomTypes: selectedRoomTypes,
    buildings: selectedBuildings,
    rooms,
    adminClasses: selectLatestAdminClasses(adminClassOccurrences),
  };
}
