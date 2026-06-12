import type {
  ParsedSectionSearchQuery,
  SectionSearchStringKey,
} from "@/lib/section-search-types";

const SECTION_SEARCH_FIELDS: Array<{
  key: SectionSearchStringKey;
  pattern: RegExp;
}> = [
  { key: "teacher", pattern: /teacher:(\S+)/i },
  { key: "courseCode", pattern: /coursecode:(\S+)/i },
  { key: "lectureCode", pattern: /(?:lecturecode|sectioncode):(\S+)/i },
  { key: "campus", pattern: /campus:(\S+)/i },
  { key: "credits", pattern: /credits?:(\S+)/i },
  { key: "department", pattern: /(?:department|dept):(\S+)/i },
  { key: "semester", pattern: /semester:(\S+)/i },
  { key: "category", pattern: /category:(\S+)/i },
  { key: "level", pattern: /(?:level|edulevel):(\S+)/i },
  { key: "classType", pattern: /(?:classtype|type):(\S+)/i },
  { key: "sort", pattern: /(?:sort|sortby):(\S+)/i },
];

const SECTION_SEARCH_TAG_PATTERN =
  /\b(?:teacher|coursecode|lecturecode|sectioncode|campus|credits?|department|dept|semester|category|level|edulevel|classtype|type|sort|sortby|order):\S+/gi;

export function parseSectionSearchQuery(
  search: string,
): ParsedSectionSearchQuery {
  const result: ParsedSectionSearchQuery = {};

  for (const field of SECTION_SEARCH_FIELDS) {
    const match = search.match(field.pattern);
    if (match) {
      result[field.key] = match[1];
    }
  }

  const orderMatch = search.match(/order:(asc|desc)/i);

  if (orderMatch) result.order = orderMatch[1].toLowerCase() as "asc" | "desc";

  const generalSearch = search.replace(SECTION_SEARCH_TAG_PATTERN, "").trim();

  if (generalSearch) result.general = generalSearch;

  return result;
}
