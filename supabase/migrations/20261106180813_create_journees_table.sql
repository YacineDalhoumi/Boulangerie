-- Migration : create_journees_table
-- Une ligne par journée. On stocke uniquement les chiffres saisis ;
-- tout ce qui est calculé (après 14h, paniers, écarts) sera dans des vues.

create table public.journees (
  id                        bigint generated always as identity primary key,
  user_id                   uuid not null default auth.uid()
                              references auth.users (id) on delete cascade,
  date_jour                 date not null,
  source                    text not null default 'saisie'
                              check (source in ('saisie', 'import')),

  -- Relevé de 14h (cumul depuis l'ouverture) : obligatoire pour une saisie
  ca_14h                    numeric(10,2) check (ca_14h >= 0),
  tickets_14h               integer       check (tickets_14h >= 0),
  cb_caisse_14h             numeric(10,2) check (cb_caisse_14h >= 0),
  cb_tpe_14h                numeric(10,2) check (cb_tpe_14h >= 0),
  especes_caisse_14h        numeric(10,2) check (especes_caisse_14h >= 0),
  especes_comptees_14h      numeric(10,2) check (especes_comptees_14h >= 0),
  tr_14h                    numeric(10,2) check (tr_14h >= 0),

  -- Clôture 20h30 (cumul journée) : facultative, vide = « inconnue »
  ca_cloture                numeric(10,2) check (ca_cloture >= 0),
  tickets_cloture           integer       check (tickets_cloture >= 0),
  cb_caisse_cloture         numeric(10,2) check (cb_caisse_cloture >= 0),
  cb_tpe_cloture            numeric(10,2) check (cb_tpe_cloture >= 0),
  especes_caisse_cloture    numeric(10,2) check (especes_caisse_cloture >= 0),
  especes_comptees_cloture  numeric(10,2) check (especes_comptees_cloture >= 0),
  tr_cloture                numeric(10,2) check (tr_cloture >= 0),

  autres_paiements          numeric(10,2) check (autres_paiements >= 0),
  fond_caisse               numeric(10,2) not null default 120 check (fond_caisse >= 0),
  commentaire               text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Une seule saisie par date
  constraint journees_date_unique unique (user_id, date_jour),
  -- Le relevé de 14h est obligatoire (sauf pour l'historique importé, où il manque 5 fois)
  constraint journees_matin_obligatoire
    check (source = 'import' or (ca_14h is not null and tickets_14h is not null)),
  -- Une clôture renseignée comprend au minimum CA + tickets
  constraint journees_cloture_complete
    check ((ca_cloture is null) = (tickets_cloture is null)),
  -- Les chiffres de clôture sont cumulés : ils ne peuvent pas être inférieurs à 14h
  constraint journees_ca_cumule
    check (ca_cloture is null or ca_14h is null or ca_cloture >= ca_14h),
  constraint journees_tickets_cumules
    check (tickets_cloture is null or tickets_14h is null or tickets_cloture >= tickets_14h)
);

comment on table public.journees is 'Recettes quotidiennes : relevé de 14h et clôture de 20h30 (clôture vide = inconnue).';

-- Mise à jour automatique de updated_at
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger journees_set_updated_at
  before update on public.journees
  for each row execute function public.set_updated_at();

-- Sécurité : chaque utilisateur connecté ne voit et ne modifie que ses journées
alter table public.journees enable row level security;

create policy journees_select on public.journees
  for select to authenticated using ((select auth.uid()) = user_id);
create policy journees_insert on public.journees
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy journees_update on public.journees
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy journees_delete on public.journees
  for delete to authenticated using ((select auth.uid()) = user_id);
