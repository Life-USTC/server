import * as z from "zod";
import {
  youngEventChoiceFields,
  youngEventDateFields,
  youngEventNumberFields,
  youngOrganizerNumberFields,
} from "../lib/young-table-filters";

const text = z.string().trim().max(200).optional();
const choices = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) =>
      value.split(",").length <= 50 &&
      value.split(",").every((item) => item.length <= 100),
    "Too many filter choices",
  )
  .optional();
const number = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" || (/^\d+$/.test(value) && Number(value) <= 1_000_000_000),
    "Invalid count",
  )
  .optional();
const date = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().startsWith(value)),
    "Invalid date",
  )
  .optional();
const operator = z
  .enum(["", "eq", "ne", "gt", "gte", "lt", "lte", "between"])
  .optional();

function comparisons(names: readonly string[], value: typeof number) {
  return Object.fromEntries(
    names.flatMap((name) => [
      [name, value],
      [`${name}Op`, operator],
      [`${name}Max`, value],
    ]),
  );
}

const eventShape = {
  search: text,
  location: text,
  status: text,
  ...Object.fromEntries(youngEventChoiceFields.map((name) => [name, choices])),
  category: z
    .array(z.string().trim().max(100))
    .max(50)
    .refine(
      (values) => values.join(",").length <= 2000,
      "Too many filter choices",
    )
    .transform((values) =>
      values.filter(Boolean).map(encodeURIComponent).join(","),
    )
    .optional(),
  ...comparisons(youngEventNumberFields, number),
  ...comparisons(youngEventDateFields, date),
  timeBasis: z
    .enum([
      "",
      "activity",
      "registration",
      "activity,registration",
      "registration,activity",
    ])
    .optional(),
  dateUnknown: z
    .enum(["", "true", "false", "true,false", "false,true"])
    .optional(),
  active: z.enum(["", "true", "false", "true,false", "false,true"]).optional(),
};
const organizerShape = {
  search: text,
  ...comparisons(youngOrganizerNumberFields, number),
};

export function parseYoungTableFilters(
  params: URLSearchParams,
  kind: "events" | "organizers",
) {
  const shape = kind === "events" ? eventShape : organizerShape;
  const input = Object.fromEntries(
    Object.keys(shape).flatMap((name) => {
      const values = params.getAll(name);
      return values.length
        ? [[name, name === "category" ? values : values.join(",")]]
        : [];
    }),
  );
  const parsed = z.strictObject(shape).parse(input);
  const result = Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
  const names =
    kind === "events"
      ? [...youngEventNumberFields, ...youngEventDateFields]
      : youngOrganizerNumberFields;
  for (const name of names) {
    if (!result[name] || result[`${name}Op`] !== "between") continue;
    if (
      !result[`${name}Max`] ||
      (name === "startAt"
        ? result[name] > result[`${name}Max`]
        : Number(result[name]) > Number(result[`${name}Max`]))
    )
      throw new RangeError("Invalid comparison range");
  }
  return result;
}
