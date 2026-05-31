-- ============================================================
-- ClubBoost — Migration 004: Stripe Connect & Ledger Completion
--
-- Builds on 002_complete_schema.sql to add:
--   1. webhook_events  — idempotency deduplication table
--   2. payments        — idempotency_key, stripe_application_fee_id
--   3. payouts         — make club_id nullable, add initiated_by
--   4. ledger_type     — add MVP ledger category values
--   5. payout_type     — add 'refund' value (for refund ledger rows)
--   6. RLS policies    — payment_ledger, refunds, payouts, platform_fees
--                        (002 enabled RLS but didn't add policies)
--   7. Indexes
-- ============================================================


-- ============================================================
-- 1. WEBHOOK EVENTS — idempotency deduplication
-- ============================================================
-- Every incoming Stripe event is recorded here before processing.
-- If a Stripe-Event-Id already exists we skip all processing.
-- Allows safe Stripe webhook retries.

CREATE TABLE IF NOT EXISTS public.webhook_events (
  stripe_event_id  TEXT PRIMARY KEY,
  event_type       TEXT        NOT NULL,
  livemode         BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload          JSONB       NOT NULL DEFAULT '{}'::JSONB
);

COMMENT ON TABLE public.webhook_events IS
  'Deduplication log for incoming Stripe webhook events. Never delete rows.';


-- ============================================================
-- 2. PAYMENTS — additive columns
-- ============================================================

-- Idempotency key stored on the payment record; also sent to Stripe
-- as the Idempotency-Key header so duplicate POSTs are safely replayed.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

COMMENT ON COLUMN public.payments.idempotency_key IS
  'Idempotency key used when creating the Stripe Checkout Session. Format: pay_{entry_id}.';

-- Stripe application fee object ID (for reconciliation)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_application_fee_id TEXT;

COMMENT ON COLUMN public.payments.stripe_application_fee_id IS
  'Stripe Application Fee ID for Connect destination charges.';

-- Card brand (e.g. visa, mastercard) for display/receipts
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method_brand TEXT;


-- ============================================================
-- 3. PAYOUTS — make club_id nullable + add initiated_by
-- ============================================================
-- club_id was NOT NULL in 002, but prize payouts go to individual
-- winners (recipient_user_id), not a club.

ALTER TABLE public.payouts
  ALTER COLUMN club_id DROP NOT NULL;

-- initiated_by: platform admin or system actor who created the payout
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.payouts.initiated_by IS
  'Platform admin who initiated this payout (NULL = system-created on settlement).';

-- cancelled_at for audit trail when payout is cancelled
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id);


-- ============================================================
-- 4. LEDGER TYPE — add MVP category values
-- ============================================================
-- Adds the full set of categories used in payment_ledger rows.
-- Old values ('entry_payment', 'prize_payout', 'club_fundraising',
-- 'platform_fee', 'weekly_boost_contribution') remain for compat.

DO $$ BEGIN
  ALTER TYPE public.ledger_type ADD VALUE IF NOT EXISTS 'entry_gross';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.ledger_type ADD VALUE IF NOT EXISTS 'donation_gross';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.ledger_type ADD VALUE IF NOT EXISTS 'platform_service_fee';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.ledger_type ADD VALUE IF NOT EXISTS 'payment_processing_fee';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.ledger_type ADD VALUE IF NOT EXISTS 'club_fundraising_amount';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.ledger_type ADD VALUE IF NOT EXISTS 'prize_pool_allocation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.ledger_type ADD VALUE IF NOT EXISTS 'clubboost_weekly_contribution';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.ledger_type ADD VALUE IF NOT EXISTS 'payout';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 5. PAYOUT TYPE — add refund value (for ledger rows on refund)
-- ============================================================

DO $$ BEGIN
  ALTER TYPE public.payout_type ADD VALUE IF NOT EXISTS 'refund';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 6. RLS POLICIES
-- ============================================================
-- 002 enabled RLS on payment_ledger, refunds, payouts, platform_fees
-- but never created any policies. Add them now.

-- ── payment_ledger ───────────────────────────────────────────

CREATE POLICY "ledger: participant reads own" ON public.payment_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ledger: club admin reads own club" ON public.payment_ledger
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));

CREATE POLICY "ledger: platform admin reads all" ON public.payment_ledger
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- Only the service role (server-side) writes ledger rows
-- (No INSERT/UPDATE/DELETE policies for authenticated role)


-- ── refunds ──────────────────────────────────────────────────

CREATE POLICY "refunds: participant reads own" ON public.refunds
  FOR SELECT TO authenticated
  USING (
    initiated_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = refunds.payment_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "refunds: club admin reads own competition" ON public.refunds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.competitions c ON c.id = p.competition_id
      WHERE p.id = refunds.payment_id AND is_club_admin(c.club_id)
    )
  );

CREATE POLICY "refunds: platform admin reads all" ON public.refunds
  FOR SELECT TO authenticated
  USING (is_platform_admin());


-- ── payouts ──────────────────────────────────────────────────

CREATE POLICY "payouts: recipient reads own prize" ON public.payouts
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "payouts: club admin reads own" ON public.payouts
  FOR SELECT TO authenticated
  USING (club_id IS NOT NULL AND is_club_admin(club_id));

CREATE POLICY "payouts: platform admin reads all" ON public.payouts
  FOR SELECT TO authenticated
  USING (is_platform_admin());


-- ── platform_fees ─────────────────────────────────────────────

CREATE POLICY "platform_fees: platform admin reads all" ON public.platform_fees
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY "platform_fees: club admin reads own" ON public.platform_fees
  FOR SELECT TO authenticated
  USING (is_club_admin(club_id));


-- ── webhook_events — no user access ────────────────────────────
-- webhook_events has no RLS; only service role reads/writes it

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events: platform admin reads" ON public.webhook_events
  FOR SELECT TO authenticated
  USING (is_platform_admin());


-- ============================================================
-- 7. INDEXES
-- ============================================================

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id        ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_competition_id  ON public.payments (competition_id);
CREATE INDEX IF NOT EXISTS idx_payments_status          ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON public.payments (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- payment_ledger
CREATE INDEX IF NOT EXISTS idx_ledger_payment_id    ON public.payment_ledger (payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_competition_id ON public.payment_ledger (competition_id);
CREATE INDEX IF NOT EXISTS idx_ledger_club_id        ON public.payment_ledger (club_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user_id        ON public.payment_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type           ON public.payment_ledger (ledger_type);

-- refunds
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status      ON public.refunds (status);

-- payouts
CREATE INDEX IF NOT EXISTS idx_payouts_competition_id ON public.payouts (competition_id);
CREATE INDEX IF NOT EXISTS idx_payouts_club_id        ON public.payouts (club_id) WHERE club_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payouts_status         ON public.payouts (status);

-- platform_fees
CREATE INDEX IF NOT EXISTS idx_platform_fees_payment_id   ON public.platform_fees (payment_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_period_month ON public.platform_fees (period_month);
