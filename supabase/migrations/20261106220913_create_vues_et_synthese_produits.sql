-- Migration : create_vues_et_synthese_produits
-- Calculs des invendus et des ventes par produit (security_invoker : RLS respectée).

-- 1. Lignes détaillées avec valeur calculée
create view public.v_invendus with (security_invoker = true) as
select
  i.id, i.date_jour,
  (array['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'])
    [extract(isodow from i.date_jour)::int]                 as jour_semaine,
  p.id as produit_id, p.nom as produit,
  c.id as categorie_id, c.nom as categorie, c.ordre as ordre_categorie,
  i.quantite, i.prix_unitaire,
  round(i.quantite * i.prix_unitaire, 2)                    as valeur,
  i.cause, i.created_at, i.updated_at
from public.invendus i
join public.produits p   on p.id = i.produit_id
join public.categories c on c.id = p.categorie_id;

create view public.v_ventes_produits with (security_invoker = true) as
select
  v.id, v.date_jour,
  (array['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'])
    [extract(isodow from v.date_jour)::int]                 as jour_semaine,
  p.id as produit_id, p.nom as produit,
  c.id as categorie_id, c.nom as categorie, c.ordre as ordre_categorie,
  v.quantite, v.prix_unitaire,
  round(v.quantite * v.prix_unitaire, 2)                    as ca_produit,
  v.source, v.created_at, v.updated_at
from public.ventes_produits v
join public.produits p   on p.id = v.produit_id
join public.categories c on c.id = p.categorie_id;

-- 2. Totaux par jour, rapprochés du CA de clôture
create view public.v_invendus_jour with (security_invoker = true) as
select
  i.date_jour,
  count(*)::int                                             as nb_produits,
  sum(i.quantite)                                           as quantite,
  sum(round(i.quantite * i.prix_unitaire, 2))               as valeur,
  j.ca_cloture,
  round(100 * sum(round(i.quantite * i.prix_unitaire, 2)) / nullif(j.ca_cloture, 0), 1)
                                                            as part_du_ca_pct
from public.invendus i
left join public.journees j on j.user_id = i.user_id and j.date_jour = i.date_jour
group by i.user_id, i.date_jour, j.ca_cloture;

create view public.v_ventes_produits_jour with (security_invoker = true) as
select
  v.date_jour,
  count(*)::int                                             as nb_produits,
  sum(v.quantite)                                           as quantite,
  sum(round(v.quantite * v.prix_unitaire, 2))               as ca_produits,
  j.ca_cloture,
  round(100 * sum(round(v.quantite * v.prix_unitaire, 2)) / nullif(j.ca_cloture, 0), 1)
                                                            as couverture_ca_pct
from public.ventes_produits v
left join public.journees j on j.user_id = v.user_id and j.date_jour = v.date_jour
group by v.user_id, v.date_jour, j.ca_cloture;

revoke all on public.v_invendus, public.v_ventes_produits,
              public.v_invendus_jour, public.v_ventes_produits_jour from anon;

-- 3. Synthèse d'une période par produit, par catégorie ou au total :
--    ventes, invendus, parts et taux d'invendus = invendus / (vendus + invendus).
--    Le taux n'est calculé que sur les jours où, pour ce produit, des ventes ont été saisies
--    ET où des invendus ont été saisis ce jour-là (un produit absent des invendus compte 0).
create function public.synthese_produits(p_debut date, p_fin date, p_regroupement text default 'produit')
returns table (
  cle_id               bigint,
  libelle              text,
  categorie            text,
  ordre_categorie      smallint,
  quantite_vendue      numeric,
  ca_vendu             numeric,
  part_ca_pct          numeric,
  jours_vente          int,
  quantite_invendue    numeric,
  valeur_invendue      numeric,
  part_invendus_pct    numeric,
  jours_invendus       int,
  taux_invendus_pct    numeric
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_regroupement not in ('produit', 'categorie', 'total') then
    raise exception 'Regroupement inconnu : % (attendu : produit, categorie, total)', p_regroupement;
  end if;

  return query
  with lignes as (
    select v.produit_id, v.produit, v.categorie_id, v.categorie, v.ordre_categorie, v.date_jour,
           v.quantite::numeric as qv, v.ca_produit as cv, null::numeric as qi, null::numeric as vi
      from public.v_ventes_produits v
     where v.date_jour between p_debut and p_fin
    union all
    select i.produit_id, i.produit, i.categorie_id, i.categorie, i.ordre_categorie, i.date_jour,
           null, null, i.quantite::numeric, i.valeur
      from public.v_invendus i
     where i.date_jour between p_debut and p_fin
  ),
  jours_suivis as (           -- jours où des invendus ont été saisis
    select distinct date_jour from lignes where qi is not null
  ),
  par_jour as (               -- une ligne par produit et par jour
    select l.produit_id, l.produit, l.categorie_id, l.categorie, l.ordre_categorie, l.date_jour,
           sum(l.qv) as qv, sum(l.cv) as cv, sum(l.qi) as qi, sum(l.vi) as vi,
           (sum(l.qv) is not null and l.date_jour in (select date_jour from jours_suivis)) as comparable
    from lignes l
    group by 1, 2, 3, 4, 5, 6
  ),
  g as (
    select
      case p_regroupement when 'produit' then d.produit_id when 'categorie' then d.categorie_id end as gid,
      case p_regroupement when 'produit' then d.produit when 'categorie' then d.categorie else 'Total' end as glib,
      case p_regroupement when 'produit' then d.categorie end as gcat,
      min(d.ordre_categorie) as gordre,
      sum(d.qv) as sqv, sum(d.cv) as scv, count(*) filter (where d.qv is not null) as njv,
      sum(d.qi) as sqi, sum(d.vi) as svi, count(*) filter (where d.qi is not null) as nji,
      sum(d.qv) filter (where d.comparable) as cqv,
      sum(coalesce(d.qi, 0)) filter (where d.comparable) as cqi
    from par_jour d
    group by 1, 2, 3
  )
  select g.gid, g.glib, g.gcat, g.gordre::smallint,
         coalesce(g.sqv, 0), coalesce(g.scv, 0),
         round(100 * coalesce(g.scv, 0) / nullif(sum(g.scv) over (), 0), 1),
         g.njv::int,
         coalesce(g.sqi, 0), coalesce(g.svi, 0),
         round(100 * coalesce(g.svi, 0) / nullif(sum(g.svi) over (), 0), 1),
         g.nji::int,
         round(100 * g.cqi / nullif(g.cqi + g.cqv, 0), 1)
  from g
  order by g.gordre nulls last, g.glib;
end;
$$;

revoke execute on function public.synthese_produits(date, date, text) from public, anon;
grant  execute on function public.synthese_produits(date, date, text) to authenticated;
