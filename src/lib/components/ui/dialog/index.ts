export { default as Actions } from "./dialog-actions.svelte";
import { Dialog as Root } from "@ui-sdk/svelte/dialog";
import { DialogTitle as Title } from "@ui-sdk/svelte/dialog";
import Header from "./dialog-header.svelte";
import Content from "./dialog-content.svelte";
import { DialogDescription as Description } from "@ui-sdk/svelte/dialog";
import { DialogTrigger as Trigger } from "@ui-sdk/svelte/dialog";
import { DialogClose as Close } from "@ui-sdk/svelte/dialog";

export {
	Root,
	Title,
	Header,
	Trigger,
	Content,
	Description,
	Close,
	//
	Root as Dialog,
	Title as DialogTitle,
	Header as DialogHeader,
	Trigger as DialogTrigger,
	Content as DialogContent,
	Description as DialogDescription,
	Close as DialogClose,
};
