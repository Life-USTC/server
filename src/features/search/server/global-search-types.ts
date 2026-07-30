export type GlobalSearchResultItem = {
  description: string | null;
  href: string;
  id: string;
  title: string;
};

export type GlobalSearchResultGroup = {
  items: GlobalSearchResultItem[];
  type: "courses" | "homeworks" | "sections" | "teachers" | "todos";
};

export type GlobalSearchResponse = {
  groups: GlobalSearchResultGroup[];
  query: string;
};
