<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-helpers";
import PageSearchShortcutHint from "$lib/components/shell/PageSearchShortcutHint.svelte";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";

export let workspaceCopy: Pick<WorkspaceCopy, "linkHub">;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
</script>

<div class="flex min-w-0 flex-wrap items-end gap-2">
  <Field.Group class="min-w-60 flex-1 max-w-xl gap-0">
    <Field.Field>
      <Field.Label class="sr-only" for="anonymous-link-search"
        >{workspaceCopy.linkHub.searchPlaceholder}</Field.Label
      >
      <InputGroup.Root>
        <InputGroup.Input
          id="anonymous-link-search"
          bind:ref={linkSearchInput}
          placeholder={workspaceCopy.linkHub.searchPlaceholder}
          type="search"
          value={linkSearchQuery}
          oninput={(event: Event) => {
            linkSearchQuery = (event.currentTarget as HTMLInputElement).value;
          }}
        />
        <InputGroup.Addon>
          <SearchIcon />
        </InputGroup.Addon>
        <InputGroup.Addon align="inline-end">
          <PageSearchShortcutHint />
        </InputGroup.Addon>
      </InputGroup.Root>
    </Field.Field>
  </Field.Group>
</div>
