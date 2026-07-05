<script lang="ts">
import * as Accordion from "$lib/components/ui/accordion/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SectionHomeworkAuditLog,
  SectionHomeworkCommonCopy,
  SectionHomeworkCopy,
  SectionHomeworkFormatter,
} from "./section-homework-display-types";

export let commonCopy: SectionHomeworkCommonCopy;
export let fmtDateTime: SectionHomeworkFormatter;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let homeworkAuditActionLabel: (action: string) => string;
export let homeworkCopy: SectionHomeworkCopy;
export let logs: SectionHomeworkAuditLog[];
</script>

{#if logs.length > 0}
  <Accordion.Root type="single">
    <Accordion.Item value="history">
      <Accordion.Trigger>{homeworkCopy.contentHistoryAction}</Accordion.Trigger>
      <Accordion.Content>
        <Item.Group>
          {#each logs.slice(0, 5) as log}
            <Item.Root
              size="sm"
              variant="muted"
            >
              <Item.Content>
                <Item.Title>{homeworkAuditActionLabel(log.action)}</Item.Title>
                <Item.Description class="line-clamp-none">
                  {log.titleSnapshot}
                </Item.Description>
              </Item.Content>
              <Item.Actions class="text-muted-foreground text-xs">
                {fmtDateTime(log.createdAt)}
              </Item.Actions>
              {#if log.actor}
                <Item.Footer class="text-muted-foreground text-xs">
                  {formatMessage(homeworkCopy.contentHistoryActor, {
                    name: log.actor.name ?? log.actor.username ?? commonCopy.unknown,
                  })}
                </Item.Footer>
              {/if}
            </Item.Root>
          {/each}
        </Item.Group>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
{/if}
