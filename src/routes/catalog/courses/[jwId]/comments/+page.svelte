<script lang="ts">
import CatalogDetailPage from "@/features/catalog/components/CatalogDetailPage.svelte";
import LazyCommentsPanel from "@/features/comments/components/LazyCommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CatalogDetailPage {data}>
  <section id="comments" data-detail-tab="comments" class="scroll-mt-4">
    {#key `comments:course:${data.course.id}`}
      <LazyCommentsPanel
        initialData={data.commentsData}
        permalinkBaseHref={commentTargetPermalinkBaseHref({
          courseJwId: data.course.jwId,
          type: "course",
        })}
        targetType="course"
        targetId={data.course.id}
        heading={data.copy.courseDetail.tabs.comments}
        copy={data.copy.comments}
        readOnlyReason={data.demo?.readOnlyReason}
      />
    {/key}
  </section>
</CatalogDetailPage>
