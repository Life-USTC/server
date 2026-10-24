<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import { onMount } from "svelte";
import type { HTMLInputAttributes } from "svelte/elements";
import { mountPageSearchShortcut } from "#lib/browser/page-search-shortcut.js";
import PageSearchShortcutHint from "#lib/components/shell/PageSearchShortcutHint.svelte";
import InputGroupRoot from "#lib/components/ui/input-group/input-group.svelte";
import InputGroupAddon from "#lib/components/ui/input-group/input-group-addon.svelte";
import InputGroupInput from "#lib/components/ui/input-group/input-group-input.svelte";

let {
  label,
  value = $bindable(""),
  ref = $bindable(null),
  shortcut = true,
  ...inputProps
}: {
  id: string;
  label: string;
  name?: string;
  form?: string;
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
  <label class="sr-only" for={inputProps.id}>{label}</label>
  <InputGroupRoot>
    <InputGroupAddon><SearchIcon aria-hidden="true" /></InputGroupAddon>
    <InputGroupInput {...inputProps} bind:ref bind:value type="search" />
    {#if shortcut}<InputGroupAddon align="inline-end"><PageSearchShortcutHint /></InputGroupAddon>{/if}
  </InputGroupRoot>
</div>
