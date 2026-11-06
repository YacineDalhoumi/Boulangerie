-- Migration : create_categories_tables
-- Répartition FACULTATIVE du CA par catégorie (non utilisée dans l'historique Excel).

create table public.categories (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  nom         text not null check (length(trim(nom)) > 0),
  ordre       smallint not null default 0,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint categories_nom_unique unique (user_id, nom)
);

create table public.ventes_categories (
  journee_id    bigint not null references public.journees (id) on delete cascade,
  categorie_id  bigint not null references public.categories (id) on delete restrict,
  montant       numeric(10,2) not null check (montant >= 0),
  primary key (journee_id, categorie_id)
);

create index ventes_categories_categorie_id_idx on public.ventes_categories (categorie_id);

alter table public.categories enable row level security;
alter table public.ventes_categories enable row level security;

create policy categories_all on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy ventes_categories_all on public.ventes_categories
  for all to authenticated
  using (exists (select 1 from public.journees j
                 where j.id = journee_id and j.user_id = (select auth.uid())))
  with check (exists (select 1 from public.journees j
                      where j.id = journee_id and j.user_id = (select auth.uid())));
