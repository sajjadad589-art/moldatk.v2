-- Secure passkey support for Moldatk saved-account quick login.
-- Tables are service-role only; browser clients never read private credential material directly.

create table if not exists public.moldatk_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}'::text[],
  device_label text,
  rp_id text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists moldatk_passkeys_user_idx
  on public.moldatk_passkeys(user_id, rp_id, created_at desc);

alter table public.moldatk_passkeys enable row level security;

create table if not exists public.moldatk_webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('registration','authentication')),
  challenge text not null,
  rp_id text not null,
  origin text not null,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists moldatk_webauthn_challenges_lookup_idx
  on public.moldatk_webauthn_challenges(user_id, purpose, expires_at desc);

alter table public.moldatk_webauthn_challenges enable row level security;

revoke all on table public.moldatk_passkeys from anon, authenticated;
revoke all on table public.moldatk_webauthn_challenges from anon, authenticated;
