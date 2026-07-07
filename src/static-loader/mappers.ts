import {
  asBoolean,
  asDate,
  asFloat,
  asInt,
  asString,
  type SnapshotRow,
} from "./snapshot";

export type SemesterBuild = {
  jwId: number;
  nameCn: string;
  code: string;
  start?: Date;
  end?: Date;
};

export type DepartmentBuild = {
  code: string;
  nameCn: string;
  nameEn?: string;
  isCollege?: boolean;
};

export type LookupBuild = {
  nameCn: string;
  nameEn?: string;
};

export type CourseBuild = {
  jwId: number;
  code: string;
  nameCn: string;
  nameEn?: string;
  categoryName?: string;
  classTypeName?: string;
  classifyName?: string;
  educationLevelName?: string;
  gradationName?: string;
  typeName?: string;
};

export type TeacherBuild = {
  personId?: number;
  teacherId?: number;
  code?: string;
  nameCn: string;
  nameEn?: string;
  age?: number;
  email?: string;
  telephone?: string;
  mobile?: string;
  address?: string;
  postcode?: string;
  qq?: string;
  wechat?: string;
  departmentCode?: string;
  teacherTitleId?: number;
};

export type SectionBuild = {
  jwId: number;
  code: string;
  bizTypeId?: number;
  credits?: number;
  period?: number;
  periodsPerWeek?: number;
  timesPerWeek?: number;
  stdCount?: number;
  limitCount?: number;
  graduateAndPostgraduate?: boolean;
  dateTimePlaceText?: string;
  dateTimePlacePersonText?: string[];
  actualPeriods?: number;
  theoryPeriods?: number;
  practicePeriods?: number;
  experimentPeriods?: number;
  machinePeriods?: number;
  designPeriods?: number;
  testPeriods?: number;
  scheduleState?: string;
  suggestScheduleWeeks?: number[];
  suggestScheduleWeekInfo?: string;
  scheduleJsonParams?: unknown[];
  selectedStdCount?: number;
  remark?: string;
  scheduleRemark?: string;
  courseJwId: number;
  semesterCode: number;
  campusId?: number;
  examModeName?: string;
  openDepartmentCode?: string;
  teachLanguageName?: string;
  roomTypeId?: number;
};

export type ScheduleGroupBuild = {
  jwId: number;
  lessonJwId: number;
  no: number;
  limitCount: number;
  stdCount: number;
  actualPeriods: number;
  isDefault: boolean;
};

export type ScheduleBuild = {
  periods: number;
  date?: Date;
  dateStr?: string;
  weekday: number;
  startTime: number;
  endTime: number;
  experiment?: string;
  customPlace?: string;
  lessonType?: string;
  weekIndex: number;
  exerciseClass?: boolean;
  startUnit: number;
  endUnit: number;
  roomJwId?: number;
  lessonJwId: number;
  scheduleGroupJwId: number;
  teacherPersonIds: number[];
};

export type ExamBuild = {
  jwId: number;
  examType?: number;
  startTime?: number;
  endTime?: number;
  examDate?: Date;
  examTakeCount?: number;
  examMode?: string;
  examBatchName?: string;
  sectionJwId: number;
  rooms: { room: string; count: number }[];
};

export type RoomBuild = {
  jwId: number;
  nameCn: string;
  nameEn?: string;
  code: string;
  floor?: number;
  virtual: boolean;
  seatsForSection: number;
  remark?: string;
  seats: number;
  buildingJwId?: number;
  roomTypeJwId?: number;
};

export type BuildingBuild = {
  jwId: number;
  nameCn: string;
  nameEn?: string;
  code: string;
  campusJwId?: number;
};

export type CampusBuild = {
  jwId?: number;
  nameCn: string;
  nameEn?: string;
  code?: string;
};

export type RoomTypeBuild = {
  jwId: number;
  nameCn: string;
  nameEn?: string;
  code: string;
};

export type AdminClassBuild = {
  jwId: number;
  code?: string;
  grade?: string;
  nameCn: string;
  nameEn?: string;
  stdCount?: number;
  planCount?: number;
  enabled?: boolean;
  abbrZh?: string;
  abbrEn?: string;
};

export type TeacherTitleBuild = {
  jwId: number;
  nameCn: string;
  nameEn?: string;
  code: string;
  enabled?: boolean;
};

