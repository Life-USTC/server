<script lang="ts">
import { AlertDialogDescription, AlertDialogTitle } from "@ui-sdk/svelte/alert-dialog";

let { title, description, titleId, descriptionClass }: {
  title: string;
  description: string;
  titleId?: string;
  descriptionClass?: string;
} = $props();
</script>

<div data-slot="alert-dialog-header">
  <AlertDialogTitle id={titleId}>{title}</AlertDialogTitle>
  <AlertDialogDescription class={descriptionClass}>{description}</AlertDialogDescription>
</div>
