import { useSidebar } from "./context.svelte.js";
import GroupLabel from "./sidebar-group-label.svelte";
import Inset from "./sidebar-inset.svelte";
import MenuBadge from "./sidebar-menu-badge.svelte";
import MenuButton from "./sidebar-menu-button.svelte";
import Provider from "./sidebar-provider.svelte";
import Rail from "./sidebar-rail.svelte";
import Trigger from "./sidebar-trigger.svelte";
import Root from "./sidebar.svelte";

export {
	GroupLabel,
	Inset,
	MenuBadge,
	MenuButton,
	Provider,
	Rail,
	Root,
	//
	Root as Sidebar,
	GroupLabel as SidebarGroupLabel,
	Inset as SidebarInset,
	MenuBadge as SidebarMenuBadge,
	MenuButton as SidebarMenuButton,
	Provider as SidebarProvider,
	Rail as SidebarRail,
	Trigger as SidebarTrigger,
	Trigger,
	useSidebar,
};
