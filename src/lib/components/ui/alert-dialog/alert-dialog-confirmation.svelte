<script lang="ts">
import type { ComponentProps } from "svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import Actions from "./alert-dialog-actions.svelte";
import Content from "./alert-dialog-content.svelte";
import Heading from "./alert-dialog-heading.svelte";

let {
  title, description, titleId, descriptionClass, compact = false, error, ...actions
}: ComponentProps<typeof Actions> & ComponentProps<typeof Heading> & {
  error?: string;
  compact?: boolean;
} = $props();
</script>

<Content {...(titleId ? { "aria-labelledby": titleId } : {})} class={compact ? undefined : "max-w-md sm:max-w-md"}>
  <Heading {title} {description} {titleId} {descriptionClass} />
  {#if error}<Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>{/if}
  <Actions {...actions} />
</Content>
