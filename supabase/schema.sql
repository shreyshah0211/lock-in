-- Lock In: the database behind accounts and friends.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Every table has row level security on: a signed-in person can only read and
-- change what the policies below allow, whatever the app asks for.

create extension if not exists citext;

-- Who you are to other people: name, username and your streak clock.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  name text not null default '' check (char_length(name) <= 40),
  color text not null default '#141A33' check (char_length(color) <= 9),
  campus text not null default '' check (char_length(campus) <= 40),
  gym text not null default '' check (char_length(gym) <= 40),
  bio text not null default '' check (char_length(bio) <= 200),
  last_checkin bigint not null default 0,
  streak_start bigint,
  best int not null default 0,
  total int not null default 0,
  lost jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles: signed-in people can read" on public.profiles;
create policy "profiles: signed-in people can read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles: add your own" on public.profiles;
create policy "profiles: add your own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles: change your own" on public.profiles;
create policy "profiles: change your own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Everything that is only yours (check-ins, meals, lifts, goals, weights) as one document.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
drop policy if exists "user_state: yours only" on public.user_state;
create policy "user_state: yours only" on public.user_state for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Your own photos (check-ins, meals, progress), one row each. Never visible to anyone else.
create table if not exists public.user_photos (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (char_length(key) <= 80),
  data text not null check (char_length(data) <= 400000),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_photos enable row level security;
drop policy if exists "user_photos: yours only" on public.user_photos;
create policy "user_photos: yours only" on public.user_photos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Friend requests and friendships. A request is 'pending' until the other person accepts.
create table if not exists public.follows (
  follower uuid not null references public.profiles(id) on delete cascade,
  followee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ok')),
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
alter table public.follows enable row level security;
drop policy if exists "follows: see your own" on public.follows;
create policy "follows: see your own" on public.follows for select to authenticated using (follower = auth.uid() or followee = auth.uid());
drop policy if exists "follows: ask to follow" on public.follows;
create policy "follows: ask to follow" on public.follows for insert to authenticated with check (follower = auth.uid() and status = 'pending');
drop policy if exists "follows: remove either side" on public.follows;
create policy "follows: remove either side" on public.follows for delete to authenticated using (follower = auth.uid() or followee = auth.uid());
-- There is no update policy on purpose: a request can only become 'ok' through accept_follow below.

-- Accepting a request makes you friends in both directions.
create or replace function public.accept_follow(from_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.follows set status = 'ok' where follower = from_id and followee = auth.uid() and status = 'pending';
  if found then
    insert into public.follows (follower, followee, status) values (auth.uid(), from_id, 'ok')
    on conflict (follower, followee) do update set status = 'ok';
  end if;
end $$;
revoke all on function public.accept_follow(uuid) from public, anon;
grant execute on function public.accept_follow(uuid) to authenticated;

-- Check-in photos that friends see.
create table if not exists public.posts (
  id text primary key check (char_length(id) <= 40),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  ts bigint not null,
  type text not null default 'full' check (char_length(type) <= 20),
  mins int not null default 0,
  effort int not null default 0,
  caption text not null default '' check (char_length(caption) <= 300),
  day int not null default 1,
  photo text check (photo is null or char_length(photo) <= 400000),
  scene jsonb,
  pr jsonb,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_user_ts on public.posts (user_id, ts desc);
alter table public.posts enable row level security;
drop policy if exists "posts: yours and your friends'" on public.posts;
create policy "posts: yours and your friends'" on public.posts for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.follows f where f.follower = auth.uid() and f.followee = posts.user_id and f.status = 'ok')
);
drop policy if exists "posts: add your own" on public.posts;
create policy "posts: add your own" on public.posts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "posts: change your own" on public.posts;
create policy "posts: change your own" on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "posts: delete your own" on public.posts;
create policy "posts: delete your own" on public.posts for delete to authenticated using (user_id = auth.uid());

-- "Delete my account": removes the person and, through the cascades above, everything of theirs.
create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
