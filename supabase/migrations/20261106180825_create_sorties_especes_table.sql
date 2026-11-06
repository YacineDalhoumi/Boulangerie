-- Migration : create_sorties_especes_table
-- Sorties d'espèces justifiées (ex. « Sana -40 »), une ligne par sortie.

create table public.sorties_especes (
  id          bigint generated always as identity primary key,
  journee_id  bigint not null references public.journees (id) on delete cascade,
  motif       text not null check (length(trim(motif)) > 0),
  montant     numeric(10,2) not null check (montant > 0),
  created_at  timestamptz not null default now()
);

create index sorties_especes_journee_id_idx on public.sorties_especes (journee_id);

alter table public.sorties_especes enable row level security;

-- Accès limité aux sorties rattachées à une journée de l'utilisateur
create policy sorties_especes_all on public.sorties_especes
  for all to authenticated
  using (exists (select 1 from public.journees j
                 where j.id = journee_id and j.user_id = (select auth.uid())))
  with check (exists (select 1 from public.journees j
                      where j.id = journee_id and j.user_id = (select auth.uid())));
