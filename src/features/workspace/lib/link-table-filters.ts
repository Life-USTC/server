import {
  matchTableFilter,
  type TableFilterField,
  type TableFilterLabels,
} from "@/lib/table-filters";
import type {
  AnonymousLinkGroup,
  WorkspaceCopy,
} from "./workspace-controller-types";

export function linkTableFields(
  copy: WorkspaceCopy["linkHub"],
  labels: TableFilterLabels,
  signedIn: boolean,
) {
  const columns: TableFilterField[] = [
    { name: "title", label: copy.colName },
    { name: "description", label: copy.colDescription },
  ];
  const extras: TableFilterField[] = [
    {
      name: "group",
      label: copy.filterGroup,
      options: Object.entries(copy.groups).map(([value, label]) => ({
        value,
        label,
      })),
    },
    { name: "url", label: copy.filterUrl },
    ...(signedIn
      ? [
          {
            name: "isPinned",
            label: copy.filterPinned,
            options: [
              { value: "true", label: labels.yes },
              { value: "false", label: labels.no },
            ],
          },
          {
            name: "clickCount",
            label: copy.filterVisits,
            type: "number" as const,
            min: 0,
            step: 1,
          },
        ]
      : []),
  ];
  return { columns, extras };
}

export function filterLinkGroups(
  groups: AnonymousLinkGroup[],
  fields: TableFilterField[],
  values: Record<string, string>,
) {
  return groups
    .map((entry) => ({
      ...entry,
      links: entry.links.filter((link) =>
        fields.every((field) =>
          matchTableFilter(
            field.name === "isPinned"
              ? String(link.isPinned)
              : field.name === "clickCount"
                ? link.clickCount
                : (link[field.name] as string),
            field,
            values,
          ),
        ),
      ),
    }))
    .filter((entry) => entry.links.length > 0);
}
