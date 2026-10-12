/**
 * The audit columns these cases compare. Identifiers and timestamps are left
 * out because they differ per run; `metadata` carries whatever else the entry
 * recorded.
 */
export const auditLogProjection = {
  action: true,
  outcome: true,
  channel: true,
  userId: true,
  subjectUserId: true,
  targetId: true,
  targetType: true,
  oauthClientId: true,
  oauthGrantId: true,
  sessionId: true,
  metadata: true,
} as const;
