import type { Component, ComponentProps } from "svelte";
import type { TabsList as SDKComponent } from "@ui-sdk/svelte/tabs";

export type TabsListVariant = "default" | "line";

export declare const tabsListVariants: (props?: {
	variant?: TabsListVariant | null;
	class?: string;
	className?: string;
}) => string;

export type TabsListProps = ComponentProps<typeof SDKComponent> & { ref?: HTMLDivElement | null } & {
	variant?: TabsListVariant;
};

declare const TabsList: Component<TabsListProps, Record<string, never>, "ref">;

export default TabsList;
