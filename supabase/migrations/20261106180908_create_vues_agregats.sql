-- Migration : create_vues_agregats
-- Toutes les vues sont en security_invoker : elles respectent la RLS des tables.
-- Le CA d'une journée = CA de clôture ; une clôture inconnue est exclue des sommes et moyennes.

-- 1. Journée détaillée avec tous les champs calculés
create view public.v_journees with (security_invoker = true) as
select
  j.id,
  j.date_jour,
  extract(isodow from j.date_jour)::int                               as num_jour_semaine,
  (array['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'])
    [extract(isodow from j.date_jour)::int]                           as jour_semaine,
  j.source,
  (j.ca_cloture is not null)                                          as cloture_connue,
  -- CA et tickets
  j.ca_14h, j.ca_cloture,
  j.ca_cloture - j.ca_14h                                             as ca_apres_14h,
  j.tickets_14h, j.tickets_cloture,
  j.tickets_cloture - j.tickets_14h                                   as tickets_apres_14h,
  round(j.ca_14h / nullif(j.tickets_14h, 0), 2)                       as panier_moyen_matin,
  round((j.ca_cloture - j.ca_14h)
        / nullif(j.tickets_cloture - j.tickets_14h, 0), 2)            as panier_moyen_apres_14h,
  round(j.ca_cloture / nullif(j.tickets_cloture, 0), 2)               as panier_moyen_journee,
  -- CB
  j.cb_caisse_14h, j.cb_caisse_cloture,
  j.cb_caisse_cloture - j.cb_caisse_14h                               as cb_caisse_apres_14h,
  j.cb_tpe_14h, j.cb_tpe_cloture,
  j.cb_tpe_cloture - j.cb_tpe_14h                                     as cb_tpe_apres_14h,
  j.cb_tpe_cloture - j.cb_caisse_cloture                              as ecart_cb,
  -- Espèces (comptages hors fond de caisse, caisse vidée à 14h)
  j.especes_caisse_14h, j.especes_caisse_cloture,
  j.especes_caisse_cloture - j.especes_caisse_14h                     as especes_caisse_apres_14h,
  j.especes_comptees_14h, j.especes_comptees_cloture,
  j.especes_comptees_14h + j.especes_comptees_cloture                 as especes_comptees_journee,
  coalesce(s.total_sorties, 0)                                        as sorties_especes,
  s.detail_sorties,
  j.especes_comptees_14h + j.especes_comptees_cloture
    + coalesce(s.total_sorties, 0) - j.especes_caisse_cloture         as ecart_especes,
  -- Tickets restaurant (terminal séparé) et autres
  j.tr_14h, j.tr_cloture,
  j.tr_cloture - j.tr_14h                                             as tr_apres_14h,
  j.autres_paiements,
  j.fond_caisse,
  -- Écart encaissements réels vs CA de clôture
  j.especes_comptees_14h + j.especes_comptees_cloture + coalesce(s.total_sorties, 0)
    + j.cb_tpe_cloture + coalesce(j.tr_cloture, 0) + coalesce(j.autres_paiements, 0)
    - j.ca_cloture                                                    as ecart_encaissements,
  j.commentaire,
  j.created_at,
  j.updated_at
from public.journees j
left join lateral (
  select sum(se.montant) as total_sorties,
         string_agg(se.motif || ' ' || se.montant::text, ' / ' order by se.id) as detail_sorties
  from public.sorties_especes se
  where se.journee_id = j.id
) s on true;

-- 2. CA quotidien (pour la courbe)
create view public.v_ca_quotidien with (security_invoker = true) as
select date_jour, num_jour_semaine, jour_semaine, cloture_connue,
       ca_cloture as ca, tickets_cloture as tickets, panier_moyen_journee as panier_moyen
from public.v_journees;

