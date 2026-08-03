/**
 * Shared between the GraphQL and REST coercion tests so both surfaces are
 * proven to reject the same inputs. `homeworkDateError` detects an invalid date
 * by checking `=== undefined`, so a coercion that returns `Invalid Date`
 * instead silently passes the guard.
 */
export const MALFORMED_HOMEWORK_UPDATE_DATE_STRINGS = [
  "not-a-date",
  "2026-13-45",
] as const;

export const INVALID_PUBLISH_DATE_MESSAGE = "Invalid publish date";
