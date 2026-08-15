-- Expand the append-only audit trail with account-security attribution.
ALTER TYPE "AuditAction" ADD VALUE 'account_sign_in';
ALTER TYPE "AuditAction" ADD VALUE 'account_sign_out';
ALTER TYPE "AuditAction" ADD VALUE 'account_profile_update';
ALTER TYPE "AuditAction" ADD VALUE 'account_link';
ALTER TYPE "AuditAction" ADD VALUE 'account_unlink';
ALTER TYPE "AuditAction" ADD VALUE 'account_delete';
ALTER TYPE "AuditAction" ADD VALUE 'account_passkey_create';
ALTER TYPE "AuditAction" ADD VALUE 'account_passkey_update';
ALTER TYPE "AuditAction" ADD VALUE 'account_passkey_delete';
ALTER TYPE "AuditAction" ADD VALUE 'account_session_revoke';
ALTER TYPE "AuditAction" ADD VALUE 'account_calendar_token_rotate';
ALTER TYPE "AuditAction" ADD VALUE 'oauth_authorization_grant';
ALTER TYPE "AuditAction" ADD VALUE 'oauth_authorization_update';
ALTER TYPE "AuditAction" ADD VALUE 'oauth_authorization_revoke';
ALTER TYPE "AuditAction" ADD VALUE 'admin_user_role_update';
ALTER TYPE "AuditAction" ADD VALUE 'admin_oauth_client_create';
ALTER TYPE "AuditAction" ADD VALUE 'admin_oauth_client_delete';

CREATE TYPE "AuditOutcome" AS ENUM ('success', 'denied', 'failure');
CREATE TYPE "AuditChannel" AS ENUM (
  'web',
  'rest',
  'graphql',
  'mcp',
  'auth',
  'webhook',
  'system'
);

ALTER TABLE "AuditLog"
  ADD COLUMN "outcome" "AuditOutcome" NOT NULL DEFAULT 'success',
  ADD COLUMN "channel" "AuditChannel" NOT NULL DEFAULT 'web',
  ADD COLUMN "subjectUserId" TEXT,
  ADD COLUMN "oauthClientId" TEXT,
  ADD COLUMN "oauthGrantId" TEXT,
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "requestId" TEXT;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_subjectUserId_createdAt_id_idx"
  ON "AuditLog"("subjectUserId", "createdAt", "id");
CREATE INDEX "AuditLog_subjectUserId_oauthClientId_createdAt_id_idx"
  ON "AuditLog"("subjectUserId", "oauthClientId", "createdAt", "id");
CREATE INDEX "AuditLog_oauthClientId_createdAt_idx"
  ON "AuditLog"("oauthClientId", "createdAt");
