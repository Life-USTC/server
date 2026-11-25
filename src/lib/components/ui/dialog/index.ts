import { Dialog as Root } from "@ui-sdk/svelte/dialog";
import Title from "./dialog-title.svelte";
import Footer from "./dialog-footer.svelte";
import Header from "./dialog-header.svelte";
import Overlay from "./dialog-overlay.svelte";
import Content from "./dialog-content.svelte";
import Description from "./dialog-description.svelte";
import { DialogTrigger as Trigger } from "@ui-sdk/svelte/dialog";
import { DialogClose as Close } from "@ui-sdk/svelte/dialog";

export {
	Root,
	Title,
	Footer,
	Header,
	Trigger,
	Overlay,
	Content,
	Description,
	Close,
	//
	Root as Dialog,
	Title as DialogTitle,
	Footer as DialogFooter,
	Header as DialogHeader,
	Trigger as DialogTrigger,
	Overlay as DialogOverlay,
	Content as DialogContent,
	Description as DialogDescription,
	Close as DialogClose,
};
