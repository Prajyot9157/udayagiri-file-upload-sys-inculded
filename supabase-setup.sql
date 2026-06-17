-- Run these commands in your Supabase SQL Editor to configure the storage bucket

-- 1. Create a new bucket for materials
insert into storage.buckets (id, name, public) 
values ('materials', 'materials', true)
on conflict (id) do nothing;

-- Profiles Table for User Onboarding
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  std text,
  class_name text,
  prep text,
  phone text,
  parent_phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- Drop policies if they exist so we can recreate them without errors
drop policy if exists "Profiles viewable by everyone" on profiles;
drop policy if exists "Users can insert their own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Allow generic uploads" on storage.objects;
drop policy if exists "Allow generic update" on storage.objects;
drop policy if exists "Allow generic delete" on storage.objects;

create policy "Profiles viewable by everyone" on profiles for select using (true);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- 2. Allow public access to read files from the 'materials' bucket
create policy "Public Access" 
on storage.objects for select 
using (bucket_id = 'materials');

-- 3. Allow authenticated users (or anyone, if you are not using Supabase Auth) to insert files.
create policy "Allow generic uploads" 
on storage.objects for insert 
with check (bucket_id = 'materials');

-- 4. Allow generic deletes/updates
create policy "Allow generic update"
on storage.objects for update
using (bucket_id = 'materials');

create policy "Allow generic delete"
on storage.objects for delete
using (bucket_id = 'materials');
