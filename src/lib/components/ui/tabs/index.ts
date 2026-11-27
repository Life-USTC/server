import Root from "./tabs.svelte";
import { TabsPanel as Content } from "@ui-sdk/svelte/tabs";
import List, { tabsListVariants, type TabsListVariant } from "./tabs-list.svelte";
import { TabsTab as Trigger } from "@ui-sdk/svelte/tabs";

export {
	Root,
	Content,
	List,
	Trigger,
	tabsListVariants,
	type TabsListVariant,
	//
	Root as Tabs,
	Content as TabsContent,
	List as TabsList,
	Trigger as TabsTrigger,
};
