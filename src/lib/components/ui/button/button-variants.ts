import type {
  HTMLAnchorAttributes,
  HTMLButtonAttributes,
} from "svelte/elements";
import { tv, type VariantProps } from "tailwind-variants";
import type { WithElementRef } from "$lib/utils.js";

export const buttonVariants = tv({
  base: "rounded-lg border border-transparent bg-clip-padding text-sm font-medium focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/30 active:not-aria-[haspopup]:translate-y-px aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-primary text-primary-content hover:bg-primary/85",
      outline:
        "border-base-300 bg-base-100 text-base-content hover:bg-base-200 aria-expanded:bg-base-200 aria-expanded:text-base-content",
      secondary:
        "bg-base-200 text-base-content hover:bg-base-300 aria-expanded:bg-base-300 aria-expanded:text-base-content",
      ghost:
        "text-base-content hover:bg-base-200 aria-expanded:bg-base-200 aria-expanded:text-base-content",
      destructive:
        "border-error/25 bg-error/10 text-error hover:bg-error/20 focus-visible:border-error focus-visible:ring-error/30",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default:
        "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
      sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
      lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      icon: "size-8",
      "icon-xs":
        "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
      "icon-sm":
        "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
      "icon-lg": "size-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
  WithElementRef<HTMLAnchorAttributes> & {
    as?: "button" | "label";
    variant?: ButtonVariant;
    size?: ButtonSize;
  };
