import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import {
  aujourdhui, dateCourte, dateFr, decalerJours, eur, eurCompact, jourSemaine, moisCourt, moisFr, nombre,
} from '../lib/format'
import { messageErreur } from '../lib/erreurs'
import { Bandeau, Carte, Delta, InfoBulle } from '../components/ui'

type Comparaison = Database['public']['Functions']['comparer_periodes']['Returns'][number]
type MeilleurPire = Database['public']['Functions']['meilleur_pire_jour']['Returns'][number]
type Vue<N extends keyof Database['public']['Views']> = Database['public']['Views'][N]['Row']

const GRANULARITES = ['jour', 'semaine', 'mois', 'annee'] as const
type Granularite = (typeof GRANULARITES)[number]

const PERIODES_COURBE = [
  { jours: 31, label: '1 mois' },
  { jours: 92, label: '3 mois' },
  { jours: 366, label: '1 an' },
]

const axe = { stroke: 'var(--axis)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false }

export default function TableauDeBord() {
  const [dateRef, setDateRef] = useState(aujourdhui())
  const [comparaisons, setComparaisons] = useState<Partial<Record<Granularite, Comparaison>>>({})
  const [extremes, setExtremes] = useState<MeilleurPire[]>([])
  const [quotidien, setQuotidien] = useState<Vue<'v_ca_quotidien'>[]>([])
  const [mensuel, setMensuel] = useState<Vue<'v_ca_mois'>[]>([])
  const [joursSemaine, setJoursSemaine] = useState<Vue<'v_ca_jour_semaine'>[]>([])
  const [categories, setCategories] = useState<Vue<'v_ca_categorie'>[]>([])
  const [aCompleter, setACompleter] = useState<{ date_jour: string | null }[]>([])
  const [periodeCourbe, setPeriodeCourbe] = useState(92)
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)

  // Indicateurs dépendant de la date de référence
  useEffect(() => {
    let annule = false
    async function charger() {
      setChargement(true)
      setErreur(null)
      const resultats = await Promise.all(
        GRANULARITES.map((g) => supabase.rpc('comparer_periodes', { p_granularite: g, p_date_ref: dateRef })),
      )
      const err = resultats.find((r) => r.error)?.error
      if (annule) return
      if (err) { setErreur(messageErreur(err)); setChargement(false); return }
      const comp: Partial<Record<Granularite, Comparaison>> = {}
      GRANULARITES.forEach((g, i) => { comp[g] = resultats[i].data?.[0] })
      setComparaisons(comp)

      const mois = comp.mois
      if (mois) {
        const [mp, cat] = await Promise.all([
          supabase.rpc('meilleur_pire_jour', { p_debut: mois.debut, p_fin: mois.fin }),
          supabase.from('v_ca_categorie').select('*').eq('mois', mois.debut).order('ordre'),
        ])
        if (annule) return
        setExtremes(mp.data ?? [])
        setCategories(cat.data ?? [])
      }
      setChargement(false)
    }
    charger()
    return () => { annule = true }
  }, [dateRef])

  // Courbe quotidienne
  useEffect(() => {
    supabase
      .from('v_ca_quotidien')
      .select('*')
      .gte('date_jour', decalerJours(dateRef, -periodeCourbe))
      .lte('date_jour', dateRef)
      .order('date_jour')
      .then(({ data, error }) => { if (error) setErreur(messageErreur(error)); else setQuotidien(data ?? []) })
  }, [dateRef, periodeCourbe])

  // Données indépendantes de la date
  useEffect(() => {
    supabase.from('v_ca_mois').select('*').order('mois').then(({ data }) => setMensuel(data ?? []))
    supabase.from('v_ca_jour_semaine').select('*').order('num_jour_semaine').then(({ data }) => setJoursSemaine(data ?? []))
    supabase.from('v_journees').select('date_jour').eq('cloture_connue', false).order('date_jour', { ascending: false })
      .then(({ data }) => setACompleter(data ?? []))
  }, [])

  const meilleurJourSemaine = joursSemaine.reduce<Vue<'v_ca_jour_semaine'> | null>(
    (m, j) => (m === null || Number(j.ca_moyen) > Number(m.ca_moyen) ? j : m), null,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-muted">Chiffres au {dateFr(dateRef)} ({jourSemaine(dateRef)})</p>
        </div>
        <label className="ml-auto text-sm">
          <span className="mb-1 block text-ink-2">Date de référence</span>
          <input type="date" className="champ" value={dateRef} max={aujourdhui()}
            onChange={(e) => e.target.value && setDateRef(e.target.value)} />
        </label>
      </div>

      {erreur && <Bandeau type="alerte">{erreur}</Bandeau>}

      {/* Chiffres clés */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={chargement}>
        <TuileJour c={comparaisons.jour} />
        <TuilePeriode titre="Cette semaine" c={comparaisons.semaine} libelleDate="même période sem. précédente" libelleComplet="semaine précédente entière" />
        <TuilePeriode titre={comparaisons.mois ? majuscule(moisFr(comparaisons.mois.debut)) : 'Ce mois'} c={comparaisons.mois} libelleDate="même période mois précédent" libelleComplet={`${moisFr(comparaisons.mois?.prec_complet_debut)} complet`} completEnPremier />
        <TuilePeriode titre={`Année ${comparaisons.annee?.debut.slice(0, 4) ?? ''}`} c={comparaisons.annee} libelleDate="même période année précédente" libelleComplet="année précédente entière" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Carte titre="Meilleure et pire journée" sousTitre={comparaisons.mois ? `du ${dateFr(comparaisons.mois.debut)} au ${dateFr(comparaisons.mois.fin)}` : undefined}>
          {extremes.length === 0 ? (
            <p className="text-sm text-muted">Aucune clôture connue sur la période.</p>
          ) : (
            <ul className="space-y-3">
              {extremes.map((e) => (
                <li key={e.classement} className="flex items-center gap-3">
                  <span className={`w-20 shrink-0 text-sm font-medium ${e.classement === 'meilleur' ? 'text-good' : 'text-bad'}`}>
                    {e.classement === 'meilleur' ? '▲ Meilleure' : '▼ Pire'}
                  </span>
                  <Link to={`/saisie?date=${e.date_jour}`} className="min-w-0 flex-1 hover:underline">
                    <span className="block">{e.jour_semaine} {dateFr(e.date_jour)}</span>
                    <span className="block text-sm text-muted">{nombre(e.tickets)} tickets · panier {eur(e.panier_moyen)}</span>
                  </Link>
                  <span className="tabular font-semibold">{eur(e.ca)}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Clôtures à compléter" sousTitre="Journées dont le ticket du soir manque" className="lg:col-span-2">
          {aCompleter.length === 0 ? (
            <p className="text-sm text-muted">Toutes les clôtures sont renseignées.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {aCompleter.map((j) => j.date_jour && (
                <li key={j.date_jour}>
                  <Link to={`/saisie?date=${j.date_jour}`}
                    className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm hover:bg-surface-2">
                    {dateFr(j.date_jour)} · compléter
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <Carte
        titre="CA quotidien"
        sousTitre="CA de clôture ; les journées sans clôture ne sont pas tracées"
        action={
          <div className="flex gap-1" role="group" aria-label="Période de la courbe">
            {PERIODES_COURBE.map((p) => (
              <button key={p.jours} type="button" onClick={() => setPeriodeCourbe(p.jours)}
                aria-pressed={periodeCourbe === p.jours}
                className={`min-h-9 rounded-lg px-3 text-sm ${periodeCourbe === p.jours ? 'bg-accent-soft font-medium' : 'text-ink-2 hover:bg-surface-2'}`}>
                {p.label}
              </button>
            ))}
          </div>
        }
      >
        {quotidien.length === 0 ? <Vide /> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quotidien} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="date_jour" tickFormatter={dateCourte} {...axe} minTickGap={24} />
                <YAxis tickFormatter={eurCompact} {...axe} axisLine={false} width={68} />
                <Tooltip cursor={{ stroke: 'var(--axis)' }} content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as Vue<'v_ca_quotidien'> | undefined
                  return <InfoBulle active={active} lignes={d ? [
                    { libelle: `${d.jour_semaine} ${dateFr(d.date_jour)}`, valeur: '' },
                    { libelle: 'CA', valeur: d.cloture_connue ? eur(d.ca) : 'clôture inconnue' },
                    { libelle: 'Tickets', valeur: nombre(d.tickets) },
                    { libelle: 'Panier moyen', valeur: eur(d.panier_moyen) },
                  ] : null} />
                }} />
                <Line type="linear" dataKey="ca" stroke="var(--series-1)" strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="CA mensuel" sousTitre="Total des clôtures connues">
          {mensuel.length === 0 ? <Vide /> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mensuel} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="mois" tickFormatter={moisCourt} {...axe} />
                  <YAxis tickFormatter={eurCompact} {...axe} axisLine={false} width={68} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => {
                    const d = payload?.[0]?.payload as Vue<'v_ca_mois'> | undefined
                    return <InfoBulle active={active} lignes={d ? [
                      { libelle: moisFr(d.mois), valeur: '' },
                      { libelle: 'CA', valeur: eur(d.ca) },
                      { libelle: 'Jours saisis', valeur: nombre(d.jours_connus) },
                      { libelle: 'Sans clôture', valeur: nombre(d.jours_sans_cloture) },
                      { libelle: 'CA moyen / jour', valeur: eur(d.ca_moyen_jour) },
                    ] : null} />
                  }} />
                  <Bar dataKey="ca" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Carte>

        <Carte titre="CA moyen par jour de la semaine"
          sousTitre={meilleurJourSemaine ? `Meilleur jour : ${meilleurJourSemaine.jour_semaine} (${eur(meilleurJourSemaine.ca_moyen)} en moyenne)` : undefined}>
          {joursSemaine.length === 0 ? <Vide /> : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={joursSemaine} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="jour_semaine" tickFormatter={(j: string) => j.slice(0, 3)} {...axe} />
                    <YAxis tickFormatter={eurCompact} {...axe} axisLine={false} width={68} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => {
                      const d = payload?.[0]?.payload as Vue<'v_ca_jour_semaine'> | undefined
                      return <InfoBulle active={active} lignes={d ? [
                        { libelle: d.jour_semaine ?? '', valeur: '' },
                        { libelle: 'CA moyen', valeur: eur(d.ca_moyen) },
                        { libelle: 'Min / max', valeur: `${eur(d.ca_min)} / ${eur(d.ca_max)}` },
                        { libelle: 'Journées', valeur: nombre(d.nb_jours) },
                      ] : null} />
                    }} />
                    <Bar dataKey="ca_moyen" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-3 w-full text-sm tabular">
                <thead className="text-left text-muted">
                  <tr><th className="py-1 font-normal">Jour</th><th className="py-1 text-right font-normal">Journées</th><th className="py-1 text-right font-normal">CA moyen</th><th className="py-1 text-right font-normal">Panier moyen</th></tr>
                </thead>
                <tbody>
                  {joursSemaine.map((j) => (
                    <tr key={j.num_jour_semaine} className="border-t border-line">
                      <td className="py-1.5">{j.jour_semaine}</td>
                      <td className="py-1.5 text-right">{nombre(j.nb_jours)}</td>
                      <td className="py-1.5 text-right">{eur(j.ca_moyen)}</td>
                      <td className="py-1.5 text-right">{eur(j.panier_moyen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Carte>
      </div>

      <Carte titre="Répartition par catégorie" sousTitre={comparaisons.mois ? moisFr(comparaisons.mois.debut) : undefined}>
        {categories.length === 0 ? (
          <p className="text-sm text-muted">
            Aucune répartition saisie pour ce mois. Elle est facultative : vous pouvez la renseigner dans la saisie du jour
            (section « Répartition par catégorie »).
          </p>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.categorie_id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                <span>{c.categorie}</span>
                <span className="h-2 rounded-full bg-accent-soft" aria-hidden="true">
                  <span className="block h-2 rounded-full bg-accent" style={{ width: `${Number(c.part_pct ?? 0)}%` }} />
                </span>
                <span className="tabular">{eur(c.ca)} · {nombre(c.part_pct)} %</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  )
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Vide() {
  return <p className="text-sm text-muted">Pas encore de données sur cette période.</p>
}

function Tuile({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-2">{titre}</p>
      {children}
    </div>
  )
}

function TuileJour({ c }: { c?: Comparaison }) {
  if (!c) return <Tuile titre="Aujourd’hui"><p className="mt-1 text-3xl font-semibold">…</p></Tuile>
  const saisie = c.jours_connus + c.jours_sans_cloture > 0
  return (
    <Tuile titre={`Jour : ${jourSemaine(c.debut)} ${dateFr(c.debut)}`}>
      {!saisie ? (
        <>
          <p className="mt-1 text-xl font-semibold text-muted">Pas de saisie</p>
          <Link to={`/saisie?date=${c.debut}`} className="text-sm text-accent-strong underline">Saisir cette journée</Link>
        </>
      ) : c.jours_sans_cloture > 0 ? (
        <>
          <p className="mt-1 text-xl font-semibold">Clôture inconnue</p>
          <Link to={`/saisie?date=${c.debut}`} className="text-sm text-accent-strong underline">Compléter la clôture</Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-3xl font-semibold">{eur(c.ca)}</p>
          {c.jours_prec > 0
            ? <Delta eurValeur={c.ecart_eur} pctValeur={c.ecart_pct} libelle={`vs ${dateFr(c.prec_debut)}`} />
            : <p className="text-sm text-muted">Pas de clôture le {dateFr(c.prec_debut)} pour comparer</p>}
        </>
      )}
    </Tuile>
  )
}

function TuilePeriode({ titre, c, libelleDate, libelleComplet, completEnPremier = false }: {
  titre: string; c?: Comparaison; libelleDate: string; libelleComplet: string; completEnPremier?: boolean
}) {
  if (!c) return <Tuile titre={titre}><p className="mt-1 text-3xl font-semibold">…</p></Tuile>
  const aDate = c.jours_prec > 0
    ? <Delta eurValeur={c.ecart_eur} pctValeur={c.ecart_pct} libelle={`vs ${libelleDate}`} />
    : <p className="text-sm text-muted">Pas de donnée sur la {libelleDate}</p>
  const complet = c.jours_prec_complet > 0
    ? <Delta eurValeur={c.ecart_complet_eur} pctValeur={c.ecart_complet_pct} libelle={`vs ${libelleComplet} (${eur(c.ca_prec_complet)})`} />
    : <p className="text-sm text-muted">Pas de donnée : {libelleComplet}</p>
  return (
    <Tuile titre={titre}>
      <p className="mt-1 text-3xl font-semibold">{eur(c.ca)}</p>
      <div className="mt-1 space-y-0.5">
        {completEnPremier ? <>{complet}{aDate}</> : <>{aDate}{complet}</>}
      </div>
      <p className="mt-2 text-xs text-muted">
        {dateFr(c.debut)} → {dateFr(c.fin)} · {c.jours_connus} jour{c.jours_connus > 1 ? 's' : ''} saisi{c.jours_connus > 1 ? 's' : ''}
        {c.jours_sans_cloture > 0 && ` · ${c.jours_sans_cloture} sans clôture`}
      </p>
    </Tuile>
  )
}
