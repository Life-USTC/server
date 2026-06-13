import type {
  AdminClass,
  Campus,
  ClassType,
  Course,
  CourseCategory,
  CourseClassify,
  CourseGradation,
  CourseType,
  Department,
  EducationLevel,
  ExamMode,
  PrismaClient,
  Section,
  Teacher,
  TeachLanguage,
} from "../../src/generated/prisma-node/client";

interface CourseInterface {
  id: number;
  code: string;
  cn: string;
  en: string | null;
}

interface CourseTypeInterface {
  cn: string | null;
  en: string | null;
}

interface CourseGradationInterface {
  cn: string | null;
  en: string | null;
}

interface CourseCategoryInterface {
  cn: string | null;
  en: string | null;
}

interface CourseClassifyInterface {
  cn: string | null;
  en: string | null;
}

interface DepartmentInterface {
  college: boolean;
  code: string;
  cn: string;
  en: string | null;
}

interface CampusInterface {
  cn: string | null;
  en: string | null;
}

interface ExamModeInterface {
  cn: string | null;
  en: string | null;
}

interface TeachLanguageInterface {
  cn: string | null;
  en: string | null;
}

interface EducationInterface {
  cn: string | null;
  en: string | null;
}

interface ClassTypeInterface {
  cn: string | null;
  en: string | null;
}

interface TeacherInterface {
  cn: string | null;
  en: string | null;
  departmentCode: string;
}

interface AdminClassInterface {
  cn: string | null;
  en: string | null;
}

interface SectionInterface {
  id: number;
  code: string;
  period: number;
  periodsPerWeek: number;
  credits: number;
  dateTimePlaceText: string;
  dateTimePlacePersonText: {
    cn: string;
  };
  stdCount: number;
  limitCount: number;
  graduateAndPostgraduate: boolean;
  course: CourseInterface;
  courseType: CourseTypeInterface;
  courseGradation: CourseGradationInterface;
  courseCategory: CourseCategoryInterface;
  courseClassify: CourseClassifyInterface;
  openDepartment: DepartmentInterface;
  campus: CampusInterface;
  examMode: ExamModeInterface;
  teachLang: TeachLanguageInterface;
  education: EducationInterface;
  classType: ClassTypeInterface;
  teacherAssignmentList: TeacherInterface[];
  adminClasses: AdminClassInterface[];
}

export type SecitonDataInterface = SectionInterface[];

async function loadCourseType(
  data: CourseTypeInterface,
  prisma: PrismaClient,
): Promise<CourseType | null> {
  if (data.cn === null) {
    return null;
  }

  const courseType = await prisma.courseType.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return courseType;
}

async function loadCourseGradation(
  data: CourseGradationInterface,
  prisma: PrismaClient,
): Promise<CourseGradation | null> {
  if (data.cn === null) {
    return null;
  }

  const courseGradation = await prisma.courseGradation.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return courseGradation;
}

async function loadCourseCategory(
  data: CourseCategoryInterface,
  prisma: PrismaClient,
): Promise<CourseCategory | null> {
  if (data.cn === null) {
    return null;
  }

  const courseCategory = await prisma.courseCategory.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return courseCategory;
}

