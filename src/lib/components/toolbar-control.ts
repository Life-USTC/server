/** Filter fields: 44px on touch widths, the default control height from `md`. */
export const toolbarFieldClass = "h-11 md:h-8";

/** Filter-row buttons. `shrink-0` keeps them from stretching beside a flexible field. */
export const toolbarControlClass = `${toolbarFieldClass} shrink-0`;

/** Native select wrappers in a filter row or filter sheet. */
export const toolbarSelectClass = "[&_select]:h-11 md:[&_select]:h-8";