export type TeacherLessonTypeBuild = {
  jwId: number;
  nameCn: string;
  nameEn?: string;
  code: string;
  role?: string;
  enabled?: boolean;
};

export type ExamBatchBuild = {
  nameCn: string;
};

export type TeacherAssignmentBuild = {
  sectionJwId: number;
  personId?: number;
  teacherId?: number;
  code?: string;
  nameCn: string;
  departmentCode?: string;
  role?: string;
  period?: number;
  weekIndices?: number[];
  weekIndicesMsg?: string;
  teacherLessonTypeId?: number;
};

export type SectionTeacherPair = {
  sectionJwId: number;
  personId?: number;
  teacherId?: number;
  code?: string;
  nameCn: string;
  departmentCode?: string;
};

export type AdminClassSectionPair = {
  adminClassJwId: number;
  sectionJwId: number;
};

export type DepartmentPlaceholderRequest = {
  code: string;
  nameCn: string;
};

export function firstChild(
  map: Map<number, SnapshotRow[]>,
  parentId: number,
): SnapshotRow | undefined {
  return map.get(parentId)?.[0];
}

export function mapSemester(row: SnapshotRow): SemesterBuild | undefined {
  const jwId = asInt(row.id);
  const nameCn = asString(row.nameZh);
  const code = asString(row.code);
  if (jwId == null || !nameCn || !code) return undefined;
  return {
    jwId,
    nameCn,
    code,
    start: asDate(row.start),
    end: asDate(row.end),
  };
}

export function flattenDepartments(
  rows: SnapshotRow[],
  childrenRows: SnapshotRow[],
): DepartmentBuild[] {
  const childrenMap = new Map<number, SnapshotRow[]>();
  for (const row of childrenRows) {
    const parentId = asInt(row.parent_store_id);
    if (parentId == null) continue;
    const list = childrenMap.get(parentId) ?? [];
    list.push(row);
    childrenMap.set(parentId, list);
  }

  const result: DepartmentBuild[] = [];
  const seen = new Set<string>();

  function add(row: SnapshotRow) {
    const code = asString(row.code);
    const nameCn = asString(row.nameZh) ?? asString(row.name);
    if (!code || !nameCn) return;
    if (seen.has(code)) return;
    seen.add(code);
    result.push({
      code,
      nameCn,
      nameEn: asString(row.nameEn),
      isCollege: asBoolean(row.isCollege),
    });
    const parentStoreId = asInt(row.store_id);
    if (parentStoreId == null) return;
    for (const child of childrenMap.get(parentStoreId) ?? []) {
      add(child);
    }
  }

  for (const row of rows) {
    add(row);
  }
  return result;
}

export function mapLookup(
  row: SnapshotRow | undefined,
): LookupBuild | undefined {
  if (row == null) return undefined;
  const nameCn = asString(row.cn);
  if (!nameCn) return undefined;
  return { nameCn, nameEn: asString(row.en) };
}

export function mapCourse(
  _lessonRow: SnapshotRow,
  courseRow: SnapshotRow | undefined,
  lookups: {
    courseType?: SnapshotRow;
    courseCategory?: SnapshotRow;
    courseGradation?: SnapshotRow;
    courseClassify?: SnapshotRow;
    classType?: SnapshotRow;
    education?: SnapshotRow;
  },
): CourseBuild | undefined {
  const jwId = asInt(courseRow?.id);
  const nameCn = asString(courseRow?.cn);
  const code = asString(courseRow?.code) ?? "";
  if (jwId == null || !nameCn) return undefined;
  return {
    jwId,
    code,
    nameCn,
    nameEn: asString(courseRow?.en),
    typeName: mapLookup(lookups.courseType)?.nameCn,
    categoryName: mapLookup(lookups.courseCategory)?.nameCn,
    gradationName: mapLookup(lookups.courseGradation)?.nameCn,
    classifyName: mapLookup(lookups.courseClassify)?.nameCn,
    classTypeName: mapLookup(lookups.classType)?.nameCn,
    educationLevelName: mapLookup(lookups.education)?.nameCn,
  };
}

