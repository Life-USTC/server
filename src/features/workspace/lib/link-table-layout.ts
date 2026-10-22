/** Shared column widths so link group tables align across sections. */
export const LINK_TABLE_CLASS = "w-full table-fixed";
export const LINK_TABLE_NAME_COL = "w-[42%]";
export const LINK_TABLE_ACTIONS_COL = "w-20";

/**
 * The link directory is eight short grouped tables. Stacking them keeps one
 * text line per row at desktop width, so wide viewports flow the groups into
 * balanced columns instead; each group stays whole inside one column.
 */
export const linkGroupColumnsClass =
  "grid gap-4 xl:block xl:columns-2 xl:gap-6";
export const linkGroupSectionClass = "grid gap-2 break-inside-avoid xl:mb-4";