-- 3. Agrégats par semaine (ISO, du lundi au dimanche), mois et année
create view public.v_ca_semaine with (security_invoker = true) as
select
  date_trunc('week', date_jour)::date                         as debut_semaine,
  (date_trunc('week', date_jour)::date + 6)                   as fin_semaine,
  extract(isoyear from date_jour)::int                        as annee_iso,
  extract(week from date_jour)::int                           as num_semaine,
  coalesce(sum(ca_cloture), 0)                                as ca,
  coalesce(sum(tickets_cloture), 0)                           as tickets,
  round(sum(ca_cloture) / nullif(sum(tickets_cloture), 0), 2) as panier_moyen,
  round(avg(ca_cloture), 2)                                   as ca_moyen_jour,
  count(*) filter (where ca_cloture is not null)::int         as jours_connus,
  count(*) filter (where ca_cloture is null)::int             as jours_sans_cloture
from public.journees
group by 1, 2, 3, 4;

create view public.v_ca_mois with (security_invoker = true) as
select
  date_trunc('month', date_jour)::date                        as mois,
  extract(year from date_jour)::int                           as annee,
  extract(month from date_jour)::int                          as num_mois,
  coalesce(sum(ca_cloture), 0)                                as ca,
  coalesce(sum(tickets_cloture), 0)                           as tickets,
  round(sum(ca_cloture) / nullif(sum(tickets_cloture), 0), 2) as panier_moyen,
  round(avg(ca_cloture), 2)                                   as ca_moyen_jour,
  count(*) filter (where ca_cloture is not null)::int         as jours_connus,
  count(*) filter (where ca_cloture is null)::int             as jours_sans_cloture
from public.journees
group by 1, 2, 3;

create view public.v_ca_annee with (security_invoker = true) as
select
  extract(year from date_jour)::int                           as annee,
  coalesce(sum(ca_cloture), 0)                                as ca,
  coalesce(sum(tickets_cloture), 0)                           as tickets,
  round(sum(ca_cloture) / nullif(sum(tickets_cloture), 0), 2) as panier_moyen,
  round(avg(ca_cloture), 2)                                   as ca_moyen_jour,
  count(*) filter (where ca_cloture is not null)::int         as jours_connus,
  count(*) filter (where ca_cloture is null)::int             as jours_sans_cloture
from public.journees
group by 1;

-- 4. CA moyen par jour de la semaine (clôtures connues uniquement)
create view public.v_ca_jour_semaine with (security_invoker = true) as
select
  num_jour_semaine,
  jour_semaine,
  count(*)::int                                               as nb_jours,
  round(avg(ca_cloture), 2)                                   as ca_moyen,
  min(ca_cloture)                                             as ca_min,
  max(ca_cloture)                                             as ca_max,
  sum(ca_cloture)                                             as ca_total,
  round(avg(tickets_cloture), 1)                              as tickets_moyen,
  round(sum(ca_cloture) / nullif(sum(tickets_cloture), 0), 2) as panier_moyen
from public.v_journees
where cloture_connue
group by 1, 2;

-- 5. Répartition par catégorie et par mois (facultative)
create view public.v_ca_categorie with (security_invoker = true) as
select
  date_trunc('month', j.date_jour)::date                      as mois,
  c.id                                                        as categorie_id,
  c.nom                                                       as categorie,
  c.ordre,
  sum(vc.montant)                                             as ca,
  round(100 * sum(vc.montant)
        / nullif(sum(sum(vc.montant)) over (partition by date_trunc('month', j.date_jour)::date), 0), 1)
                                                              as part_pct
from public.ventes_categories vc
join public.journees j   on j.id = vc.journee_id
join public.categories c on c.id = vc.categorie_id
group by 1, 2, 3, 4;

-- Les visiteurs non connectés n'ont aucun accès aux vues
revoke all on public.v_journees, public.v_ca_quotidien, public.v_ca_semaine, public.v_ca_mois,
              public.v_ca_annee, public.v_ca_jour_semaine, public.v_ca_categorie from anon;
