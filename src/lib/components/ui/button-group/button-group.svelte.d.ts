import type { Component } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import type { WithElementRef } from "$lib/utils.js";

export type ButtonGroupOrientation = "horizontal" | "vertical";

export declare const buttonGroupVariants: (props?: {
	orientation?: ButtonGroupOrientation | null;
	class?: string;
	className?: string;
}) => string;

export type ButtonGroupProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	orientation?: ButtonGroupOrientation;
};

declare const ButtonGroup: Component<ButtonGroupProps, Record<string, never>, "ref">;

export default ButtonGroup;
