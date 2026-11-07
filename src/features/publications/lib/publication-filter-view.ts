import type { PublicationListFilters } from "../components/publication-component-types";
import { isPublicationSourceOrganizationLevel } from "./publication-source-levels";

export function publicationFilterValues(
  filters: PublicationListFilters,
): Record<string, string> {
  return {
    query: filters.query ?? "",
    type: filters.type ?? "",
    source: (filters.source ?? []).join(","),
    organizationLevel: (filters.organizationLevel ?? []).join(","),
    fold: filters.fold ? "1" : "",
  };
}
export function publicationFilterIds(value: string | undefined) {
  return (value ?? "").split(",").filter(Boolean);
}
export function publicationFilterLevels(value: string | undefined) {
  return publicationFilterIds(value).filter(
    isPublicationSourceOrganizationLevel,
  );
}
