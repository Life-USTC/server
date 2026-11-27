import { useSidebar } from "./context.svelte.js";
import MenuButton from "./sidebar-menu-button.svelte";
import Provider from "./sidebar-provider.svelte";
import Rail from "./sidebar-rail.svelte";
import Trigger from "./sidebar-trigger.svelte";
import Root from "./sidebar.svelte";

export {

	MenuButton,
	Provider,
	Rail,
	Root,
	//
	Root as Sidebar,

	MenuButton as SidebarMenuButton,
	Provider as SidebarProvider,
	Rail as SidebarRail,
	Trigger as SidebarTrigger,
	Trigger,
	useSidebar,
};
