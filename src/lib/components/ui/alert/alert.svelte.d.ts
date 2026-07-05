import type { Component } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import type { WithElementRef } from "$lib/utils.js";

export type AlertVariant = "default" | "destructive";

export declare const alertVariants: (props?: {
	variant?: AlertVariant | null;
	class?: string;
	className?: string;
}) => string;

export type AlertProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	variant?: AlertVariant;
};

declare const Alert: Component<AlertProps, Record<string, never>, "ref">;

export default Alert;
