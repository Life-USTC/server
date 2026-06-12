<script lang="ts">
import SearchIcon from "$lib/components/icons/search.svelte";
import XIcon from "$lib/components/icons/x.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type { AdminUsersCommonCopy, AdminUsersCopy } from "./admin-user-types";

export let commonCopy: AdminUsersCommonCopy;
export let copy: AdminUsersCopy;
export let search: string;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.findAccounts}</Card.Title>
    <Card.Description>{copy.findAccountsDescription}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="GET" class="grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <label class="sr-only" for="admin-user-search">{commonCopy.search}</label>
      <Input
        id="admin-user-search"
        name="search"
        placeholder={copy.searchPlaceholder}
        type="search"
        value={search}
      />
      <Button type="submit">
        <SearchIcon />
        <span>{commonCopy.search}</span>
      </Button>
      {#if search}
        <Button href="/admin/users" role="button" variant="outline">
          <XIcon />
          <span>{commonCopy.clear}</span>
        </Button>
      {/if}
    </form>
  </Card.Content>
</Card.Root>
