-- Say: signed notes (EIP-712 wallet signatures on posts and replies). Spec: docs/SIGNED_NOTES.md.
--
-- HOW TO APPLY: paste this whole file into Supabase → project "MesaSay" → SQL Editor → Run.
-- Safe to run more than once: columns are added "if not exists", functions are "create or replace".
-- Apply it BEFORE (or right after) deploying the code that posts signed notes. Until it is applied the site
-- keeps working: posts read without signatures and a signed post is refused with "not switched on yet".
--
-- LIMITATION: Postgres cannot verify an Ethereum signature here. say_post_signed / say_reply_signed only
-- check that the stored columns say exactly what the signed message says, then store what the server
-- verified. Anyone holding the public key could call them with a made-up signature, so the website checks
-- every stored signature again when it displays a post: a forged row shows "signature invalid", never "signed".
-- The proof is the signature itself, which anyone can re-check with any EIP-712 tool.

alter table public.say_threads
  add column if not exists signer text,
  add column if not exists signature text,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_payload jsonb;

alter table public.say_replies
  add column if not exists signer text,
  add column if not exists signature text,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_payload jsonb;

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

-- Same philosophy as before: anon can read published rows (now with their signature columns, through the
-- existing select policies) and call the functions; it can never write the tables directly.
revoke all on function public.say_signed_payload_ok(jsonb) from public;
revoke all on function public.say_post_signed(text, text, text, text, text, text, jsonb) from public;
revoke all on function public.say_reply_signed(uuid, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.say_post_signed(text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.say_reply_signed(uuid, uuid, text, text, text, text, jsonb) to anon, authenticated;

-- Make the API see the new columns and functions right away.
notify pgrst, 'reload schema';
