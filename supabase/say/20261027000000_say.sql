-- Say: conversations on Mesasays. Project "MesaSay" (zwnpwnqyqnhqxafjorte), separate from the archived member backend.
-- No accounts: a name and you post. The public key can only read published rows and call say_post / say_reply.
-- Nothing can be edited or deleted from outside; moderation happens in the Supabase dashboard (status = 'hidden').

create table public.say_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text not null check (char_length(author) between 1 and 20),
  title text not null check (char_length(title) between 8 and 160),
  body text not null default '' check (char_length(body) <= 4000),
  status text not null default 'published' check (status in ('published', 'hidden'))
);

create table public.say_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.say_threads (id) on delete cascade,
  parent_id uuid references public.say_replies (id) on delete cascade,
  created_at timestamptz not null default now(),
  author text not null check (char_length(author) between 1 and 20),
  body text not null check (char_length(body) between 2 and 4000),
  status text not null default 'published' check (status in ('published', 'hidden'))
);

-- Which restaurant pages show a conversation. Set by the poster (posted from a restaurant page) or by us, with AI help.
create table public.say_links (
  thread_id uuid not null references public.say_threads (id) on delete cascade,
  restaurant_slug text not null check (restaurant_slug ~ '^[a-z0-9-]{1,80}$'),
  linked_by text not null default 'poster' check (linked_by in ('poster', 'team', 'ai')),
  created_at timestamptz not null default now(),
  primary key (thread_id, restaurant_slug)
);

create index say_threads_created_idx on public.say_threads (created_at desc);
create index say_replies_thread_idx on public.say_replies (thread_id, created_at);
create index say_links_slug_idx on public.say_links (restaurant_slug);

alter table public.say_threads enable row level security;
alter table public.say_replies enable row level security;
alter table public.say_links enable row level security;

-- Read: published conversations only.
create policy "read published threads" on public.say_threads
  for select to anon, authenticated using (status = 'published');
create policy "read published replies" on public.say_replies
  for select to anon, authenticated
  using (status = 'published' and exists (select 1 from public.say_threads t where t.id = thread_id and t.status = 'published'));
create policy "read links of published threads" on public.say_links
  for select to anon, authenticated
  using (exists (select 1 from public.say_threads t where t.id = thread_id and t.status = 'published'));

-- Write: never directly, only through the two functions below.
revoke insert, update, delete, truncate on public.say_threads, public.say_replies, public.say_links from anon, authenticated;

create function public.say_post(p_author text, p_title text, p_body text default '', p_slug text default null)
returns uuid
language plpgsql
security definer
set search_path = public
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

create function public.say_reply(p_thread uuid, p_parent uuid, p_author text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
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

revoke all on function public.say_post(text, text, text, text) from public;
revoke all on function public.say_reply(uuid, uuid, text, text) from public;
grant execute on function public.say_post(text, text, text, text) to anon, authenticated;
grant execute on function public.say_reply(uuid, uuid, text, text) to anon, authenticated;
