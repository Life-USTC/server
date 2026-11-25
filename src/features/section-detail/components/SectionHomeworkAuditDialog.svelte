<script lang="ts">
import EmptyState from "#lib/components/EmptyState.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { ScrollArea } from "#lib/components/ui/scroll-area/index.js";
import type { SectionDetailCopy } from "@/features/section-detail/lib/section-detail-controller-types";

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
export let homeworkCopy: SectionDetailCopy["homeworks"];
export let logs: HomeworkAuditLog[];
export let sectionCopy: SectionDetailCopy["sectionDetail"];
export let setOpen: (open: boolean) => void;
</script>

<Dialog.Root
  open={true}
  onOpenChange={setOpen}
>
  <Dialog.Content
    class="!max-w-2xl sm:!max-w-2xl"
  >
    <Dialog.Header>
      <Dialog.Title>{homeworkCopy.auditTitle}</Dialog.Title>
      <Dialog.Description>{sectionCopy.homeworkDescription}</Dialog.Description>
    </Dialog.Header>
    <ScrollArea class="h-[min(72vh,42rem)]">
      <section class="px-5 py-4">
        {#if logs.length === 0}
          <EmptyState description={homeworkCopy.auditEmpty} />
        {:else}
          <Item.Group>
            {#each logs as log}
              <Item.Root variant="outline">
                <Item.Content class="min-w-0">
                  <Item.Title class="line-clamp-none flex-wrap">
                    <Badge variant={log.action === "deleted" ? "destructive" : "secondary"}>
                      {actionLabel(log.action)}
                    </Badge>
                    <span class="min-w-0 break-words">
                      {log.titleSnapshot ?? ""}
                    </span>
                  </Item.Title>
                </Item.Content>
                <Item.Actions>
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
    </ScrollArea>
    <div data-slot="dialog-footer">
      <Button type="button" onclick={() => setOpen(false)}>
        {sectionCopy.close ?? ""}
      </Button>
    </div>
  </Dialog.Content>
</Dialog.Root>
