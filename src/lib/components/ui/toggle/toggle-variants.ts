import type { HTMLButtonAttributes } from "svelte/elements";
import { tv, type VariantProps } from "tailwind-variants";
import type { WithElementRef } from "$lib/utils.js";

export const toggleVariants = tv({
  base: "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent px-3 font-medium text-sm shadow-sm transition hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-base-200 data-[state=on]:text-base-content data-[state=on]:shadow-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  variants: {
    variant: {
      default: "bg-base-100 text-base-content",
      outline: "border-base-300 bg-base-100 text-base-content",
    },
    size: {
      default: "h-9 px-3",
      sm: "h-8 rounded-md px-2.5 text-xs",
      lg: "h-10 rounded-md px-4",
      icon: "size-9 px-0",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ToggleVariants = VariantProps<typeof toggleVariants>;

export type ToggleProps = WithElementRef<HTMLButtonAttributes> &
  ToggleVariants & {
    pressed?: boolean;
  };
