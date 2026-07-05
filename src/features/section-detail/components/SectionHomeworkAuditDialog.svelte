<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";

type HomeworkAuditLog = {
  action: string;
  actor?: { name?: string | null; username?: string | null } | null;
  createdAt?: string | Date | null;
  homeworkId: string | null;
  id: string | number;
  titleSnapshot?: string | null;
};

export let actionLabel: (action: string) => string;
export let actorName: (log: HomeworkAuditLog) => string;
export let fmtDateTime: (value: string | Date | null | undefined) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let homeworkCopy: {
  auditEmpty: string;
  auditMeta: string;
  auditTitle: string;
};
export let logs: HomeworkAuditLog[];
export let sectionCopy: {
  close?: string;
  homeworkDescription: string;
};
export let setOpen: (open: boolean) => void;
</script>

<Dialog.Root
  open={true}
  onOpenChange={setOpen}
>
  <Dialog.Content
    class="!max-w-2xl"
  >
    <Dialog.Header>
      <Dialog.Title>{homeworkCopy.auditTitle}</Dialog.Title>
      <Dialog.Description>{sectionCopy.homeworkDescription}</Dialog.Description>
    </Dialog.Header>
    <section class="max-h-[min(72vh,42rem)] overflow-y-auto px-5 py-4">
      {#if logs.length === 0}
        <Empty.Root>
          <Empty.Header>
            <Empty.Description>{homeworkCopy.auditEmpty}</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <Item.Group>
          {#each logs as log}
            <Item.Root variant="outline">
              <Item.Content class="min-w-0">
                <Item.Title class="line-clamp-none flex-wrap">
                  <Badge
                    class={log.action === "deleted"
                      ? "border-error/30 bg-error/10 text-error"
                      : ""}
                    variant={log.action === "deleted" ? "outline" : "secondary"}
                  >
                    {actionLabel(log.action)}
                  </Badge>
                  <span class="min-w-0 break-words">
                    {log.titleSnapshot ?? ""}
                  </span>
                </Item.Title>
              </Item.Content>
              <Item.Actions class="text-muted-foreground text-xs">
                {formatMessage(homeworkCopy.auditMeta, {
                  name: actorName(log),
                  date: fmtDateTime(log.createdAt),
                })}
              </Item.Actions>
            </Item.Root>
          {/each}
        </Item.Group>
      {/if}
    </section>
    <Dialog.Footer>
      <Button type="button" onclick={() => setOpen(false)}>
        {sectionCopy.close ?? ""}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
