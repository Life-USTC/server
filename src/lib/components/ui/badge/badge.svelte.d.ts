import type { Component } from "svelte";
import type { HTMLAnchorAttributes } from "svelte/elements";
import type { WithElementRef } from "$lib/utils.js";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";

export declare const badgeVariants: (props?: {
  variant?: BadgeVariant | null;
  class?: string;
  className?: string;
}) => string;

export type BadgeProps = WithElementRef<HTMLAnchorAttributes> & {
  variant?: BadgeVariant;
};

declare const Badge: Component<BadgeProps, Record<string, never>, "ref">;

export default Badge;
