CREATE TABLE IF NOT EXISTS admin_roles (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role TEXT NOT NULL,
  granted_by TEXT,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT admin_roles_user_role_unique UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON admin_roles (user_id);

-- Migrate any existing single-role data from the admin_role column
INSERT INTO admin_roles (id, user_id, role, granted_by, note, created_at)
SELECT
  gen_random_uuid()::text,
  id,
  admin_role,
  'system',
  'Migrated from admin_role column',
  COALESCE(admin_added_at, created_at)
FROM users
WHERE role = 'admin' AND admin_role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
