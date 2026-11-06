-- Migration : create_fonctions_comparaison
-- Fonctions appelées en RPC par l'application (security invoker : RLS respectée).

-- Compare une période à la précédente.
--   jour    : la date choisie vs la même date du mois précédent
--   semaine : lundi → date choisie vs la même portion de la semaine précédente (+ semaine précédente complète)
--   mois    : 1er → date choisie vs la même portion du mois précédent (+ mois précédent complet)
--   annee   : 1er janvier → date choisie vs la même portion de l'année précédente (+ année précédente complète)
create function public.comparer_periodes(p_granularite text, p_date_ref date default current_date)
returns table (
  granularite          text,
  debut                date,
  fin                  date,
  ca                   numeric,
  jours_connus         int,
  jours_sans_cloture   int,
  prec_debut           date,
  prec_fin             date,
  ca_prec              numeric,
  jours_prec           int,
  ecart_eur            numeric,
  ecart_pct            numeric,
  prec_complet_debut   date,
  prec_complet_fin     date,
  ca_prec_complet      numeric,
  jours_prec_complet   int,
  ecart_complet_eur    numeric,
  ecart_complet_pct    numeric
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  d1 date; d2 date;   -- période en cours
  p1 date; p2 date;   -- période précédente, même portion
  c1 date; c2 date;   -- période précédente complète
begin
  case p_granularite
    when 'jour' then
      d1 := p_date_ref; d2 := p_date_ref;
      p1 := (p_date_ref - interval '1 month')::date; p2 := p1;
      c1 := p1; c2 := p1;
    when 'semaine' then
      d1 := date_trunc('week', p_date_ref)::date; d2 := p_date_ref;
      p1 := d1 - 7; p2 := p_date_ref - 7;
      c1 := d1 - 7; c2 := d1 - 1;
    when 'mois' then
      d1 := date_trunc('month', p_date_ref)::date; d2 := p_date_ref;
      p1 := (d1 - interval '1 month')::date; p2 := (p_date_ref - interval '1 month')::date;
      c1 := p1; c2 := d1 - 1;
    when 'annee' then
      d1 := date_trunc('year', p_date_ref)::date; d2 := p_date_ref;
      p1 := (d1 - interval '1 year')::date; p2 := (p_date_ref - interval '1 year')::date;
      c1 := p1; c2 := d1 - 1;
    else
      raise exception 'Granularité inconnue : % (attendu : jour, semaine, mois, annee)', p_granularite;
  end case;

  return query
  with s as (
    select
      coalesce(sum(j.ca_cloture) filter (where j.date_jour between d1 and d2), 0)      as ca,
      count(*) filter (where j.date_jour between d1 and d2 and j.ca_cloture is not null) as jc,
      count(*) filter (where j.date_jour between d1 and d2 and j.ca_cloture is null)     as jsc,
      coalesce(sum(j.ca_cloture) filter (where j.date_jour between p1 and p2), 0)      as cap,
      count(*) filter (where j.date_jour between p1 and p2 and j.ca_cloture is not null) as jp,
      coalesce(sum(j.ca_cloture) filter (where j.date_jour between c1 and c2), 0)      as cac,
      count(*) filter (where j.date_jour between c1 and c2 and j.ca_cloture is not null) as jpc
    from public.journees j
    where j.date_jour between least(p1, c1) and d2
  )
  select p_granularite, d1, d2,
         s.ca, s.jc::int, s.jsc::int,
         p1, p2, s.cap, s.jp::int,
         s.ca - s.cap,  round(100 * (s.ca - s.cap) / nullif(s.cap, 0), 1),
         c1, c2, s.cac, s.jpc::int,
         s.ca - s.cac,  round(100 * (s.ca - s.cac) / nullif(s.cac, 0), 1)
  from s;
end;
$$;

-- Meilleure et pire journée (CA de clôture connu) sur une période
create function public.meilleur_pire_jour(p_debut date, p_fin date)
returns table (
  classement     text,
  date_jour      date,
  jour_semaine   text,
  ca             numeric,
  tickets        int,
  panier_moyen   numeric
)
language sql
stable
set search_path = ''
as $$
  (select 'meilleur', v.date_jour, v.jour_semaine, v.ca_cloture, v.tickets_cloture, v.panier_moyen_journee
     from public.v_journees v
    where v.date_jour between p_debut and p_fin and v.cloture_connue
    order by v.ca_cloture desc, v.date_jour
    limit 1)
  union all
  (select 'pire', v.date_jour, v.jour_semaine, v.ca_cloture, v.tickets_cloture, v.panier_moyen_journee
     from public.v_journees v
    where v.date_jour between p_debut and p_fin and v.cloture_connue
    order by v.ca_cloture asc, v.date_jour
    limit 1);
$$;

-- Seuls les utilisateurs connectés peuvent appeler ces fonctions
revoke execute on function public.comparer_periodes(text, date) from public, anon;
revoke execute on function public.meilleur_pire_jour(date, date) from public, anon;
grant  execute on function public.comparer_periodes(text, date) to authenticated;
grant  execute on function public.meilleur_pire_jour(date, date) to authenticated;
