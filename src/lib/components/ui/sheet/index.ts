import { Dialog as Root } from "@ui-sdk/svelte/dialog";
import { DialogTrigger as Trigger } from "@ui-sdk/svelte/dialog";
import { DialogClose as Close } from "@ui-sdk/svelte/dialog";
import Content from "./sheet-content.svelte";
import { DialogTitle as Title } from "@ui-sdk/svelte/dialog";
import { DialogDescription as Description } from "@ui-sdk/svelte/dialog";

export {
	Root,
	Close,
	Trigger,
	Content,
	Title,
	Description,
	//
	Root as Sheet,
	Close as SheetClose,
	Trigger as SheetTrigger,
	Content as SheetContent,
	Title as SheetTitle,
	Description as SheetDescription,
};
