import { Popover as Root } from "@ui-sdk/svelte/popover";
import { PopoverClose as Close } from "@ui-sdk/svelte/popover";
import Content from "./popover-content.svelte";
import Description from "./popover-description.svelte";
import Header from "./popover-header.svelte";
import Title from "./popover-title.svelte";
import { PopoverTrigger as Trigger } from "@ui-sdk/svelte/popover";

export {
	Root,
	Content,
	Description,
	Header,
	Title,
	Trigger,
	Close,
	//
	Root as Popover,
	Content as PopoverContent,
	Description as PopoverDescription,
	Header as PopoverHeader,
	Title as PopoverTitle,
	Trigger as PopoverTrigger,
	Close as PopoverClose,
};
