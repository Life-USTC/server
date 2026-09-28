/** Called inside the same serializable transaction as the role update. */
export async function getAdminDemotionFailure(
  reader: {
    user: { count(input: { where: { isAdmin: true } }): Promise<number> };
  },
  actorId: string,
  targetId: string,
) {
  if (actorId === targetId) return "cannot_demote_self" as const;
  const adminCount = await reader.user.count({ where: { isAdmin: true } });
  return adminCount <= 1 ? ("cannot_remove_last_admin" as const) : null;
}
