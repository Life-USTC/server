export async function getSectionDetailUserId(request: Request) {
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  return (await getSessionFromHeaders(request.headers))?.user?.id ?? null;
}
