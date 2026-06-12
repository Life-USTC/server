export type ParsedSectionSearchQuery = {
  teacher?: string;
  courseCode?: string;
  lectureCode?: string;
  campus?: string;
  credits?: string;
  department?: string;
  semester?: string;
  category?: string;
  level?: string;
  classType?: string;
  sort?: string;
  order?: "asc" | "desc";
  general?: string;
};

export type SectionSearchStringKey = Exclude<
  keyof ParsedSectionSearchQuery,
  "general" | "order"
>;

export type SectionSearchConditionKey = Exclude<
  keyof ParsedSectionSearchQuery,
  "general" | "sort" | "order"
>;
