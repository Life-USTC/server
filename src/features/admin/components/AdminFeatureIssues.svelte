<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type messages from "../../../../messages/en-us.json";
import type { readAdminFeatureIssues } from "../server/admin-experience-page-data";
import AdminTableShell from "./AdminTableShell.svelte";
export let data: Awaited<ReturnType<typeof readAdminFeatureIssues>>;
export let copy: typeof messages.adminExperience;
export let locale: string;
export let auditFilters: Record<string, string | undefined>;
$: dateFormatter = new Intl.DateTimeFormat(locale, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});
function label(group: string, value: string) {
  const labels = (copy as Record<string, unknown>)[group] as
    | Record<string, string>
    | undefined;
  return labels?.[value] ?? value;
}
</script>
    <section aria-labelledby="experience-errors-title" class="grid gap-3 border-t pt-4">
        <div class="grid gap-1">
          <h2 id="experience-errors-title" class="text-lg font-semibold">{copy.recentErrors}</h2>
          <p class="text-sm text-muted-foreground">{copy.recentErrorsDescription}</p>
          {#if data.errorsTruncated}<p class="text-sm text-muted-foreground">{copy.moreIssues}</p>{/if}
        </div>
<form method="GET" aria-label={copy.recentErrors}>
{#each Object.entries(auditFilters) as [key,value]}{#if value}<input type="hidden" name={key} value={value} />{/if}{/each}
<Field.Group class="grid gap-4 sm:grid-cols-3">
<Field.Field><Field.Label for="issue-days">{copy.window}</Field.Label><NativeSelect.Root id="issue-days" name="issue_days">{#each [7,30,90] as days}<NativeSelect.Option value={String(days)} selected={data.days===days}>{copy.issueDays.replace("{days}",String(days))}</NativeSelect.Option>{/each}</NativeSelect.Root></Field.Field>
<Field.Field><Field.Label for="issue-feature">{copy.feature}</Field.Label><NativeSelect.Root id="issue-feature" name="issue_feature"><NativeSelect.Option value="">{copy.all}</NativeSelect.Option>{#each data.catalog.features as feature}<NativeSelect.Option value={feature} selected={data.filters.feature===feature}>{label("features",feature)}</NativeSelect.Option>{/each}</NativeSelect.Root></Field.Field>
<Field.Field><Field.Label for="issue-protocol">{copy.protocol}</Field.Label><NativeSelect.Root id="issue-protocol" name="issue_protocol"><NativeSelect.Option value="">{copy.all}</NativeSelect.Option>{#each data.catalog.protocols as protocol}<NativeSelect.Option value={protocol} selected={data.filters.protocol===protocol}>{label("protocols",protocol)}</NativeSelect.Option>{/each}</NativeSelect.Root></Field.Field>
<Field.Field orientation="horizontal"><Button type="submit">{copy.issueApply}</Button></Field.Field>
</Field.Group></form>
        {#if data.errorsStatus.state === "unavailable"}
          <Alert.Root variant="destructive">
            <Alert.Title>{copy.unavailable}</Alert.Title>
            <Alert.Description>{data.errorsStatus.reason === "not_configured" || data.errorsStatus.reason === "invalid_config" ? copy.unavailableConfiguration : copy.unavailableQuery}</Alert.Description>
          </Alert.Root>
        {:else if data.errorSamples.length === 0}
          <Empty.Root class="items-start border-y px-0 text-left"><Empty.Header class="items-start text-left"><Empty.Title>{copy.noRecentErrors}</Empty.Title></Empty.Header></Empty.Root>
        {:else}
          <AdminTableShell label={copy.recentErrors}>
            <Table.Root class="min-w-[60rem]">
              <Table.Caption class="sr-only">{copy.recentErrors}</Table.Caption>
              <Table.Header><Table.Row><Table.Head>{copy.time}</Table.Head><Table.Head>{copy.feature}</Table.Head><Table.Head>{copy.operation}</Table.Head><Table.Head>{copy.outcome}</Table.Head><Table.Head>{copy.errorClass}</Table.Head><Table.Head>{copy.requestId}</Table.Head></Table.Row></Table.Header>
              <Table.Body>
                {#each data.errorSamples as sample}
                  <Table.Row><Table.Cell class="whitespace-nowrap">{dateFormatter.format(new Date(sample.occurredAt))}</Table.Cell><Table.Cell>{sample.feature}</Table.Cell><Table.Cell>{sample.operation}</Table.Cell><Table.Cell><Badge variant={sample.outcome === "unknown" ? "outline" : "destructive"}>{label("outcomes", sample.outcome)}</Badge></Table.Cell><Table.Cell>{label("errorClasses", sample.errorClass)}</Table.Cell><Table.Cell class="font-mono text-xs">{sample.requestId}</Table.Cell></Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </AdminTableShell>
        {/if}
    </section>
