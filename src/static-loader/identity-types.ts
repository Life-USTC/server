export type TeacherBuild = {
  jwId: number;
  personId?: number;
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
