-- ============================================================
-- URBAN INTEL — Supabase schema setup
-- Paste this whole file into  Supabase Dashboard → SQL Editor → Run
-- (only needs to be run ONCE per Supabase project)
-- ============================================================

-- USERS ------------------------------------------------------
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  name            text not null,
  phone           text,
  role            text not null check (role in ('citizen','agency','admin')),
  agency_type     text check (agency_type in ('Ambulance','Fire','Police')),
  reputation      int  not null default 0,
  hashed_password text not null,
  created_at      timestamptz not null default now()
);
create index if not exists users_email_idx on public.users (email);

-- INCIDENTS --------------------------------------------------
create table if not exists public.incidents (
  id                  uuid primary key default gen_random_uuid(),
  citizen_id          uuid not null,
  citizen_name        text not null,
  citizen_phone       text,
  description         text not null,
  severity            text not null check (severity in ('Low','Medium','High')),
  final_severity      text not null check (final_severity in ('Low','Medium','High')),
  service             text not null check (service in ('Ambulance','Fire','Police')),
  recommended_services jsonb not null default '[]'::jsonb,
  latitude            double precision not null,
  longitude           double precision not null,
  address             text,
  image_base64        text,
  is_sos              boolean not null default false,
  status              text not null default 'New'
                      check (status in ('New','Acknowledged','EnRoute','OnScene','Resolved')),
  ai_analysis         jsonb,
  assigned_agency_id  uuid,
  eta_minutes         int,
  responder_vehicle   text,
  last_position       jsonb,
  track               jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists incidents_status_idx     on public.incidents (status);
create index if not exists incidents_citizen_idx    on public.incidents (citizen_id);
create index if not exists incidents_created_at_idx on public.incidents (created_at desc);

-- RLS is intentionally OFF on these tables because the FastAPI
-- backend uses the SERVICE_ROLE key (bypasses RLS). All access
-- control is enforced inside FastAPI via JWT + role checks.
alter table public.users     disable row level security;
alter table public.incidents disable row level security;

-- ============================================================
-- DONE.  Restart the backend after running this once.
-- ============================================================
