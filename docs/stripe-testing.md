# Stripe Local Testing Guide

ClubBoost uses Stripe Checkout and Stripe Connect. This guide covers how to test the full payment flow locally using the Stripe CLI.

---

## 1. Prerequisites

```bash
# Install Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Log in with your Stripe account
stripe login
```

---

## 2. Environment setup

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

Key values to set:

| Variable | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (use `sk_test_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same page (use `pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Set by the Stripe CLI (step 3) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |

---

## 3. Forward webhooks with the Stripe CLI

Start your Next.js app first:

```bash
npm run dev
```

In a second terminal, start webhook forwarding:

```bash
stripe listen \
  --forward-to http://localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,checkout.session.expired,payment_intent.succeeded,payment_intent.payment_failed,account.updated,charge.refunded,refund.updated,application_fee.created
```

The CLI will print a webhook signing secret:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxx (^C to quit)
```

Copy this value into your `.env.local` as `STRIPE_WEBHOOK_SECRET`.

> **Restart your Next.js server** after updating `.env.local` to pick up the new secret.

---

## 4. Test card numbers

Use these in Stripe Checkout (no real money is charged in test mode):

| Scenario | Card number | Expiry | CVC |
|---|---|---|---|
| Successful payment | `4242 4242 4242 4242` | Any future date | Any 3 digits |
| Declined (generic) | `4000 0000 0000 0002` | Any future date | Any 3 digits |
| Declined (insufficient funds) | `4000 0000 0000 9995` | Any future date | Any 3 digits |
| 3D Secure (authentication required) | `4000 0025 0000 3155` | Any future date | Any 3 digits |
| Requires 3DS but will succeed | `4000 0027 6000 3184` | Any future date | Any 3 digits |

---

## 5. Test the full payment flow

### 5a. Entry payment (no Stripe Connect)

1. Create a club and a competition with an entry fee (e.g. £5.00 = 500 pence)
2. Enter the competition as a participant
3. Use card `4242 4242 4242 4242` to complete checkout
4. The CLI will print the webhook events as they arrive
5. Check the database: `payments.status` should be `succeeded`, `entries.status` should be `active`
6. Check `payment_ledger` — 5-6 rows should be recorded

### 5b. Entry payment with Stripe Connect (club receives funds)

1. Start Stripe Connect onboarding as a club admin:
   ```
   /dashboard/stripe → Connect with Stripe
   ```
2. In Stripe's test onboarding, use test data (any values work)
3. After onboarding, the `account.updated` webhook fires → `clubs.stripe_onboarded = true`
4. Now entry payments will use `transfer_data.destination` to route funds to the club

To simulate a Connect account using test mode:

```bash
# Create a test Express account directly via CLI
stripe accounts create \
  --type=express \
  --country=GB \
  --email=testclub@example.com
```

### 5c. Simulate webhook events manually

Trigger any event without going through checkout:

```bash
# Simulate a successful checkout session
stripe trigger checkout.session.completed

# Simulate a refund
stripe trigger charge.refunded

# Simulate Connect account onboarding
stripe trigger account.updated
```

---

## 6. Test idempotency

### Duplicate webhook test

Send the same event twice to verify the `webhook_events` deduplication works:

```bash
# Get a recent event ID from the CLI output (e.g. evt_xxxxx)
stripe events resend evt_xxxxx
stripe events resend evt_xxxxx  # second send — should be skipped
```

Check the logs — the second attempt should print `[webhook] Duplicate event, skipping`.

### Duplicate checkout session test

If the user closes the browser mid-checkout and retries, the same idempotency key (`pay_{entry_id}`) is sent to Stripe. Stripe returns the same session URL. To test:

```bash
# Look at your payment record
supabase → Table Editor → payments → find the row with idempotency_key = "pay_<entry_id>"
```

---

## 7. Test refunds

1. Complete a payment (status `succeeded`)
2. In the admin dashboard: `/admin/payments/{id}` → Issue refund
3. Check the CLI — `charge.refunded` event should fire
4. Check the database:
   - `refunds.status = succeeded`
   - `payments.status = refunded`
   - `entries.status = refunded`
   - `payment_ledger` — a `refund` credit row should be added

To simulate a refund directly via CLI:

```bash
# Get the charge ID from payments.stripe_charge_id
stripe refunds create --charge ch_xxxxxx
```

---

## 8. Test payouts

Payouts are manual in MVP — no Stripe Transfers are created automatically.

1. Settle a competition: `/dashboard/competitions/{id}/settle`
2. Check `/admin/payouts` — payout records in `pending_review` status
3. Click Approve → status moves to `processing`
4. Click Mark paid → enter a bank reference → status moves to `paid`
5. Check `payment_ledger` — a `payout` debit row should appear

---

## 9. Webhook event reference

| Event | Handler | What happens |
|---|---|---|
| `checkout.session.completed` | `handlePaymentSucceeded` | Payment → succeeded, entry → active, ledger rows written, boost contribution recorded |
| `checkout.session.expired` | `handlePaymentFailed` | Payment → failed, entry → pending_payment |
| `payment_intent.payment_failed` | `handlePaymentFailed` | As above |
| `payment_intent.succeeded` | (belt-and-suspenders) | Updates payment status if checkout event was missed |
| `account.updated` | `setStripeOnboarded` | Club → stripe_onboarded = true when charges_enabled |
| `charge.refunded` | `handleRefundWebhook` | Refund confirmed → payment → refunded, ledger row written |
| `refund.updated` | `handleRefundWebhook` | Refund status change (e.g. failed) |
| `application_fee.created` | (records fee ID) | Stores Stripe application fee ID on payment |

---

## 10. Stripe Dashboard links (test mode)

- Payments: https://dashboard.stripe.com/test/payments
- Connected accounts: https://dashboard.stripe.com/test/connect/accounts
- Events log: https://dashboard.stripe.com/test/events
- Webhook endpoints: https://dashboard.stripe.com/test/webhooks

---

## 11. Common issues

**Webhook signature invalid**
- Ensure `STRIPE_WEBHOOK_SECRET` matches the secret printed by `stripe listen`
- Check the webhook secret hasn't expired (re-run `stripe listen` to get a new one)
- Ensure you restarted Next.js after updating `.env.local`

**Payment succeeds but entry stays pending_payment**
- Check the Stripe CLI output for errors
- Check the server logs for `[payment]` log lines
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly

**Connect onboarding redirect loops**
- Ensure `NEXT_PUBLIC_APP_URL` is set to `http://localhost:3000`
- In Stripe test onboarding, fill in all required fields
