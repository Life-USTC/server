<script lang="ts">
import TeacherDetailPageController from "@/features/catalog/components/TeacherDetailPageController.svelte";
import LazyCommentsPanel from "@/features/comments/components/LazyCommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<TeacherDetailPageController {data}>
  {#snippet content({ data, copy })}
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
          heading={copy.comments.title}
          copy={copy.comments}
          readOnlyReason={data.demo?.readOnlyReason}
        />
      {/key}
    </section>
  {/snippet}
</TeacherDetailPageController>
