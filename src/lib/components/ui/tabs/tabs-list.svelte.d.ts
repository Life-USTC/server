import type { Component } from "svelte";
import type { Tabs as TabsPrimitive } from "bits-ui";

export type TabsListVariant = "default" | "line";

export declare const tabsListVariants: (props?: {
	variant?: TabsListVariant | null;
	class?: string;
	className?: string;
}) => string;

export type TabsListProps = TabsPrimitive.ListProps & {
	variant?: TabsListVariant;
};

declare const TabsList: Component<TabsListProps, Record<string, never>, "ref">;

export default TabsList;
