import { AlertDialog as Root } from "@ui-sdk/svelte/alert-dialog";
import { AlertDialogTrigger as Trigger } from "@ui-sdk/svelte/alert-dialog";
import { AlertDialogTitle as Title } from "@ui-sdk/svelte/alert-dialog";
import { Button as Action } from "#lib/components/ui/button/index.js";
import Cancel from "./alert-dialog-cancel.svelte";
import Content from "./alert-dialog-content.svelte";
import { AlertDialogDescription as Description } from "@ui-sdk/svelte/alert-dialog";

export {
	Root,
	Title,
	Action,
	Cancel,
	Trigger,
	Content,
	Description,
	//
	Root as AlertDialog,
	Title as AlertDialogTitle,
	Action as AlertDialogAction,
	Cancel as AlertDialogCancel,
	Trigger as AlertDialogTrigger,
	Content as AlertDialogContent,
	Description as AlertDialogDescription,

};

export { default as Heading } from "./alert-dialog-heading.svelte";
export { default as Actions } from "./alert-dialog-actions.svelte";
export { default as Confirmation } from "./alert-dialog-confirmation.svelte";
