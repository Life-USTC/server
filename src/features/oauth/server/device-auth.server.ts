import { redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";

export async function requireDeviceUserId(
  request: Request,
  callbackUrl: string,
) {
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    throw redirect(303, buildSignInPageUrl(callbackUrl));
  }
  return session.user.id;
}
