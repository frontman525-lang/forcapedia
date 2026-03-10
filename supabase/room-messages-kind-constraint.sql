-- Fix: ensure 'explain' is a valid kind in room_messages
-- Previously explains were ephemeral (never saved to DB), so 'explain' may be missing
-- from the kind CHECK constraint.

-- Step 1: drop existing kind constraint if any
DO $$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'room_messages'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) LIKE '%kind%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE room_messages DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

-- Step 2: add updated constraint that includes 'explain'
ALTER TABLE room_messages
  ADD CONSTRAINT room_messages_kind_check
  CHECK (kind IN ('text', 'doubt', 'highlight', 'system', 'explain'));
