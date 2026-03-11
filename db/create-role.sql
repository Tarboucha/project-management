-- ============================================================
-- Create the restricted application role (ppm_app)
-- ============================================================
-- Run this BEFORE loading schema.sql.
-- The schema dump applies GRANTs/REVOKEs to this role.
--
-- Change the password below before running.
-- ============================================================

CREATE ROLE ppm_app WITH LOGIN PASSWORD 'Test1234';
