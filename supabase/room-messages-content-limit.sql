-- Fix: raise room_messages content length limit to support explain/AI messages
-- The original constraint allowed only 500 chars; explain messages (JSON with
-- selectedText + full AI explanation) easily exceed this → 500 errors on insert.

-- Step 1: drop the old unnamed inline check constraint
-- PostgreSQL auto-names inline CHECK constraints as <table>_<col>_check
ALTER TABLE room_messages
  DROP CONSTRAINT IF EXISTS room_messages_content_check;

-- Step 2: also try the alternative auto-generated name pattern
DO $$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM   pg_constraint
  WHERE  conrelid = 'room_messages'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%char_length(content)%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE room_messages DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

-- Step 3: add new constraint — 1 to 12000 chars
ALTER TABLE room_messages
  ADD CONSTRAINT room_messages_content_check
  CHECK (char_length(content) BETWEEN 1 AND 12000);