export function mapTeacherFromScheduleAssignment(
  row: SnapshotRow,
  contactRow: SnapshotRow | undefined,
  titleRow: SnapshotRow | undefined,
): TeacherBuild | undefined {
  const nameCn = asString(row.name);
  if (!nameCn) return undefined;
  return {
    personId: asInt(row.personId),
    teacherId: asInt(row.teacherId),
    code: asString(row.code),
    nameCn,
    age: asInt(row.age),
    email: asString(contactRow?.email),
    telephone: asString(contactRow?.telephone),
    mobile: asString(contactRow?.mobile),
    address: asString(contactRow?.address),
    postcode: asString(contactRow?.postcode),
    qq: asString(contactRow?.qq),
    wechat: asString(contactRow?.wechat),
    departmentCode: asString(row.departmentCode),
    teacherTitleId: asInt(titleRow?.id),
  };
}

export function mapTeacherFromCatalogAssignment(
  row: SnapshotRow,
): TeacherBuild | undefined {
  const nameCn = asString(row.cn);
  if (!nameCn) return undefined;
  return {
    nameCn,
    nameEn: asString(row.en),
    departmentCode: asString(row.departmentCode),
  };
}

export function mapSection(
  lessonRow: SnapshotRow,
  scheduleLesson: SnapshotRow | undefined,
  requiredInfo: SnapshotRow | undefined,
  suggestWeeks: SnapshotRow[] | undefined,
  jsonParams: SnapshotRow[] | undefined,
  dtpptRows: SnapshotRow[] | undefined,
  catalogLookups: {
    course?: SnapshotRow;
    examMode?: SnapshotRow;
    openDepartment?: SnapshotRow;
    teachLanguage?: SnapshotRow;
    campus?: SnapshotRow;
  },
): SectionBuild | undefined {
  const jwId = asInt(lessonRow.id);
  const code = asString(lessonRow.code);
  const courseJwId = asInt(catalogLookups.course?.id);
  const semesterCode = asInt(lessonRow.semester_id);
  if (jwId == null || !code || courseJwId == null || semesterCode == null) {
    return undefined;
  }

  const actualPeriods =
    asFloat(scheduleLesson?.actualPeriods) ??
    asFloat(requiredInfo?.total) ??
    asInt(lessonRow.period);

  return {
    jwId,
    code,
    bizTypeId: asInt(scheduleLesson?.bizTypeId),
    credits: asFloat(lessonRow.credits),
    period: asInt(lessonRow.period),
    periodsPerWeek:
      asFloat(lessonRow.periodsPerWeek) ??
      asFloat(requiredInfo?.periodsPerWeek),
    timesPerWeek: asInt(requiredInfo?.timesPerWeek),
    stdCount: scheduleLesson
      ? asInt(scheduleLesson.stdCount)
      : asInt(lessonRow.stdCount),
    limitCount: scheduleLesson
      ? asInt(scheduleLesson.limitCount)
      : asInt(lessonRow.limitCount),
    graduateAndPostgraduate: asBoolean(lessonRow.graduateAndPostgraduate),
    dateTimePlaceText: asString(lessonRow.dateTimePlaceText),
    dateTimePlacePersonText: dtpptRows
      ?.map((r) => asString(r.cn))
      .filter((s): s is string => s != null),
    actualPeriods,
    theoryPeriods: asFloat(requiredInfo?.theory),
    practicePeriods: asFloat(requiredInfo?.practice),
    experimentPeriods: asFloat(requiredInfo?.experiment),
    machinePeriods: asFloat(requiredInfo?.machine),
    designPeriods: asFloat(requiredInfo?.design),
    testPeriods: asFloat(requiredInfo?.test),
    scheduleState: scheduleLesson
      ? asString(scheduleLesson.scheduleState)
      : undefined,
    suggestScheduleWeeks: suggestWeeks
      ?.map((r) => asInt(r.value))
      .filter((v): v is number => v != null),
    suggestScheduleWeekInfo: scheduleLesson
      ? asString(scheduleLesson.suggestScheduleWeekInfo)
      : undefined,
    scheduleJsonParams: jsonParams?.length ? jsonParams : undefined,
    selectedStdCount: scheduleLesson
      ? asInt(scheduleLesson.selectedStdCount)
      : undefined,
    remark: scheduleLesson ? asString(scheduleLesson.remark) : undefined,
    scheduleRemark: scheduleLesson
      ? asString(scheduleLesson.scheduleRemark)
      : undefined,
    courseJwId,
    semesterCode,
    campusId: scheduleLesson ? asInt(scheduleLesson.campusId) : undefined,
    examModeName: asString(catalogLookups.examMode?.cn),
    openDepartmentCode: asString(catalogLookups.openDepartment?.code),
    teachLanguageName: asString(catalogLookups.teachLanguage?.cn),
    roomTypeId: scheduleLesson ? asInt(scheduleLesson.roomTypeId) : undefined,
  };
}

