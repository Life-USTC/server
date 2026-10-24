import type { AppPageCopy } from "@/lib/shell/page-copy";
import { type TableFilterField, tableFilterValues } from "@/lib/table-filters";

export const youngEventNumberFields = ["capacity", "appliedCount"] as const;
export const youngEventDateFields = ["startAt"] as const;
export const youngEventChoiceFields = [
  "category",
  "module",
  "activityLevel",
  "organizerId",
  "active",
] as const;
export const youngOrganizerNumberFields = [
  "activeCount",
  "upcomingCount",
  "historyCount",
] as const;

export function youngEventTableFields(
  copy: AppPageCopy,
  categories: string[],
  organizers: { id: string; name: string }[],
  timeBasis?: string,
  selectedCategories?: string,
): TableFilterField[] {
  const c = copy.youngEvents;
  const choices = (values: string[]) =>
    values.map((value) => ({ value, label: value }));
  return [
    { name: "search", label: c.eventName },
    { name: "startAt", label: c.eventTime, type: "date" },
    { name: "location", label: c.location },
    { name: "capacity", label: c.capacity, type: "number", min: 0, step: 1 },
    {
      name: "appliedCount",
      label: c.appliedCount,
      type: "number",
      min: 0,
      step: 1,
    },
    { name: "status", label: c.status },
    {
      name: "category",
      label: c.category,
      options: [
        ...new Set([
          ...categories,
          ...tableFilterValues(selectedCategories).map(decodeURIComponent),
        ]),
      ].map((value) => ({ value: encodeURIComponent(value), label: value })),
    },
    {
      name: "module",
      label: c.module,
      options: choices(["德", "智", "体", "美", "劳"]),
    },
    {
      name: "activityLevel",
      label: c.activityLevel,
      options: choices(["班级", "院级", "校级", "省级", "国家级"]),
    },
    {
      name: "organizerId",
      label: c.organizer,
      options: organizers.map((o) => ({ value: o.id, label: o.name })),
    },
    {
      name: "active",
      label: c.signupStatus,
      options: [
        { value: "true", label: c.statusActive },
        { value: "false", label: c.statusEnded },
      ],
    },
    {
      name: "timeBasis",
      label: c.timeBasis,
      options: [
        { value: "activity", label: c.eventTime },
        { value: "registration", label: c.signupWindow },
      ],
    },
    {
      name: "dateUnknown",
      label: c.unknownTime,
      options: [
        {
          value: "true",
          label:
            timeBasis === "registration"
              ? c.dateUnknownRegistration
              : timeBasis === "activity"
                ? c.dateUnknownActivity
                : c.dateUnknownAny,
        },
        {
          value: "false",
          label:
            timeBasis === "registration"
              ? c.dateKnownRegistration
              : timeBasis === "activity"
                ? c.dateKnownActivity
                : c.dateKnownAny,
        },
      ],
    },
  ];
}

export function youngOrganizerTableFields(
  copy: AppPageCopy,
): TableFilterField[] {
  const c = copy.youngEvents;
  return [
    { name: "search", label: c.organizer },
    {
      name: "activeCount",
      label: c.activeEvents,
      type: "number",
      min: 0,
      step: 1,
    },
    {
      name: "upcomingCount",
      label: c.upcomingEvents,
      type: "number",
      min: 0,
      step: 1,
    },
    {
      name: "historyCount",
      label: c.historyEvents,
      type: "number",
      min: 0,
      step: 1,
    },
  ];
}
