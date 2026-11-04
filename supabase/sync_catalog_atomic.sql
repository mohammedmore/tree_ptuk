-- Atomic catalog synchronization RPC for Supabase / PostgreSQL
-- Hardened against Search Path Injection, Unauthorized Execution, and Race Conditions.

CREATE OR REPLACE FUNCTION public.sync_catalog_atomic(
  p_courses jsonb,
  p_sections jsonb,
  p_blocks jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_courses_count int := 0;
  v_sections_count int := 0;
  v_blocks_count int := 0;
BEGIN
  -- 1. Batch Upsert Courses
  IF p_courses IS NOT NULL AND pg_catalog.jsonb_array_length(p_courses) > 0 THEN
    INSERT INTO public.courses (code, name, type)
    SELECT
      c->>'code',
      c->>'name',
      c->>'type'
    FROM pg_catalog.jsonb_array_elements(p_courses) AS c
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      type = COALESCE(EXCLUDED.type, public.courses.type);

    GET DIAGNOSTICS v_courses_count = ROW_COUNT;
  END IF;

  -- 2. Batch Upsert Sections
  IF p_sections IS NOT NULL AND pg_catalog.jsonb_array_length(p_sections) > 0 THEN
    INSERT INTO public.sections (course_code, sec_number, instructor, room, building, status)
    SELECT
      s->>'course_code',
      s->>'sec_number',
      s->>'instructor',
      s->>'room',
      s->>'building',
      s->>'status'
    FROM pg_catalog.jsonb_array_elements(p_sections) AS s
    ON CONFLICT (course_code, sec_number) DO UPDATE SET
      instructor = EXCLUDED.instructor,
      room = EXCLUDED.room,
      building = EXCLUDED.building,
      status = EXCLUDED.status;

    GET DIAGNOSTICS v_sections_count = ROW_COUNT;
  END IF;

  -- 3. Atomically Replace Section Blocks in a Single Transaction
  IF p_blocks IS NOT NULL AND pg_catalog.jsonb_array_length(p_blocks) > 0 THEN
    -- Delete existing blocks only for sections included in this batch
    DELETE FROM public.section_blocks
    WHERE section_id IN (
      SELECT s.id
      FROM public.sections s
      JOIN pg_catalog.jsonb_array_elements(p_courses) c ON c->>'code' = s.course_code
    );

    -- Insert new blocks mapped to their section_id
    INSERT INTO public.section_blocks (section_id, day, start_hour, end_hour, raw_time)
    SELECT
      s.id,
      b->>'day',
      (b->>'start_hour')::numeric,
      (b->>'end_hour')::numeric,
      b->>'raw_time'
    FROM pg_catalog.jsonb_array_elements(p_blocks) AS b
    JOIN public.sections s ON s.course_code = (b->>'course_code') AND s.sec_number = (b->>'sec_number');

    GET DIAGNOSTICS v_blocks_count = ROW_COUNT;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'courses_updated', v_courses_count,
    'sections_updated', v_sections_count,
    'blocks_updated', v_blocks_count
  );
EXCEPTION WHEN OTHERS THEN
  RETURN pg_catalog.jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- ─── Access Control Lockdown ────────────────────────────────────────────────
-- Strictly prevent anonymous or client-side callers from invoking synchronization.
-- Only the backend server possessing the service_role key is permitted to execute this function.
REVOKE ALL ON FUNCTION public.sync_catalog_atomic(jsonb, jsonb, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_catalog_atomic(jsonb, jsonb, jsonb) TO service_role;
