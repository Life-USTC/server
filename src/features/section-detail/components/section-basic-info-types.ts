export type SectionLocalizedName = {
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export type SectionPrimaryName = (item?: SectionLocalizedName | null) => string;

export type SectionBasicInfoCopy = {
  adminClasses: string;
  basicInfo: string;
  basicInfoDescription: string;
  credits: string;
  department: string;
  examMode: string;
  moreDetails: string;
  otherSections: string;
  period: string;
  periodsPerWeek: string;
  remark: string;
  roomType: string;
  sameSemesterOtherTeachers: string;
  sameTeacherOtherSemesters: string;
  sectionCode: string;
  semester: string;
  teachLanguage: string;
  viewAllCourseSections: string;
};

export type SectionCommonInfoCopy = {
  undergraduateGraduate: string;
};

export type SectionRelatedSummary = {
  code: string;
  jwId: number | string;
  semester?: {
    nameCn?: string | null;
  } | null;
  teachers?: SectionLocalizedName[];
};

export type SectionBasicInfo = {
  actualPeriods?: number | null;
  adminClasses: SectionLocalizedName[];
  code: string;
  course: {
    jwId: number | string;
  };
  credits?: number | null;
  examMode?: SectionLocalizedName | null;
  graduateAndPostgraduate?: boolean | null;
  openDepartment?: SectionLocalizedName | null;
  period?: number | null;
  periodsPerWeek?: number | null;
  remark?: string | null;
  roomType?: SectionLocalizedName | null;
  sameSemesterOtherTeachers: SectionRelatedSummary[];
  sameTeacherOtherSemesters: SectionRelatedSummary[];
  semester?: {
    nameCn?: string | null;
  } | null;
  teachLanguage?: SectionLocalizedName | null;
  timesPerWeek?: number | null;
};

export type SectionTeachersLabel = (section: SectionRelatedSummary) => string;

export type SectionTeacherSummary = SectionLocalizedName & {
  department?: SectionLocalizedName | null;
  id: number | string;
};

export type SectionTeacherCopy = {
  noTeachersListed: string;
  teachers: string;
  teachersDescription: string;
};

export type SectionTeacherName = (teacher: SectionTeacherSummary) => string;
