-- Say on our own Postgres 16 (Hetzner, Germany). Replaces the Supabase project "MesaSay" during
-- the transition, until notes move to Farcaster. Same tables, same rules as
-- supabase/say/20261027000000_say.sql, plus the nullable "signed note" columns.
--
-- Two roles:
--   mesasays_owner  owns the tables and functions. Cannot log in. Used by migrations only
--                   (connect as the postgres superuser, or SET ROLE mesasays_owner).
--   mesasays_app    what the website logs in as (DATABASE_URL). It can only read published rows
--                   and call the four say_* functions. It cannot insert, edit or delete anything.
-- Moderation: as the postgres superuser, `update say_threads set status = 'hidden' where id = '...'`.
--
-- Apply (idempotent, safe to re-run):
--   sudo -u postgres psql -d mesasays -v ON_ERROR_STOP=1 -f schema.sql
-- then give the app role its password once (never stored in this repo):
--   sudo -u postgres psql -d mesasays -c "alter role mesasays_app password '...'"

\set ON_ERROR_STOP on
set client_min_messages = warning;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mesasays_owner') then
    create role mesasays_owner nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'mesasays_app') then
    create role mesasays_app login;
  end if;
end
$$;

-- Nobody but the owner creates objects here.
revoke create on schema public from public;
grant create, usage on schema public to mesasays_owner;
grant usage on schema public to mesasays_app;

-- Everything below is created by, and belongs to, the owner role.
set role mesasays_owner;

create table if not exists public.say_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text not null check (char_length(author) between 1 and 20),
  title text not null check (char_length(title) between 8 and 160),
  body text not null default '' check (char_length(body) <= 4000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  -- Signed notes (optional): who signed, the signature, when, and exactly what was signed.
  signer text,
  signature text,
  signed_at timestamptz,
  signed_payload jsonb,
  constraint say_threads_signed_together check ((signer is null) = (signature is null))
);

create table if not exists public.say_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.say_threads (id) on delete cascade,
  parent_id uuid references public.say_replies (id) on delete cascade,
  created_at timestamptz not null default now(),
  author text not null check (char_length(author) between 1 and 20),
  body text not null check (char_length(body) between 2 and 4000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  signer text,
  signature text,
  signed_at timestamptz,
  signed_payload jsonb,
  constraint say_replies_signed_together check ((signer is null) = (signature is null))
);

-- Which restaurant pages show a conversation.
create table if not exists public.say_links (
  thread_id uuid not null references public.say_threads (id) on delete cascade,
  restaurant_slug text not null check (restaurant_slug ~ '^[a-z0-9-]{1,80}$'),
  linked_by text not null default 'poster' check (linked_by in ('poster', 'team', 'ai')),
  created_at timestamptz not null default now(),
  primary key (thread_id, restaurant_slug)
);

-- A database created before the signed-notes columns existed gets them added.
alter table public.say_threads add column if not exists signer text;
alter table public.say_threads add column if not exists signature text;
alter table public.say_threads add column if not exists signed_at timestamptz;
alter table public.say_threads add column if not exists signed_payload jsonb;
alter table public.say_replies add column if not exists signer text;
alter table public.say_replies add column if not exists signature text;
alter table public.say_replies add column if not exists signed_at timestamptz;
alter table public.say_replies add column if not exists signed_payload jsonb;

create index if not exists say_threads_created_idx on public.say_threads (created_at desc);
create index if not exists say_replies_thread_idx on public.say_replies (thread_id, created_at);
create index if not exists say_links_slug_idx on public.say_links (restaurant_slug);

-- Read: published conversations only (same rules as the Supabase policies).
alter table public.say_threads enable row level security;
alter table public.say_replies enable row level security;
alter table public.say_links enable row level security;

drop policy if exists "read published threads" on public.say_threads;
create policy "read published threads" on public.say_threads
  for select to mesasays_app using (status = 'published');
drop policy if exists "read published replies" on public.say_replies;
create policy "read published replies" on public.say_replies
  for select to mesasays_app
  using (status = 'published' and exists (select 1 from public.say_threads t where t.id = thread_id and t.status = 'published'));
drop policy if exists "read links of published threads" on public.say_links;
create policy "read links of published threads" on public.say_links
  for select to mesasays_app
  using (exists (select 1 from public.say_threads t where t.id = thread_id and t.status = 'published'));

revoke all on public.say_threads, public.say_replies, public.say_links from public, mesasays_app;
grant select on public.say_threads, public.say_replies, public.say_links to mesasays_app;

-- Write: only through these functions. They run as the owner (security definer).

