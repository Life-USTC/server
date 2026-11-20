<script lang="ts">
import LazyCommentsPanel from "@/features/comments/components/LazyCommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import CourseDetailPageController from "@/features/catalog/components/CourseDetailPageController.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CourseDetailPageController {data}>
  {#snippet content({ data, copy })}
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
          heading={copy.courseDetail.tabs.comments}
          copy={copy.comments}
          readOnlyReason={data.demo?.readOnlyReason}
        />
      {/key}
    </section>
  {/snippet}
</CourseDetailPageController>
