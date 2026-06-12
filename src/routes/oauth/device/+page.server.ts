import {
  completeDeviceCodeDecision,
  getDeviceCopy,
  loadDeviceApprovalState,
} from "@/features/oauth/server/device-page.server";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request, url }) => {
  const copy = getDeviceCopy(locals.locale);
  const code = url.searchParams.get("code");
  const step = url.searchParams.get("step");
  const result = url.searchParams.get("result");
  const reason = url.searchParams.get("reason");

  if (result === "approved" || result === "denied") {
    return { state: "result", result, copy };
  }

  if (result === "error") {
    return {
      state: "error",
      title: copy.deviceErrorTitle,
      reason:
        reason === "missing_code" || reason === "invalid_or_expired"
          ? reason
          : "unknown",
      copy,
    };
  }

  if (code && step === "approve") {
    return loadDeviceApprovalState({
      code,
      copy,
      request,
      url,
    });
  }

  return { state: "form", code: code ?? "", copy };
};

export const actions: Actions = {
  approve: async ({ request }) => {
    await completeDeviceCodeDecision(
      request,
      await request.formData(),
      "approve",
    );
  },
  deny: async ({ request }) => {
    await completeDeviceCodeDecision(request, await request.formData(), "deny");
  },
};
