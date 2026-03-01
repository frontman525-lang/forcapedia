-- ─── Forcapedia Payments Migration ──────────────────────────────────────────
-- Run in Supabase SQL editor after schema.sql
-- Creates: subscriptions table, adds phone to user_usage
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Subscriptions table — one row per Cashfree subscription
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cashfree identifiers
  cashfree_sub_id      text        UNIQUE,           -- Our subscription_id sent to Cashfree
  cf_sub_id            text,                         -- Cashfree's internal cf_subscription_id
  cashfree_plan_id     text        NOT NULL,         -- e.g. 'forcapedia_scholar_monthly'

  -- Plan metadata
  tier                 text        NOT NULL CHECK (tier IN ('tier1', 'tier2')),
  billing_cycle        text        NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount               numeric(10,2) NOT NULL,       -- Amount in plan currency
  currency             text        NOT NULL DEFAULT 'INR',

  -- Lifecycle
  status               text        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean     NOT NULL DEFAULT false,
  cancelled_at         timestamptz,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx
  ON public.subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS subscriptions_cashfree_sub_id_idx
  ON public.subscriptions (cashfree_sub_id);

-- 3. RLS — users can read their own subscriptions; only service role writes
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Payment events log — immutable audit trail of every webhook event
CREATE TABLE IF NOT EXISTS public.payment_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  cashfree_sub_id text,
  event_type     text        NOT NULL,   -- e.g. 'SUBSCRIPTION_ACTIVATED'
  cf_payment_id  text,                  -- Cashfree payment id (if applicable)
  amount         numeric(10,2),
  currency       text,
  raw_payload    jsonb,                  -- Full webhook body for debugging
  processed_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert; users can read their own for support
CREATE POLICY "users_read_own_payment_events"
  ON public.payment_events FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Add phone column to user_usage (needed for Cashfree mandate)
ALTER TABLE public.user_usage
  ADD COLUMN IF NOT EXISTS phone text;

-- 6. Helper: auto-update updated_at on subscriptions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
