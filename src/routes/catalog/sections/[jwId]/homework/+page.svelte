<script lang="ts">
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import SignInButton from "#lib/components/SignInButton.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { detailPageModule } from "@/features/section-detail/lib/detail-page-module.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
const module = detailPageModule(
  () =>
    import("@/features/section-detail/components/SectionHomeworkTab.svelte"),
);
const SectionHomeworkTab = $derived(module.component);
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, sectionCopy, fmtDateTime, viewer, canWriteHomework, openHomeworkAuditDialog, openCreateHomeworkDialog, homeworkCopy, homeworks, setSelectedHomework })}
    <section id="homework" data-detail-tab="homework" class="scroll-mt-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold tracking-tight">
          {sectionCopy.tabs.homeworks}
        </h2>
        <div class="flex flex-wrap items-center gap-2">
        {#if !data.demo && !viewer.loading && !viewer.failed && (viewer.isAuthenticated ?? viewer.signedIn === true)}
          <Button type="button" variant="outline" class="min-h-11 sm:min-h-9 md:min-h-9" onclick={openHomeworkAuditDialog}>{homeworkCopy.auditTitle}</Button>
        {/if}
        {#if data.demo}
          <Button type="button" disabled title={data.demo.readOnlyReason}>{homeworkCopy.showCreate}</Button>
        {:else if canWriteHomework}
          <Button type="button" onclick={openCreateHomeworkDialog}>
            {homeworkCopy.showCreate}
          </Button>
        {:else if !viewer.loading && !viewer.failed && !(viewer.isAuthenticated ?? viewer.signedIn === true)}
          <SignInButton
            variant="outline"
          >
            {homeworkCopy.loginToCreate}
          </SignInButton>
        {/if}
        </div>
      </div>
      {#if SectionHomeworkTab}
        <SectionHomeworkTab
          fmtDateTime={fmtDateTime}
          homeworkCopy={homeworkCopy}
          homeworks={homeworks}
          locale={data.locale}
          showPersonalStatus={!data.demo && !viewer.loading && !viewer.failed && (viewer.isAuthenticated ?? viewer.signedIn === true)}
          sectionCopy={sectionCopy}
          selectHomework={setSelectedHomework}
        />
      {:else}
        <LazyModuleStatus failed={module.failed} heading={sectionCopy.tabs.homeworks} loadFailed={data.copy.common.error} retry={sectionCopy.pleaseRetry} onRetry={module.retry} />
      {/if}
    </section>
  {/snippet}
</SectionDetailRoute>
