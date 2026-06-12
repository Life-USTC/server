<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import DeviceApprovalPanel from "./DeviceApprovalPanel.svelte";
import DeviceCodeForm from "./DeviceCodeForm.svelte";
import DeviceErrorPanel from "./DeviceErrorPanel.svelte";
import DeviceResultPanel from "./DeviceResultPanel.svelte";
import DeviceSidePanel from "./DeviceSidePanel.svelte";
import type {
  DeviceApprovalRequest,
  DeviceCopy,
} from "./device-component-types";

type OAuthDevicePageData = {
  code?: string;
  copy: DeviceCopy;
  reason?: string;
  request?: DeviceApprovalRequest;
  result?: string;
  state: string;
  status?: string;
  title?: string;
};

export let data: OAuthDevicePageData;

let pendingDecision: "approve" | "deny" | null = null;
let deviceResult: "approved" | "denied" = "denied";

function deviceDecisionAction(decision: "approve" | "deny"): SubmitFunction {
  return () => {
    pendingDecision = decision;
    return async ({ update }) => {
      try {
        await update({ reset: false });
      } finally {
        pendingDecision = null;
      }
    };
  };
}

$: approvalRequest = data.state === "approval" ? data.request : null;
$: deviceResult = data.result === "approved" ? "approved" : "denied";
$: sideNoteLabel = approvalRequest
  ? data.copy.deviceRequestedPermissions
  : data.copy.deviceCodeLabel;
</script>

<svelte:head><title>{data.copy.deviceTitle} - Life@USTC</title></svelte:head>

<section class="mx-auto grid w-full max-w-4xl gap-6 py-8">
  <PageHeader title={data.copy.deviceTitle} description={data.copy.deviceCodeHint} eyebrow="OAuth" />

  <div class="grid overflow-hidden rounded-md border border-base-300 bg-base-100 shadow-sm lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <DeviceSidePanel deviceTitle={data.copy.deviceTitle} {sideNoteLabel} />

    <Card.Root class="border-0 shadow-none">
      <Card.Content class="grid gap-5 p-6">
        {#if data.state === "result"}
          <DeviceResultPanel copy={data.copy} result={deviceResult} />
        {:else if data.state === "error"}
          <DeviceErrorPanel
            copy={data.copy}
            reason={data.reason}
            status={data.status}
            title={data.title ?? data.copy.deviceTitle}
          />
        {:else if data.state === "approval" && approvalRequest}
          <DeviceApprovalPanel
            {approvalRequest}
            copy={data.copy}
            {deviceDecisionAction}
            {pendingDecision}
          />
        {:else}
          <DeviceCodeForm code={data.code ?? ""} copy={data.copy} />
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</section>
