type LocalizedName = {
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export type WelcomeMatchedSection = {
  id: number;
  code: string;
  course: LocalizedName;
  semester?: LocalizedName | null;
  campus?: LocalizedName | null;
  teachers: LocalizedName[];
};
