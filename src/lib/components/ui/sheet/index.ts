import { Dialog as Root } from "@ui-sdk/svelte/dialog";
import { DialogTrigger as Trigger } from "@ui-sdk/svelte/dialog";
import { DialogClose as Close } from "@ui-sdk/svelte/dialog";
import Overlay from "./sheet-overlay.svelte";
import Content from "./sheet-content.svelte";
import { DialogTitle as Title } from "@ui-sdk/svelte/dialog";
import { DialogDescription as Description } from "@ui-sdk/svelte/dialog";

export {
	Root,
	Close,
	Trigger,
	Overlay,
	Content,
	Title,
	Description,
	//
	Root as Sheet,
	Close as SheetClose,
	Trigger as SheetTrigger,
	Overlay as SheetOverlay,
	Content as SheetContent,
	Title as SheetTitle,
	Description as SheetDescription,
};
