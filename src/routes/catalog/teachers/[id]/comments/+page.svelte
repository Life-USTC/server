<script lang="ts">
import CatalogDetailPage from "@/features/catalog/components/CatalogDetailPage.svelte";
import LazyCommentsPanel from "@/features/comments/components/LazyCommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CatalogDetailPage {data}>
  <section id="comments" data-detail-tab="comments" class="scroll-mt-4">
    {#key `comments:teacher:${data.teacher.id}`}
      <LazyCommentsPanel
        initialData={data.commentsData}
        permalinkBaseHref={commentTargetPermalinkBaseHref({
          teacherId: data.teacher.id,
          type: "teacher",
        })}
        targetType="teacher"
        targetId={data.teacher.id}
        heading={data.copy.comments.title}
        copy={data.copy.comments}
        readOnlyReason={data.demo?.readOnlyReason}
      />
    {/key}
  </section>
</CatalogDetailPage>
