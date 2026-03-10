-- Add provider_event_id to payment_events for webhook idempotency
-- This column stores the payment provider's unique event ID (e.g. Razorpay's
-- event_id, PayPal's event.id) so that duplicate webhook deliveries are
-- detected and skipped before any DB or tier changes are applied.
--
-- Run this once in Supabase SQL editor.

ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT;

-- Unique index so the idempotency SELECT is fast + race-condition-safe
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_event_id_idx
  ON public.payment_events (provider_event_id)
  WHERE provider_event_id IS NOT NULL;