export function mapScheduleGroup(
  row: SnapshotRow,
): ScheduleGroupBuild | undefined {
  const jwId = asInt(row.id);
  const lessonJwId = asInt(row.lessonId);
  if (jwId == null || lessonJwId == null) return undefined;
  return {
    jwId,
    lessonJwId,
    no: asInt(row.no) ?? 0,
    limitCount: asInt(row.limitCount) ?? 0,
    stdCount: asInt(row.stdCount) ?? 0,
    actualPeriods: asFloat(row.actualPeriods) ?? 0,
    isDefault: asBoolean(row.default) ?? false,
  };
}

export function scheduleKey(row: SnapshotRow): string {
  return [
    row.lessonId,
    row.scheduleGroupId,
    row.date,
    row.weekday,
    row.startTime,
    row.endTime,
    row.startUnit,
    row.endUnit,
    row.customPlace ?? "",
    row.weekIndex,
  ].join("|");
}

export function mergeSchedule(
  existing: ScheduleBuild,
  _row: SnapshotRow,
  personId?: number,
): ScheduleBuild {
  if (personId != null && !existing.teacherPersonIds.includes(personId)) {
    existing.teacherPersonIds.push(personId);
  }
  return existing;
}

export function mapSchedule(
  row: SnapshotRow,
  personId?: number,
): ScheduleBuild {
  return {
    periods: Math.round(asFloat(row.periods) ?? 0),
    date: asDate(row.date),
    dateStr: asString(row.date),
    weekday: asInt(row.weekday) ?? 0,
    startTime: asInt(row.startTime) ?? 0,
    endTime: asInt(row.endTime) ?? 0,
    experiment: row.experiment != null ? String(row.experiment) : undefined,
    customPlace: asString(row.customPlace),
    lessonType: asString(row.lessonType),
    weekIndex: asInt(row.weekIndex) ?? 0,
    exerciseClass: asBoolean(row.exerciseClass),
    startUnit: asInt(row.startUnit) ?? 0,
    endUnit: asInt(row.endUnit) ?? 0,
    roomJwId: asInt(row.roomId),
    lessonJwId: asInt(row.lessonId) ?? 0,
    scheduleGroupJwId: asInt(row.scheduleGroupId) ?? 0,
    teacherPersonIds: personId == null ? [] : [personId],
  };
}

export function mapRoom(
  row: SnapshotRow,
  buildingRow: SnapshotRow | undefined,
  roomTypeRow: SnapshotRow | undefined,
): RoomBuild | undefined {
  const jwId = asInt(row.id);
  const nameCn = asString(row.nameZh);
  const code = asString(row.code);
  if (jwId == null || !nameCn || !code) return undefined;
  return {
    jwId,
    nameCn,
    nameEn: asString(row.nameEn),
    code,
    floor: asInt(row.floor),
    virtual: asBoolean(row.virtual) ?? false,
    seatsForSection: asInt(row.seatsForLesson) ?? 0,
    remark: asString(row.remark),
    seats: asInt(row.seats) ?? 0,
    buildingJwId: asInt(buildingRow?.id),
    roomTypeJwId: asInt(roomTypeRow?.id),
  };
}

export function mapBuilding(
  row: SnapshotRow,
  campusRow: SnapshotRow | undefined,
): BuildingBuild | undefined {
  const jwId = asInt(row.id);
  const nameCn = asString(row.nameZh);
  const code = asString(row.code);
  if (jwId == null || !nameCn || !code) return undefined;
  return {
    jwId,
    nameCn,
    nameEn: asString(row.nameEn),
    code,
    campusJwId: asInt(campusRow?.id),
  };
}

