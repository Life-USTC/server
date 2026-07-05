import type { Component } from "svelte";
import type {
	HTMLAnchorAttributes,
	HTMLButtonAttributes,
} from "svelte/elements";
import type { WithElementRef } from "$lib/utils.js";

export type ButtonVariant =
	| "default"
	| "outline"
	| "secondary"
	| "ghost"
	| "destructive"
	| "link";

export type ButtonSize =
	| "default"
	| "xs"
	| "sm"
	| "lg"
	| "icon"
	| "icon-xs"
	| "icon-sm"
	| "icon-lg";

export declare const buttonVariants: (props?: {
	variant?: ButtonVariant | null;
	size?: ButtonSize | null;
	class?: string;
	className?: string;
}) => string;

export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
	WithElementRef<HTMLAnchorAttributes> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	};

declare const Button: Component<ButtonProps, Record<string, never>, "ref">;

export default Button;
