import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type { ClassValue };

type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, "child"> : T;
type WithoutChildren<T> = T extends { children?: unknown }
  ? Omit<T, "children">
  : T;

export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks whether a value is a plain object (not null, not an array, not a Date).
 * Used across MCP payload compaction, event summaries, and date serialization.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}
