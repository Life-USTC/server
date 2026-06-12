<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

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

<Dialog.Root open={true} class="!max-w-2xl" onOpenChange={setOpen}>
  <Dialog.Header>
    <Dialog.Title>{homeworkCopy.auditTitle}</Dialog.Title>
    <Dialog.Description>{sectionCopy.homeworkDescription}</Dialog.Description>
  </Dialog.Header>
  <section class="max-h-[min(72vh,42rem)] overflow-y-auto px-5 py-4">
    {#if logs.length === 0}
      <Alert>{homeworkCopy.auditEmpty}</Alert>
    {:else}
      <div class="grid gap-3">
        {#each logs as log}
          <article class="rounded-md border border-base-300 bg-base-100 p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <Badge
                  class={log.action === "deleted"
                    ? "border-error/30 bg-error/10 text-error"
                    : ""}
                  variant={log.action === "deleted" ? "outline" : "secondary"}
                >
                  {actionLabel(log.action)}
                </Badge>
                <span class="min-w-0 break-words font-medium text-sm">
                  {log.titleSnapshot ?? ""}
                </span>
              </div>
              <span class="text-base-content/60 text-xs">
                {formatMessage(homeworkCopy.auditMeta, {
                  name: actorName(log),
                  date: fmtDateTime(log.createdAt),
                })}
              </span>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
  <Dialog.Footer>
    <Button type="button" onclick={() => setOpen(false)}>
      {sectionCopy.close ?? ""}
    </Button>
  </Dialog.Footer>
</Dialog.Root>
