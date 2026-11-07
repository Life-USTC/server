import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { currentCatalogDetailItem } from "./shell-nav-helpers";

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

const SECTION_ANCHORS = [
  "introduction",
  "calendar",
  "exams",
  "homework",
  "comments",
  "overview",
] as const;
const ENTITY_ANCHORS = [
  "introduction",
  "sections",
  "comments",
  "overview",
] as const;

export function detailAnchorIds(kind: unknown) {
  return kind === "section"
    ? SECTION_ANCHORS
    : kind === "course" || kind === "teacher"
      ? ENTITY_ANCHORS
      : ([] as const);
}

/** Public entity facts and route-declared content capabilities only. */
export function detailNavigation(
  pageData: Record<string, unknown>,
  pathname: string,
  copy: LayoutCopy,
) {
  const kind = pageData.shellDetail;
  const collection =
    kind === "course"
      ? "/catalog/courses"
      : kind === "section"
        ? "/catalog/sections"
        : kind === "teacher"
          ? "/catalog/teachers"
          : null;
  if (!collection) return null;
  const current = currentCatalogDetailItem(collection, pathname, pageData);
  if (!current) return null;
  const labels = copy.shell.detailNavigation;
  const anchors = detailAnchorIds(kind);
  const course = record(record(pageData.section)?.course);
  const jwId = course?.jwId;
  // Demo already exposes its sealed course relation inside the sample description.
  const courseHref =
    kind === "section" &&
    !pageData.demo &&
    ((typeof jwId === "number" && Number.isSafeInteger(jwId) && jwId > 0) ||
      (typeof jwId === "string" && /^[1-9]\d*$/.test(jwId)))
      ? `/catalog/courses/${jwId}`
      : null;
  return {
    collection: {
      href: collection,
      label:
        kind === "course"
          ? copy.nav.courses
          : kind === "section"
            ? copy.nav.sections
            : copy.nav.teachers,
    },
    current,
    courseHref,
    anchors: anchors.map((anchor) => ({
      href: `#${anchor}`,
      label: labels[anchor],
    })),
  };
}