async function loadCourseClassify(
  data: CourseClassifyInterface,
  prisma: PrismaClient,
): Promise<CourseClassify | null> {
  if (data.cn === null) {
    return null;
  }

  const courseClassify = await prisma.courseClassify.upsert({
    where: { nameCn: data.cn || "" },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return courseClassify;
}

async function loadDepartment(
  data: DepartmentInterface,
  prisma: PrismaClient,
): Promise<Department> {
  const department = await prisma.department.upsert({
    where: { code: data.code },
    update: {
      code: data.code,
      nameCn: data.cn,
      nameEn: data.en,
      isCollege: data.college,
    },
    create: {
      code: data.code,
      nameCn: data.cn,
      nameEn: data.en,
      isCollege: data.college,
    },
  });
  return department;
}

async function loadOrCreateDepartmentByCode(
  code: string,
  prisma: PrismaClient,
): Promise<Department> {
  try {
    return await prisma.department.upsert({
      where: { code: code },
      update: {},
      create: {
        code: code,
        nameCn: `未知系别 ${code}`,
        nameEn: `Unknown Department ${code}`,
        isCollege: false,
      },
    });
  } catch (e: unknown) {
    const existing = await prisma.department.findUnique({
      where: { code: code },
    });
    if (existing) return existing;
    throw e;
  }
}

async function loadCampus(
  data: CampusInterface,
  prisma: PrismaClient,
): Promise<Campus | null> {
  if (data.cn === null) {
    return null;
  }
  const campus = await prisma.campus.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return campus;
}

async function loadExamMode(
  data: ExamModeInterface,
  prisma: PrismaClient,
): Promise<ExamMode | null> {
  if (data.cn === null) {
    return null;
  }
  const examMode = await prisma.examMode.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return examMode;
}

async function loadTeachLanguage(
  data: TeachLanguageInterface,
  prisma: PrismaClient,
): Promise<TeachLanguage | null> {
  if (data.cn === null) {
    return null;
  }
  const teachLanguage = await prisma.teachLanguage.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return teachLanguage;
}

async function loadEducationLevel(
  data: EducationInterface,
  prisma: PrismaClient,
): Promise<EducationLevel | null> {
  if (data.cn === null) {
    return null;
  }
  const educationLevel = await prisma.educationLevel.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return educationLevel;
}

async function loadClassType(
  data: ClassTypeInterface,
  prisma: PrismaClient,
): Promise<ClassType | null> {
  if (data.cn === null) {
    return null;
  }

  const classType = await prisma.classType.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return classType;
}

async function loadCourse(
  data: SectionInterface,
  prisma: PrismaClient,
): Promise<Course> {
  const course_category = await loadCourseCategory(data.courseCategory, prisma);
  const class_type = await loadClassType(data.classType, prisma);
  const course_classify = await loadCourseClassify(data.courseClassify, prisma);
  const education_level = await loadEducationLevel(data.education, prisma);
  const course_gradation = await loadCourseGradation(
    data.courseGradation,
    prisma,
  );
  const course_type = await loadCourseType(data.courseType, prisma);

  const course = await prisma.course.upsert({
    where: { jwId: data.course.id },
    update: {
      code: data.course.code,
      nameCn: data.course.cn,
      nameEn: data.course.en,
      categoryId: course_category?.id,
      classTypeId: class_type?.id,
      classifyId: course_classify?.id,
      educationLevelId: education_level?.id,
      gradationId: course_gradation?.id,
      typeId: course_type?.id,
    },
    create: {
      jwId: data.course.id,
      code: data.course.code,
      nameCn: data.course.cn,
      nameEn: data.course.en,
      categoryId: course_category?.id,
      classTypeId: class_type?.id,
      classifyId: course_classify?.id,
      educationLevelId: education_level?.id,
      gradationId: course_gradation?.id,
      typeId: course_type?.id,
    },
  });
  return course;
}

async function loadTeacher(
  data: TeacherInterface,
  prisma: PrismaClient,
): Promise<Teacher | null> {
  if (data.cn === null) {
    return null;
  }
  const department = await loadOrCreateDepartmentByCode(
    data.departmentCode,
    prisma,
  );

  const teacher = await prisma.teacher.upsert({
    where: {
      nameCn_departmentId: { nameCn: data.cn, departmentId: department.id },
    },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
      departmentId: department.id,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
      departmentId: department.id,
    },
  });
  return teacher;
}

async function loadAdminClass(
  data: AdminClassInterface,
  prisma: PrismaClient,
): Promise<AdminClass | null> {
  if (data.cn === null) {
    return null;
  }
  const adminClass = await prisma.adminClass.upsert({
    where: { nameCn: data.cn },
    update: {
      nameCn: data.cn,
      nameEn: data.en,
    },
    create: {
      nameCn: data.cn,
      nameEn: data.en,
    },
  });
  return adminClass;
}

export async function loadSections(
  data: SecitonDataInterface,
  prisma: PrismaClient,
  semesterId: number,
): Promise<Section[]> {
  const sections = [];

  for (const sectionJson of data) {
    const course = await loadCourse(sectionJson, prisma);
    const open_department = await loadDepartment(
      sectionJson.openDepartment,
      prisma,
    );
    const campus = await loadCampus(sectionJson.campus, prisma);
    const exam_mode = await loadExamMode(sectionJson.examMode, prisma);
    const teach_language = await loadTeachLanguage(
      sectionJson.teachLang,
      prisma,
    );
    const [teachers, adminClasses] = await Promise.all([
      Promise.all(
        sectionJson.teacherAssignmentList.map((teacherJson) =>
          loadTeacher(teacherJson, prisma),
        ),
      ),
      Promise.all(
        sectionJson.adminClasses.map((adminClassJson) =>
          loadAdminClass(adminClassJson, prisma),
        ),
      ),
    ]);

    const section = await prisma.section.upsert({
      where: { jwId: sectionJson.id },
      update: {
        code: sectionJson.code,
        credits: sectionJson.credits,
        period: sectionJson.period,
        periodsPerWeek: sectionJson.periodsPerWeek,
        stdCount: sectionJson.stdCount,
        limitCount: sectionJson.limitCount,
        graduateAndPostgraduate: sectionJson.graduateAndPostgraduate,
        dateTimePlaceText: sectionJson.dateTimePlaceText,
        dateTimePlacePersonText: sectionJson.dateTimePlacePersonText.cn,
        courseId: course.id,
        semesterId: semesterId,
        campusId: campus?.id,
        examModeId: exam_mode?.id,
        openDepartmentId: open_department.id,
        teachLanguageId: teach_language?.id,
        teachers: {
          set: teachers.map((t) => ({ id: t?.id })),
        },
        adminClasses: {
          set: adminClasses.map((ac) => ({ id: ac?.id })),
        },
      },
      create: {
        jwId: sectionJson.id,
        code: sectionJson.code,
        credits: sectionJson.credits,
        period: sectionJson.period,
        periodsPerWeek: sectionJson.periodsPerWeek,
        stdCount: sectionJson.stdCount,
        limitCount: sectionJson.limitCount,
        graduateAndPostgraduate: sectionJson.graduateAndPostgraduate,
        dateTimePlaceText: sectionJson.dateTimePlaceText,
        dateTimePlacePersonText: sectionJson.dateTimePlacePersonText.cn,
        courseId: course.id,
        semesterId: semesterId,
        campusId: campus?.id,
        examModeId: exam_mode?.id,
        openDepartmentId: open_department.id,
        teachLanguageId: teach_language?.id,
        teachers: {
          connect: teachers.map((t) => ({ id: t?.id })),
        },
        adminClasses: {
          connect: adminClasses.map((ac) => ({ id: ac?.id })),
        },
      },
    });
    sections.push(section);
  }

  return sections;
}
