import type { Tabs as TabsPrimitive } from "bits-ui";
import type { Component } from "svelte";

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
