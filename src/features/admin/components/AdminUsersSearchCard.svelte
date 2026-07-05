<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import XIcon from "@lucide/svelte/icons/x";
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
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
    <form method="GET">
      <Field.Group>
        <Field.Field>
          <Field.Label class="sr-only" for="admin-user-search">{commonCopy.search}</Field.Label>
          <ButtonGroup.Root class="w-full">
            <InputGroup.Root class="min-w-0 flex-1">
              <InputGroup.Input
                id="admin-user-search"
                name="search"
                placeholder={copy.searchPlaceholder}
                type="search"
                value={search}
              />
              <InputGroup.Addon>
                <SearchIcon />
              </InputGroup.Addon>
              <InputGroup.Addon align="inline-end">
                <InputGroup.Button type="submit" variant="default" size="sm">
                  {commonCopy.search}
                </InputGroup.Button>
              </InputGroup.Addon>
            </InputGroup.Root>
            {#if search}
              <Button href="/admin/users" variant="outline">
                <XIcon data-icon="inline-start" />
                <span>{commonCopy.clear}</span>
              </Button>
            {/if}
          </ButtonGroup.Root>
        </Field.Field>
      </Field.Group>
    </form>
  </Card.Content>
</Card.Root>
