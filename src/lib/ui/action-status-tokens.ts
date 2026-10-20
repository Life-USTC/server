/**
 * Shared action + status color roles.
 *
 * - `primary`: at most one solid CTA per view (login/submit/official register).
 * - `secondary`: outline / muted actions (subscribe, clear filters, follow).
 * - `status-*`: lifecycle badges (进行中 / 报名中 / 逾期 / 已结束), never primary fill.
 */

export const STATUS_TOKEN_KEYS = [
  "active",
  "open",
  "overdue",
  "ended",
] as const;
export type StatusToken = (typeof STATUS_TOKEN_KEYS)[number];

/** Tailwind utility classes bound to CSS status tokens in `svelte.css`. */
export const STATUS_BADGE_CLASS = {
  active:
    "border-transparent bg-status-active text-status-active-foreground [a]:hover:bg-status-active/80",
  open: "border-transparent bg-status-open text-status-open-foreground [a]:hover:bg-status-open/80",
  overdue:
    "border-transparent bg-status-overdue text-status-overdue-foreground [a]:hover:bg-status-overdue/80",
  ended:
    "border-transparent bg-status-ended text-status-ended-foreground [a]:hover:bg-status-ended/80",
} as const satisfies Record<StatusToken, string>;

const OPEN_STATUS_MARKERS = [
  "报名中",
  "开放报名",
  "registration open",
  "open for registration",
  "signing up",
] as const;

const ACTIVE_STATUS_MARKERS = [
  "进行中",
  "in progress",
  "ongoing",
  "active",
] as const;

const OVERDUE_STATUS_MARKERS = ["逾期", "overdue", "past due"] as const;

const ENDED_STATUS_MARKERS = [
  "已结束",
  "结束",
  "ended",
  "closed",
  "completed",
  "finished",
] as const;

function matchesMarker(value: string, markers: readonly string[]): boolean {
  const normalized = value.trim().toLowerCase();
  return markers.some((marker) => normalized.includes(marker.toLowerCase()));
}

/**
 * Map a free-text Young/workspace status label (and optional isActive flag)
 * onto a status token. Prefer explicit label markers; fall back to isActive.
 */
export function resolveStatusToken(input: {
  status?: string | null;
  isActive?: boolean | null;
  overdue?: boolean | null;
}): StatusToken {
  if (input.overdue) return "overdue";
  const status = input.status?.trim() ?? "";
  if (status) {
    if (matchesMarker(status, OVERDUE_STATUS_MARKERS)) return "overdue";
    if (matchesMarker(status, OPEN_STATUS_MARKERS)) return "open";
    if (matchesMarker(status, ENDED_STATUS_MARKERS)) return "ended";
    if (matchesMarker(status, ACTIVE_STATUS_MARKERS)) return "active";
  }
  if (input.isActive === false) return "ended";
  if (input.isActive === true) return "active";
  return "ended";
}
