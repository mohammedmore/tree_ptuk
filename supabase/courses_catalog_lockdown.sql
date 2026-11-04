-- ============================================================================
-- Complete Catalog Row Level Security (RLS) & Access Control Lockdown
-- Protects university courses, sections, and schedule blocks against unauthorized
-- tampering, deletion, or injection from client-side anon/authenticated roles.
-- ============================================================================

BEGIN;

-- 1. Enable RLS on catalog tables
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.section_blocks ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy or overly permissive policies if any exist
DROP POLICY IF EXISTS "Public read-only on courses" ON public.courses;
DROP POLICY IF EXISTS "Public read-only on sections" ON public.sections;
DROP POLICY IF EXISTS "Public read-only on section_blocks" ON public.section_blocks;
DROP POLICY IF EXISTS "Anyone can modify courses" ON public.courses;
DROP POLICY IF EXISTS "Anyone can modify sections" ON public.sections;
DROP POLICY IF EXISTS "Anyone can modify section_blocks" ON public.section_blocks;

-- 3. Create read-only policies for public/anon/authenticated clients
CREATE POLICY "Public read-only on courses"
  ON public.courses
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read-only on sections"
  ON public.sections
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read-only on section_blocks"
  ON public.section_blocks
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Revoke write permissions from public, anon, and authenticated
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.courses FROM public, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sections FROM public, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.section_blocks FROM public, anon, authenticated;

-- 5. Grant read permissions
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT SELECT ON public.sections TO anon, authenticated;
GRANT SELECT ON public.section_blocks TO anon, authenticated;

-- 6. Ensure full privileges for service_role (backend synchronizer)
GRANT ALL ON public.courses TO service_role;
GRANT ALL ON public.sections TO service_role;
GRANT ALL ON public.section_blocks TO service_role;

-- 7. Notify PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
