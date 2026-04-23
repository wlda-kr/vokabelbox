-- ============================================================
-- vokabelbox: Initial Schema
-- ============================================================
-- Tabellen: lessons, vocabulary, attempts
-- Policies: Row-Level-Security, User sieht nur eigene Daten
-- ============================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";

-- ---------- HELPER: updated_at Trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- LESSONS
-- ============================================================
create table public.lessons (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  cover_image_url text,
  language_from text not null default 'es',  -- flexibel falls später Französisch etc.
  language_to   text not null default 'de',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index lessons_user_created_idx
  on public.lessons (user_id, created_at desc);

create trigger lessons_updated_at
  before update on public.lessons
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- VOCABULARY
-- ============================================================
create table public.vocabulary (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null references public.lessons(id) on delete cascade,
  term_source    text not null,               -- z.B. "la casa"
  term_target    text not null,               -- z.B. "das Haus"
  box            smallint not null default 1 check (box between 1 and 5),
  correct_count  int not null default 0,
  wrong_count    int not null default 0,
  last_review    timestamptz,
  position       int not null default 0,      -- Reihenfolge aus dem Buch
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index vocabulary_lesson_idx on public.vocabulary (lesson_id, position);
create index vocabulary_weak_idx   on public.vocabulary (lesson_id, box)
  where box <= 2;

create trigger vocabulary_updated_at
  before update on public.vocabulary
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- ATTEMPTS  (ein Eintrag pro abgeschlossener Session)
-- ============================================================
create table public.attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  mode        text not null check (mode in ('learn','quiz','test','weak')),
  total       int not null,
  correct     int not null,
  score_pct   numeric(5,2) generated always as
                (case when total > 0 then (correct::numeric / total) * 100 else 0 end) stored,
  grade       smallint check (grade between 1 and 6),  -- nur bei mode='test' gesetzt
  items       jsonb not null default '[]'::jsonb,      -- [{vocab_id, correct, direction}]
  created_at  timestamptz not null default now()
);

create index attempts_user_idx   on public.attempts (user_id, created_at desc);
create index attempts_lesson_idx on public.attempts (lesson_id, created_at desc);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
alter table public.lessons    enable row level security;
alter table public.vocabulary enable row level security;
alter table public.attempts   enable row level security;

-- LESSONS: Owner sieht und bearbeitet eigene Lektionen
create policy "lessons_owner_all"
  on public.lessons for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- VOCABULARY: Zugriff wenn parent-lesson dem User gehört
create policy "vocabulary_owner_all"
  on public.vocabulary for all
  using (exists (
    select 1 from public.lessons l
    where l.id = vocabulary.lesson_id and l.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.lessons l
    where l.id = vocabulary.lesson_id and l.user_id = auth.uid()
  ));

-- ATTEMPTS: Owner sieht eigene Versuche
create policy "attempts_owner_all"
  on public.attempts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE: Cover-Bilder der Lektionen (optional)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('lesson-covers', 'lesson-covers', false)
on conflict (id) do nothing;

-- Policy: User darf nur in seinen eigenen "Ordner" schreiben/lesen
-- Pfadkonvention: {user_id}/{lesson_id}.jpg
create policy "covers_owner_select"
  on storage.objects for select
  using (bucket_id = 'lesson-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "covers_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'lesson-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "covers_owner_update"
  on storage.objects for update
  using (bucket_id = 'lesson-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "covers_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'lesson-covers' and (storage.foldername(name))[1] = auth.uid()::text);
