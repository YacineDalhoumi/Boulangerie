-- Migration : create_invendus_et_ventes_produits_tables
-- Une ligne par date et par produit. Le prix unitaire est figé sur la ligne
-- (par défaut celui du catalogue) pour que l'historique ne change pas si le prix évolue.

-- Prix par défaut : si le prix unitaire n'est pas fourni, on prend celui du catalogue
create function public.prix_unitaire_par_defaut()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.prix_unitaire is null then
    select p.prix_vente into new.prix_unitaire from public.produits p where p.id = new.produit_id;
  end if;
  return new;
end;
$$;

create table public.invendus (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  date_jour      date not null,
  produit_id     bigint not null references public.produits (id) on delete restrict,
  quantite       integer not null check (quantite > 0),
  prix_unitaire  numeric(10,2) not null check (prix_unitaire >= 0),
  cause          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint invendus_produit_date_unique unique (user_id, date_jour, produit_id)
);

create table public.ventes_produits (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  date_jour      date not null,
  produit_id     bigint not null references public.produits (id) on delete restrict,
  quantite       integer not null check (quantite > 0),
  prix_unitaire  numeric(10,2) not null check (prix_unitaire >= 0),
  source         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ventes_produits_produit_date_unique unique (user_id, date_jour, produit_id)
);

create index invendus_produit_id_idx on public.invendus (produit_id);
create index ventes_produits_produit_id_idx on public.ventes_produits (produit_id);

create trigger invendus_prix_defaut before insert or update on public.invendus
  for each row execute function public.prix_unitaire_par_defaut();
create trigger ventes_produits_prix_defaut before insert or update on public.ventes_produits
  for each row execute function public.prix_unitaire_par_defaut();
create trigger invendus_set_updated_at before update on public.invendus
  for each row execute function public.set_updated_at();
create trigger ventes_produits_set_updated_at before update on public.ventes_produits
  for each row execute function public.set_updated_at();

alter table public.invendus enable row level security;
alter table public.ventes_produits enable row level security;

create policy invendus_all on public.invendus
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
              and exists (select 1 from public.produits p
                          where p.id = produit_id and p.user_id = (select auth.uid())));

create policy ventes_produits_all on public.ventes_produits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
              and exists (select 1 from public.produits p
                          where p.id = produit_id and p.user_id = (select auth.uid())));
