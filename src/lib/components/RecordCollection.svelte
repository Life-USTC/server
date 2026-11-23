<script lang="ts" generics="T">
import type { Snippet } from "svelte";
import MobileListCard from "./MobileListCard.svelte";
import ResponsiveCollection from "./ResponsiveCollection.svelte";
import TruncatedCode from "./TruncatedCode.svelte";
import * as Item from "./ui/item/index.js";
import * as Table from "./ui/table/index.js";

type Field = {
  label: string;
  text?: (row: T) => string | number;
  content?: Snippet<[T]>;
};
let {
  rows,
  href,
  title,
  titleText,
  titleLabel,
  code,
  codeLabel,
  fields,
  secondaryLinks = false,
  cardsTestId,
  groups,
}: {
  rows: T[];
  href: (row: T) => string;
  title?: Snippet<[T]>;
  titleText: (row: T) => string;
  titleLabel: string;
  code?: (row: T) => string;
  codeLabel?: string;
  secondaryLinks?: boolean;
  cardsTestId?: string;
  groups?: { label: string; rows: T[] }[];
  fields: Field[];
} = $props();
</script>

{#snippet heading(row: T)}
  {#if title}{@render title(row)}{:else}{titleText(row)}{/if}
{/snippet}
{#snippet identity(row: T)}
  <a href={href(row)} class="font-medium break-words hover:underline">
    {@render heading(row)}
  </a>
{/snippet}
{#snippet value(field: Field, row: T)}
  {#if field.content}{@render field.content(row)}{:else}{field.text?.(row)}{/if}
{/snippet}

{#snippet card(row: T)}
  <Item.Content><Item.Title class="block line-clamp-none break-words">{#if secondaryLinks}{@render identity(row)}{:else}{@render heading(row)}{/if}</Item.Title></Item.Content>
  {#if code}<Item.Actions><TruncatedCode text={code(row)} /></Item.Actions>{/if}
  <Item.Footer class="flex-wrap justify-start gap-x-3 wrap-anywhere">
    {#each fields as field}<span>{field.label} · {@render value(field, row)}</span>{/each}
  </Item.Footer>
{/snippet}

<ResponsiveCollection>
  {#snippet mobile()}
    {#each groups ?? [{label: "", rows}] as group}
      {#if group.label}<h2 class="my-2 text-sm font-medium">{group.label}</h2>{/if}
      <Item.Group role="list" data-testid={cardsTestId}>
        {#each group.rows as row (href(row))}
          <div role="listitem"><MobileListCard size="sm">
            {#snippet child({ props })}
              {#if secondaryLinks}<div {...props}>{@render card(row)}</div>
              {:else}<a {...props} href={href(row)}>{@render card(row)}</a>{/if}
            {/snippet}
          </MobileListCard></div>
        {/each}
      </Item.Group>
    {/each}
  {/snippet}
  {#snippet desktop()}
    <Table.Root>
      <Table.Header><Table.Row>
        <Table.Head>{titleLabel}</Table.Head>
        {#if code}<Table.Head>{codeLabel}</Table.Head>{/if}
        {#each fields as field}<Table.Head>{field.label}</Table.Head>{/each}
      </Table.Row></Table.Header>
      <Table.Body>
        {#each rows as row (href(row))}
          <Table.Row>
            <Table.Cell class="whitespace-normal">{@render identity(row)}</Table.Cell>
            {#if code}<Table.Cell><TruncatedCode text={code(row)} /></Table.Cell>{/if}
            {#each fields as field}<Table.Cell class="whitespace-normal">{@render value(field, row)}</Table.Cell>{/each}
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/snippet}
</ResponsiveCollection>
