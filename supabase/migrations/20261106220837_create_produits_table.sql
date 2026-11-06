-- Migration : create_produits_table
-- Catalogue des produits, rattachés à une catégorie, avec un prix de vente par défaut.

create table public.produits (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  categorie_id  bigint not null references public.categories (id) on delete restrict,
  nom           text not null check (length(trim(nom)) > 0),
  prix_vente    numeric(10,2) check (prix_vente >= 0),
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Un nom de produit unique par utilisateur (sans tenir compte des majuscules ni des espaces)
create unique index produits_nom_unique on public.produits (user_id, lower(trim(nom)));
create index produits_categorie_id_idx on public.produits (categorie_id);

create trigger produits_set_updated_at
  before update on public.produits
  for each row execute function public.set_updated_at();

alter table public.produits enable row level security;

create policy produits_all on public.produits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
              and exists (select 1 from public.categories c
                          where c.id = categorie_id and c.user_id = (select auth.uid())));
