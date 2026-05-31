-- ============================================================
-- Migration 005 — Notification & unsubscribe system
-- ============================================================

-- ── Notification log ─────────────────────────────────────────
-- Every email we attempt to send gets a row here, regardless of
-- whether it succeeded. This gives us a full audit trail and
-- enables retry of failed sends without re-triggering business
-- logic.

create type notification_status as enum ('pending', 'sent', 'failed', 'skipped');
create type notification_category as enum ('transactional', 'marketing');

create table notifications (
  id                uuid        primary key default gen_random_uuid(),
  -- The recipient. user_id may be null when emailing non-registered
  -- addresses (e.g. platform-admin contact addresses).
  user_id           uuid        references auth.users(id) on delete set null,
  to_email          text        not null,
  to_name           text,
  notification_type text        not null,
  category          notification_category not null default 'transactional',
  subject           text        not null,
  -- Template variables stored so we can re-render on retry
  template_data     jsonb       not null default '{}',
  status            notification_status not null default 'pending',
  -- Provider details (populated after attempted send)
  provider          text,                    -- 'resend', 'console', etc.
  provider_message_id text,                  -- ID returned by email provider
  error_message     text,
  -- Retry bookkeeping
  retry_count       int         not null default 0,
  max_retries       int         not null default 3,
  next_retry_at     timestamptz,
  -- Timestamps
  sent_at           timestamptz,
  failed_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- index for the retry worker
create index idx_notifications_retry
  on notifications (status, next_retry_at)
  where status = 'failed';

-- index for user notification history
create index idx_notifications_user
  on notifications (user_id, created_at desc)
  where user_id is not null;

comment on table notifications is
  'Log of every outbound email. Acts as queue (pending/failed) and audit trail.';

-- ── Notification preferences ─────────────────────────────────
-- Users can opt out of marketing emails. Transactional emails
-- (payment receipts, refunds, etc.) are always sent.

create table notification_preferences (
  id               uuid    primary key default gen_random_uuid(),
  -- Keyed on user_id OR email — whichever we have at unsubscribe time.
  user_id          uuid    references auth.users(id) on delete cascade,
  email            text    not null,
  category         text    not null,   -- 'marketing' | 'fundraiser_updates' etc.
  unsubscribed     boolean not null default false,
  unsubscribed_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- An email address can only have one preference per category
  unique (email, category)
);

create index idx_notif_prefs_user
  on notification_preferences (user_id)
  where user_id is not null;

-- ── Unsubscribe tokens ────────────────────────────────────────
-- One-click unsubscribe links in marketing emails contain a token
-- that maps back to the user/email + category without requiring login.

create table unsubscribe_tokens (
  id         uuid    primary key default gen_random_uuid(),
  user_id    uuid    references auth.users(id) on delete cascade,
  email      text    not null,
  category   text    not null,
  token      text    not null unique default encode(gen_random_bytes(32), 'hex'),
  used_at    timestamptz,
  expires_at timestamptz not null default (now() + interval '1 year'),
  created_at timestamptz not null default now()
);

create index idx_unsub_tokens_token on unsubscribe_tokens (token);

-- ── Row level security ────────────────────────────────────────
-- Service role bypasses RLS. Regular users can only read their own rows.

alter table notifications           enable row level security;
alter table notification_preferences enable row level security;
alter table unsubscribe_tokens       enable row level security;

-- Authenticated users can read their own notifications
create policy "users_read_own_notifications"
  on notifications for select
  using (auth.uid() = user_id);

-- Authenticated users can read & update their own preferences
create policy "users_read_own_preferences"
  on notification_preferences for select
  using (auth.uid() = user_id);

create policy "users_update_own_preferences"
  on notification_preferences for update
  using (auth.uid() = user_id);

-- ── Trigger: updated_at ───────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Only create if not already present from prior migrations
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_notifications_updated_at'
  ) then
    create trigger trg_notifications_updated_at
      before update on notifications
      for each row execute function update_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_notif_prefs_updated_at'
  ) then
    create trigger trg_notif_prefs_updated_at
      before update on notification_preferences
      for each row execute function update_updated_at();
  end if;
end;
$$;
