import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";

export type CatalogDetailCopy = {
  course: {
    basicInfo: string;
    category: string;
    code: string;
    level: string;
  };
  courseDetail: {
    basicInfoDescription: string;
    campus: string;
    capacity: string;
    classType: string;
    courseType: string;
    noSections: string;
    sectionCode: string;
    semester: string;
    teachers: string;
  };
  teacherDetail: {
    address: string;
    basicInfo: string;
    basicInfoDescription: string;
    courseName: string;
    credits: string;
    department: string;
    email: string;
    mobile: string;
    name: string;
    noDepartment: string;
    noSections: string;
    sectionCode: string;
    semester: string;
    telephone: string;
    title: string;
  };
};

export type CourseDetailSection = {
  campus?: CatalogNamed | null;
  code: string;
  jwId: number | string;
  limitCount?: number | null;
  semester?: { nameCn?: string | null } | null;
  stdCount?: number | null;
  teachers: CatalogNamed[];
};

export type CourseDetailCourse = {
  category?: CatalogNamed | null;
  classType?: CatalogNamed | null;
  code: string;
  educationLevel?: CatalogNamed | null;
  sections: CourseDetailSection[];
  type?: CatalogNamed | null;
};

export type TeacherDetailSection = {
  code: string;
  course: CatalogNamed;
  credits?: number | string | null;
  jwId: number | string;
  semester?: { nameCn?: string | null } | null;
};

export type TeacherDetailTeacher = {
  address?: string | null;
  department?: CatalogNamed | null;
  email?: string | null;
  mobile?: string | null;
  sections: TeacherDetailSection[];
  teacherTitle?: CatalogNamed | null;
  telephone?: string | null;
};
