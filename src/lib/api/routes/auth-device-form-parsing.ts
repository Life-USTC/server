import { deviceAuthJsonError } from "@/lib/api/routes/auth-device-authorization-helpers";
import { logOAuthDebug } from "@/lib/log/oauth-debug";

export async function parseDeviceAuthorizationForm(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    logOAuthDebug("device-auth.reject", request, {
      reason: "invalid_form_body",
    });
    return {
      response: deviceAuthJsonError(
        400,
        "invalid_request",
        "Request body must be application/x-www-form-urlencoded",
      ),
    };
  }

  const clientId = formData.get("client_id");
  const scope = formData.get("scope");

  if (!clientId || typeof clientId !== "string") {
    logOAuthDebug("device-auth.reject", request, {
      reason: "missing_client_id",
    });
    return {
      response: deviceAuthJsonError(
        400,
        "invalid_request",
        "client_id is required",
      ),
    };
  }

  return { clientId, scope };
}
