-- ─── PayPal / Multi-Provider Payment Migration ────────────────────────────────
--
-- Run this in Supabase SQL Editor (or via supabase db push).
-- Safe to run multiple times — uses IF NOT EXISTS / DO blocks.
--
-- What this adds:
--   subscriptions:   payment_provider, provider_sub_id  (generic columns)
--   payment_events:  payment_provider, provider_sub_id, payment_id
--   cashfree_plan_id: made nullable (PayPal subscriptions don't have a CF plan)
--
-- Existing Cashfree data is backfilled automatically.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. subscriptions table
-- ══════════════════════════════════════════════════════════════════════════════

-- Add generic provider columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'cashfree',
  ADD COLUMN IF NOT EXISTS provider_sub_id  text;

-- Make cashfree_plan_id nullable so PayPal rows don't need a fake CF plan ID
ALTER TABLE public.subscriptions
  ALTER COLUMN cashfree_plan_id DROP NOT NULL;

-- Backfill provider_sub_id from cashfree_sub_id for all existing Cashfree rows
UPDATE public.subscriptions
SET    provider_sub_id = cashfree_sub_id
WHERE  provider_sub_id IS NULL
  AND  cashfree_sub_id IS NOT NULL;

-- Index: all webhook lookups go through provider_sub_id
CREATE INDEX IF NOT EXISTS subscriptions_provider_sub_id_idx
  ON public.subscriptions (provider_sub_id);

-- Index: filter by provider (useful for analytics / admin queries)
CREATE INDEX IF NOT EXISTS subscriptions_payment_provider_idx
  ON public.subscriptions (payment_provider);


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. payment_events table
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'cashfree',
  ADD COLUMN IF NOT EXISTS provider_sub_id  text,
  ADD COLUMN IF NOT EXISTS payment_id       text;

-- Backfill from legacy Cashfree-specific columns
UPDATE public.payment_events
SET    provider_sub_id = cashfree_sub_id,
       payment_id      = cf_payment_id
WHERE  provider_sub_id IS NULL;

-- Index for audit queries by subscription
CREATE INDEX IF NOT EXISTS payment_events_provider_sub_id_idx
  ON public.payment_events (provider_sub_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. RLS policies — extend existing policies to cover new columns
-- ══════════════════════════════════════════════════════════════════════════════
-- (Existing RLS policies filter by user_id, which is unchanged — no action needed)


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Verification
-- ══════════════════════════════════════════════════════════════════════════════
-- After running, verify with:
--   SELECT column_name, data_type, is_nullable
--   FROM   information_schema.columns
--   WHERE  table_name = 'subscriptions'
--   ORDER  BY ordinal_position;
