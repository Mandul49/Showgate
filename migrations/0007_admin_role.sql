ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_added_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_added_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

UPDATE users
SET role = 'admin', admin_role = 'super_admin'
WHERE email = 'manduljohnson@gmail.com';
