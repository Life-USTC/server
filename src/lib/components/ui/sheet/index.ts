import { Dialog as Root } from "@ui-sdk/svelte/dialog";
import { DialogTrigger as Trigger } from "@ui-sdk/svelte/dialog";
import { DialogClose as Close } from "@ui-sdk/svelte/dialog";
import Overlay from "./sheet-overlay.svelte";
import Content from "./sheet-content.svelte";
import Header from "./sheet-header.svelte";
import Title from "./sheet-title.svelte";
import Description from "./sheet-description.svelte";

export {
	Root,
	Close,
	Trigger,
	Overlay,
	Content,
	Header,
	Title,
	Description,
	//
	Root as Sheet,
	Close as SheetClose,
	Trigger as SheetTrigger,
	Overlay as SheetOverlay,
	Content as SheetContent,
	Header as SheetHeader,
	Title as SheetTitle,
	Description as SheetDescription,
};
