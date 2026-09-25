<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { onMount } from "svelte";
import type { HTMLInputAttributes } from "svelte/elements";
import { mountPageSearchShortcut } from "$lib/browser/page-search-shortcut";
import PageSearchShortcutHint from "$lib/components/shell/PageSearchShortcutHint.svelte";
import * as InputGroup from "$lib/components/ui/input-group";

let {
  id,
  label,
  name,
  placeholder,
  value = $bindable(""),
  ref = $bindable(null),
  maxlength,
  disabled = false,
  oninput,
  shortcut = true,
}: {
  id: string;
  label: string;
  name?: string;
  placeholder?: string;
  value?: string;
  ref?: HTMLInputElement | null;
  maxlength?: number;
  disabled?: boolean;
  oninput?: HTMLInputAttributes["oninput"];
  shortcut?: boolean;
} = $props();
onMount(() => (shortcut ? mountPageSearchShortcut(() => ref) : undefined));
</script>

<div class="min-w-0 flex-1" data-slot="search-field">
  <label class="sr-only" for={id}>{label}</label>
  <InputGroup.Root class="h-11">
    <InputGroup.Addon><SearchIcon aria-hidden="true" /></InputGroup.Addon>
    <InputGroup.Input {id} {name} {placeholder} {maxlength} {disabled} {oninput} bind:ref bind:value type="search" />
    {#if shortcut}<InputGroup.Addon align="inline-end"><PageSearchShortcutHint /></InputGroup.Addon>{/if}
  </InputGroup.Root>
</div>
