-- Create an initial admin user.
-- Requires the pgcrypto extension (enabled by default on Supabase).
--
-- Usage:
--   Run this AFTER loading schema.sql.
--   Change the values below to match your desired admin account.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.actor (first_name, last_name, email, password_hash, system_role)
VALUES (
  'Admin',
  'User',
  'admin@ppm.local',
  crypt('admin1234', gen_salt('bf', 12)),
  'ADMIN'
);
