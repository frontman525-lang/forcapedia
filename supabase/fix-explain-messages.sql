-- ============================================================
-- FIX: AI explain messages disappearing from chat
-- Run this once in Supabase SQL Editor
-- ============================================================

-- 1. ALTER the content column itself to support long text
--    (handles VARCHAR(n) column-level limit, not just CHECK constraints)
ALTER TABLE room_messages
  ALTER COLUMN content TYPE text;

-- 2. Drop ALL existing CHECK constraints on content
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'room_messages'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) LIKE '%content%'
  LOOP
    EXECUTE format('ALTER TABLE room_messages DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 3. Add updated content constraint: 1–12000 chars
ALTER TABLE room_messages
  ADD CONSTRAINT room_messages_content_check
  CHECK (char_length(content) BETWEEN 1 AND 12000);

-- 4. Drop ALL existing CHECK constraints on kind
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'room_messages'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) LIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE room_messages DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 5. Add updated kind constraint that includes 'explain'
ALTER TABLE room_messages
  ADD CONSTRAINT room_messages_kind_check
  CHECK (kind IN ('text', 'doubt', 'highlight', 'system', 'explain'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM   pg_constraint
WHERE  conrelid = 'room_messages'::regclass
  AND  contype  = 'c';
