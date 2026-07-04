import Root from "./tabs.svelte";
import Content from "./tabs-content.svelte";
import List from "./tabs-list.svelte";
import {
  type TabsListVariant,
  tabsListVariants,
} from "./tabs-list-variants.js";
import Trigger from "./tabs-trigger.svelte";

export {
  Content,
  Content as TabsContent,
  List,
  List as TabsList,
  Root,
  Root as Tabs,
  type TabsListVariant,
  Trigger,
  Trigger as TabsTrigger,
  tabsListVariants,
};
