export type GlobalSearchResultItem = {
  description: string | null;
  external?: boolean;
  href: string;
  id: string;
  title: string;
};

export type GlobalSearchResultGroupType =
  | "courses"
  | "homeworks"
  | "links"
  | "sections"
  | "teachers"
  | "todos";

export type GlobalSearchResultGroup = {
  items: GlobalSearchResultItem[];
  type: GlobalSearchResultGroupType;
};

export type GlobalSearchResponse = {
  groups: GlobalSearchResultGroup[];
  query: string;
};

export const GLOBAL_SEARCH_GROUP_ORDER: GlobalSearchResultGroupType[] = [
  "courses",
  "teachers",
  "sections",
  "links",
  "homeworks",
  "todos",
];
