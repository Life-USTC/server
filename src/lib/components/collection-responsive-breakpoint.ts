/**
 * Shared breakpoint for catalog and workspace list/table vs compact card layouts.
 * Uses Tailwind `xl` (1280px). Shell navigation (sidebar vs mobile chrome) stays at `md`.
 */
export const COLLECTION_DESKTOP_MIN_WIDTH_PX = 1280;

export const collectionCompactClass = "xl:hidden";
export const collectionDesktopClass = "hidden xl:block";
export const collectionDesktopScrollClass =
  "hidden min-w-0 overflow-x-auto xl:block";