export function mapCampus(row: SnapshotRow): CampusBuild | undefined {
  const nameCn = asString(row.nameZh);
  if (!nameCn) return undefined;
  return {
    jwId: asInt(row.id),
    nameCn,
    nameEn: asString(row.nameEn),
    code: asString(row.code),
  };
}

export function mapRoomType(row: SnapshotRow): RoomTypeBuild | undefined {
  const jwId = asInt(row.id);
  const nameCn = asString(row.nameZh);
  const code = asString(row.code);
  if (jwId == null || !nameCn || !code) return undefined;
  return { jwId, nameCn, nameEn: asString(row.nameEn), code };
}

export function mapAdminClass(row: SnapshotRow): AdminClassBuild | undefined {
  const jwId = asInt(row.id);
  const nameCn = asString(row.nameZh);
  if (jwId == null || !nameCn) return undefined;
  return {
    jwId,
    code: asString(row.code),
    grade: asString(row.grade),
    nameCn,
    nameEn: asString(row.nameEn),
    stdCount: asInt(row.stdCount),
    planCount: asInt(row.planCount),
    enabled: asBoolean(row.enabled),
    abbrZh: asString(row.abbrZh),
    abbrEn: asString(row.abbrEn),
  };
}

export function mapTeacherTitle(
  row: SnapshotRow,
): TeacherTitleBuild | undefined {
  const jwId = asInt(row.id);
  const nameCn = asString(row.nameZh);
  const code = asString(row.code);
  if (jwId == null || !nameCn || !code) return undefined;
  return {
    jwId,
    nameCn,
    nameEn: asString(row.nameEn),
    code,
    enabled: asBoolean(row.enabled),
  };
}

export function mapTeacherLessonType(
  row: SnapshotRow,
): TeacherLessonTypeBuild | undefined {
  const jwId = asInt(row.id);
  const nameCn = asString(row.nameZh);
  const code = asString(row.code);
  if (jwId == null || !nameCn || !code) return undefined;
  return {
    jwId,
    nameCn,
    nameEn: asString(row.nameEn),
    code,
    role: asString(row.role),
    enabled: asBoolean(row.enabled),
  };
}

export function mapExamBatch(row: SnapshotRow): ExamBatchBuild | undefined {
  const name = asString(row.name);
  if (!name) return undefined;
  return { nameCn: name };
}

export function mapExam(
  row: SnapshotRow,
  lessonRow: SnapshotRow | undefined,
  examBatchRow: SnapshotRow | undefined,
  roomRows: SnapshotRow[],
): ExamBuild | undefined {
  const jwId = asInt(row.id);
  const sectionJwId = asInt(lessonRow?.id);
  if (jwId == null || sectionJwId == null) return undefined;
  return {
    jwId,
    examType: asInt(row.examType),
    startTime: asInt(row.startTime),
    endTime: asInt(row.endTime),
    examDate: asDate(row.examDate),
    examTakeCount: asInt(row.examTakeCount),
    examMode: asString(row.examMode),
    examBatchName: asString(examBatchRow?.name),
    sectionJwId,
    rooms: roomRows
      .map((r) => ({
        room: asString(r.room) ?? "",
        count: asInt(r.count) ?? 0,
      }))
      .filter((r) => r.room !== ""),
  };
}

export function mapTeacherAssignment(
  sectionJwId: number,
  row: SnapshotRow,
  weekIndices: SnapshotRow[],
  teacherLessonTypeId?: number,
): TeacherAssignmentBuild | undefined {
  const nameCn = asString(row.name);
  if (!nameCn) return undefined;
  return {
    sectionJwId,
    personId: asInt(row.personId),
    teacherId: asInt(row.teacherId),
    code: asString(row.code),
    nameCn,
    departmentCode: asString(row.departmentCode),
    role: asString(row.role),
    period:
      asFloat(row.period) == null
        ? undefined
        : Math.round(asFloat(row.period) as number),
    weekIndices: weekIndices
      .map((r) => asInt(r.value))
      .filter((v): v is number => v != null),
    weekIndicesMsg: asString(row.weekIndicesMsg),
    teacherLessonTypeId,
  };
}

export function stablePlaceholderCode(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const suffix = Math.abs(hash).toString(36).slice(0, 12);
  return `static-${suffix}`;
}
