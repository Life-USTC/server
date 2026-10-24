import type { Prisma } from "@/generated/prisma/client";
import {
  youngEventChoiceFields,
  youngEventNumberFields,
} from "../lib/young-table-filters";

function selected(value: string | undefined) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function youngNumberWhere(values: Record<string, string>, name: string) {
  if (!values[name]) return undefined;
  const value = Number(values[name]);
  switch (values[`${name}Op`]) {
    case "ne":
      return { not: value };
    case "gt":
      return { gt: value };
    case "gte":
      return { gte: value };
    case "lt":
      return { lt: value };
    case "lte":
      return { lte: value };
    case "between":
      return { gte: value, lte: Number(values[`${name}Max`]) };
    default:
      return { equals: value };
  }
}

export function buildYoungTableWhere(
  values: Record<string, string>,
  statusLabels?: { statusOpen: string; statusClosed: string },
): Prisma.YoungEventWhereInput {
  const where: Prisma.YoungEventWhereInput = {};
  if (values.search)
    where.name = { contains: values.search, mode: "insensitive" };
  if (values.location)
    where.location = { contains: values.location, mode: "insensitive" };
  if (values.status) {
    const statuses: Prisma.YoungEventWhereInput[] = [
      { status: { contains: values.status, mode: "insensitive" } },
    ];
    if (statusLabels) {
      const query = values.status.toLocaleLowerCase();
      for (const isActive of [true, false]) {
        const label = isActive
          ? statusLabels.statusOpen
          : statusLabels.statusClosed;
        if (label.toLocaleLowerCase().includes(query)) {
          statuses.push({ isActive, OR: [{ status: null }, { status: "" }] });
        }
      }
    }
    where.OR = statuses;
  }
  for (const name of youngEventChoiceFields) {
    const options = selected(values[name]).map((value) =>
      name === "category" ? decodeURIComponent(value) : value,
    );
    if (name === "active") {
      if (options.length === 1) where.isActive = options[0] === "true";
    } else if (options.length)
      where[name] = options.length === 1 ? options[0] : { in: options };
  }
  for (const name of youngEventNumberFields) {
    const condition = youngNumberWhere(values, name);
    if (condition) where[name] = condition;
  }
  if (values.startAt) {
    const start = new Date(`${values.startAt}T00:00:00+08:00`);
    const end = new Date(`${values.startAt}T23:59:59.999+08:00`);
    switch (values.startAtOp) {
      case "ne":
        where.NOT = { startAt: { gte: start, lte: end } };
        where.startAt = { not: null };
        break;
      case "gt":
        where.startAt = { gt: end };
        break;
      case "gte":
        where.startAt = { gte: start };
        break;
      case "lt":
        where.startAt = { lt: start };
        break;
      case "lte":
        where.startAt = { lte: end };
        break;
      case "between":
        where.startAt = {
          gte: start,
          lte: new Date(`${values.startAtMax}T23:59:59.999+08:00`),
        };
        break;
      default:
        where.startAt = { gte: start, lte: end };
    }
  }
  return where;
}
