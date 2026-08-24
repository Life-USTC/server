<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import XIcon from "@lucide/svelte/icons/x";
import { onMount } from "svelte";
import { mountPageSearchShortcut } from "@/lib/browser/page-search-shortcut";
import PageSearchShortcutHint from "$lib/components/shell/PageSearchShortcutHint.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import type { AdminUsersCommonCopy, AdminUsersCopy } from "./admin-user-types";

export let commonCopy: AdminUsersCommonCopy;
export let copy: AdminUsersCopy;
export let search: string;

let searchInput: HTMLInputElement | null = null;

onMount(() => mountPageSearchShortcut(() => searchInput));
</script>

<section class="grid min-w-0 gap-3">
  <form method="GET">
    <Field.Group>
      <Field.Field>
        <Field.Label class="sr-only" for="admin-user-search">{commonCopy.search}</Field.Label>
        <ButtonGroup.Root class="w-full">
          <InputGroup.Root class="min-w-0 flex-1">
            <InputGroup.Addon>
              <SearchIcon aria-hidden="true" />
            </InputGroup.Addon>
            <InputGroup.Input
              id="admin-user-search"
              bind:ref={searchInput}
              name="search"
              placeholder={copy.searchPlaceholder}
              type="search"
              value={search}
            />
            <InputGroup.Addon class="hidden sm:flex" align="inline-end">
              <PageSearchShortcutHint />
            </InputGroup.Addon>
          </InputGroup.Root>
          {#if search}
            <Button href="/admin/users" variant="outline">
              <XIcon data-icon="inline-start" />
              <span>{commonCopy.clear}</span>
            </Button>
          {/if}
          <Button type="submit">
            {commonCopy.search}
          </Button>
        </ButtonGroup.Root>
      </Field.Field>
    </Field.Group>
  </form>
</section>