create or replace function public.say_post(p_author text, p_title text, p_body text default '', p_slug text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- Flood guard: the whole site accepts at most 20 new conversations a minute.
  if (select count(*) from say_threads where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many posts, try again in a minute';
  end if;
  insert into say_threads (author, title, body)
  values (trim(p_author), trim(p_title), coalesce(trim(p_body), ''))
  returning id into v_id;
  if p_slug is not null and p_slug <> '' then
    insert into say_links (thread_id, restaurant_slug) values (v_id, p_slug);
  end if;
  return v_id;
end;
$$;

create or replace function public.say_reply(p_thread uuid, p_parent uuid, p_author text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from say_threads where id = p_thread and status = 'published') then
    raise exception 'conversation not found';
  end if;
  if p_parent is not null and not exists (select 1 from say_replies where id = p_parent and thread_id = p_thread) then
    raise exception 'reply not found';
  end if;
  if (select count(*) from say_replies where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'too many replies, try again in a minute';
  end if;
  insert into say_replies (thread_id, parent_id, author, body)
  values (p_thread, p_parent, trim(p_author), trim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

-- Signed notes: same definitions as supabase/say/20261101000000_signed_notes.sql (single source of truth:
-- keep both in sync). The website checks the Ethereum signature before calling these; the database checks
-- that the stored columns say exactly what the signed message says. Older 8-argument drafts are dropped.
drop function if exists public.say_post_signed(text, text, text, text, text, text, timestamptz, jsonb);
drop function if exists public.say_reply_signed(uuid, uuid, text, text, text, text, timestamptz, jsonb);

-- The four columns go together: all empty (not signed) or all filled with something well formed.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'say_threads_signed_check') then
    alter table public.say_threads add constraint say_threads_signed_check check (
      (signer is null and signature is null and signed_at is null and signed_payload is null)
      or (signer ~ '^0x[0-9a-fA-F]{40}$' and signature ~ '^0x[0-9a-f]{130}$' and signed_at is not null and jsonb_typeof(signed_payload) = 'object')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'say_replies_signed_check') then
    alter table public.say_replies add constraint say_replies_signed_check check (
      (signer is null and signature is null and signed_at is null and signed_payload is null)
      or (signer ~ '^0x[0-9a-fA-F]{40}$' and signature ~ '^0x[0-9a-f]{130}$' and signed_at is not null and jsonb_typeof(signed_payload) = 'object')
    );
  end if;
end;
$$;

-- Shared check: the payload is a MesaSays Note (domain name "MesaSays", version "1").
create or replace function public.say_signed_payload_ok(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p_payload) = 'object'
    and p_payload->>'primaryType' = 'Note'
    and p_payload->'domain'->>'name' = 'MesaSays'
    and p_payload->'domain'->>'version' = '1'
    and jsonb_typeof(p_payload->'message') = 'object'
    and (p_payload->'message'->>'createdAt') ~ '^[0-9]{1,12}$';
$$;

-- New conversation, signed. Same rules as say_post; the text is stored exactly as signed (no trim).
create or replace function public.say_post_signed(
  p_author text, p_title text, p_body text, p_slug text,
  p_signer text, p_signature text, p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  m jsonb := p_payload->'message';
begin
  if not say_signed_payload_ok(p_payload)
     or m->>'kind' is distinct from 'thread'
     or m->>'title' is distinct from p_title
     or m->>'text' is distinct from coalesce(p_body, '')
     or m->>'author' is distinct from p_author
     or m->>'place' is distinct from coalesce(p_slug, '')
     or m->>'thread' is distinct from ''
     or m->>'parent' is distinct from '' then
    raise exception 'signed payload does not match the post';
  end if;
  if (select count(*) from say_threads where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many posts, try again in a minute';
  end if;
  insert into say_threads (author, title, body, signer, signature, signed_at, signed_payload)
  values (p_author, p_title, coalesce(p_body, ''), p_signer, lower(p_signature),
          to_timestamp((m->>'createdAt')::bigint), p_payload)
  returning id into v_id;
  if p_slug is not null and p_slug <> '' then
    insert into say_links (thread_id, restaurant_slug) values (v_id, p_slug);
  end if;
  return v_id;
end;
$$;

-- Reply, signed. Same rules as say_reply.
create or replace function public.say_reply_signed(
  p_thread uuid, p_parent uuid, p_author text, p_body text,
  p_signer text, p_signature text, p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  m jsonb := p_payload->'message';
begin
  if not say_signed_payload_ok(p_payload)
     or m->>'kind' is distinct from 'reply'
     or m->>'thread' is distinct from p_thread::text
     or m->>'parent' is distinct from coalesce(p_parent::text, '')
     or m->>'title' is distinct from ''
     or m->>'text' is distinct from p_body
     or m->>'author' is distinct from p_author
     or m->>'place' is distinct from '' then
    raise exception 'signed payload does not match the reply';
  end if;
  if not exists (select 1 from say_threads where id = p_thread and status = 'published') then
    raise exception 'conversation not found';
  end if;
  if p_parent is not null and not exists (select 1 from say_replies where id = p_parent and thread_id = p_thread) then
    raise exception 'reply not found';
  end if;
  if (select count(*) from say_replies where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'too many replies, try again in a minute';
  end if;
  insert into say_replies (thread_id, parent_id, author, body, signer, signature, signed_at, signed_payload)
  values (p_thread, p_parent, p_author, p_body, p_signer, lower(p_signature),
          to_timestamp((m->>'createdAt')::bigint), p_payload)
  returning id into v_id;
  return v_id;
end;
$$;


reset role;


revoke all on function public.say_post(text, text, text, text) from public;
revoke all on function public.say_reply(uuid, uuid, text, text) from public;
grant execute on function public.say_post(text, text, text, text) to mesasays_app;
grant execute on function public.say_reply(uuid, uuid, text, text) to mesasays_app;

revoke all on function public.say_signed_payload_ok(jsonb) from public;
revoke all on function public.say_post_signed(text, text, text, text, text, text, jsonb) from public;
revoke all on function public.say_reply_signed(uuid, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.say_post_signed(text, text, text, text, text, text, jsonb) to mesasays_app;
grant execute on function public.say_reply_signed(uuid, uuid, text, text, text, text, jsonb) to mesasays_app;
