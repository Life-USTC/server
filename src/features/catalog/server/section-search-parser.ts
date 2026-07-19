import type {
  ParsedSectionSearchQuery,
  SectionSearchStringKey,
} from "@/features/catalog/server/section-search-types";

const SECTION_SEARCH_KEY_MAP: Record<string, SectionSearchStringKey | "order"> =
  {
    teacher: "teacher",
    coursecode: "courseCode",
    lecturecode: "lectureCode",
    sectioncode: "lectureCode",
    campus: "campus",
    credit: "credits",
    credits: "credits",
    department: "department",
    dept: "department",
    semester: "semester",
    category: "category",
    level: "level",
    edulevel: "level",
    classtype: "classType",
    type: "classType",
    sort: "sort",
    sortby: "sort",
    order: "order",
  };

const SECTION_SEARCH_TAG_PATTERN =
  /\b(teacher|coursecode|lecturecode|sectioncode|campus|credits?|department|dept|semester|category|level|edulevel|classtype|type|sort|sortby|order):(?:"([^"]+)"|'([^']+)'|(\S+))/gi;

export function parseSectionSearchQuery(
  search: string,
): ParsedSectionSearchQuery {
  const result: ParsedSectionSearchQuery = {};

  for (const match of search.matchAll(SECTION_SEARCH_TAG_PATTERN)) {
    const key = SECTION_SEARCH_KEY_MAP[match[1].toLowerCase()];
    const value = match[2] ?? match[3] ?? match[4];

    if (key === "order") {
      const normalizedOrder = value.toLowerCase();
      if (
        result.order === undefined &&
        (normalizedOrder === "asc" || normalizedOrder === "desc")
      ) {
        result.order = normalizedOrder;
      }
    } else if (result[key] === undefined) {
      result[key] = value;
    }
  }

  const generalSearch = search
    .replace(SECTION_SEARCH_TAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (generalSearch) result.general = generalSearch;

  return result;
}
