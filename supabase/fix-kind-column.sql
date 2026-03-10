-- Force the kind column to plain text (handles ENUM type AND any CHECK constraints)
-- This is the definitive fix if previous migrations didn't work

-- Step 1: Convert kind column from ENUM (or any type) to plain text
ALTER TABLE room_messages
  ALTER COLUMN kind TYPE text USING kind::text;

-- Step 2: Drop any CHECK constraints on kind
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

-- Step 3: Add updated constraint that includes 'explain'
ALTER TABLE room_messages
  ADD CONSTRAINT room_messages_kind_check
  CHECK (kind IN ('text', 'doubt', 'highlight', 'system', 'explain'));

-- Verify: should show both content_check and kind_check with 'explain' included
SELECT conname, pg_get_constraintdef(oid)
FROM   pg_constraint
WHERE  conrelid = 'room_messages'::regclass AND contype = 'c';
