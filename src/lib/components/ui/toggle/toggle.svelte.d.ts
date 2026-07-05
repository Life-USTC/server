import type { Component } from "svelte";
import type { Toggle as TogglePrimitive } from "bits-ui";

export type ToggleVariant = "default" | "outline";
export type ToggleSize = "default" | "sm" | "lg";
export type ToggleVariants = {
	variant?: ToggleVariant | null;
	size?: ToggleSize | null;
};

export declare const toggleVariants: (props?: ToggleVariants & {
	class?: string;
	className?: string;
}) => string;

export type ToggleProps = TogglePrimitive.RootProps & {
	variant?: ToggleVariant;
	size?: ToggleSize;
};

declare const Toggle: Component<ToggleProps, Record<string, never>, "ref">;

export default Toggle;
