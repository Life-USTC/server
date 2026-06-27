-- Minimal dev seed. Feature parity with the legacy 1600-line seeder is not required.
-- This seed creates only the two canonical dev users used by E2E debug auth.

INSERT INTO "User" (id, email, name, username, image, "isAdmin", "createdAt", "updatedAt")
VALUES
  ('dev_user_cuid_001', 'debug@debug.local', 'Dev User', 'dev-user', 'https://api.dicebear.com/7.x/avataaars/svg?seed=life-ustc-dev-user', false, NOW(), NOW()),
  ('dev_admin_cuid_002', 'admin@debug.local', '校园管理员', 'dev-admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=life-ustc-admin', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
