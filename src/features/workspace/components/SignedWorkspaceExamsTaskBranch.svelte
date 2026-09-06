<script lang="ts">
import type {
  SignedWorkspaceData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import ExamsTab from "./ExamsTab.svelte";
import type {
  ExamMetadataLabels,
  ExamTimeLabel,
  NamePrimary,
  WorkspaceExamFilter,
  WorkspaceExamRow,
  WorkspaceTabHref,
} from "./workspace-exam-component-types";

type SignedWorkspaceExamData = SignedWorkspaceData & {
  subscriptions: NonNullable<SignedWorkspaceData["subscriptions"]>;
};

export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceTabHref;
export let examFilter: WorkspaceExamFilter;
export let examMetadataLabels: ExamMetadataLabels;
export let examRows: WorkspaceExamRow[];
export let examTimeLabel: ExamTimeLabel;
export let filteredExamRows: WorkspaceExamRow[];
export let locale: string;
export let namePrimary: NamePrimary;
export let sectionCopy: WorkspaceSectionCopy;
export let signedData: SignedWorkspaceExamData;
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;
</script>

<ExamsTab
  {workspaceCopy}
  {subscriptionsCopy}
  {sectionCopy}
  {signedData}
  {workspaceTabHref}
  {examTimeLabel}
  {examMetadataLabels}
  {namePrimary}
  {examRows}
  {filteredExamRows}
  {locale}
  bind:examFilter
/>
