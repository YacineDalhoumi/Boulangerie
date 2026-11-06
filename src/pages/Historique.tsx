import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { aujourdhui, dateFr, decalerJours, eur, eurSigne, nombre } from '../lib/format'
import { messageErreur } from '../lib/erreurs'
import { exporterCsv, exporterExcel, type LigneExport } from '../lib/export'
import { Bandeau, Bouton, Carte } from '../components/ui'

type Preset = 'mois' | 'mois_prec' | '30j' | 'annee' | 'tout' | 'perso'
type Tri = { colonne: keyof LigneExport; asc: boolean }

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'mois', label: 'Ce mois' },
  { id: 'mois_prec', label: 'Mois dernier' },
  { id: '30j', label: '30 derniers jours' },
  { id: 'annee', label: 'Cette année' },
  { id: 'tout', label: 'Tout' },
  { id: 'perso', label: 'Personnalisée' },
]

/** Bornes de dates d'un raccourci (paramètres de filtre, pas de calcul métier) */
function bornes(p: Preset): { du: string; au: string } {
  const auj = aujourdhui()
  const [a, m] = auj.split('-').map(Number)
  const premier = `${a}-${String(m).padStart(2, '0')}-01`
  switch (p) {
    case 'mois': return { du: premier, au: auj }
    case 'mois_prec': {
      const pa = m === 1 ? a - 1 : a
      const pm = m === 1 ? 12 : m - 1
      return { du: `${pa}-${String(pm).padStart(2, '0')}-01`, au: decalerJours(premier, -1) }
    }
    case '30j': return { du: decalerJours(auj, -29), au: auj }
    case 'annee': return { du: `${a}-01-01`, au: auj }
    default: return { du: '', au: '' }
  }
}

const COLONNES: { cle: keyof LigneExport; titre: string; type: 'date' | 'texte' | 'eur' | 'ecart' | 'nb' }[] = [
  { cle: 'date_jour', titre: 'Date', type: 'date' },
  { cle: 'jour_semaine', titre: 'Jour', type: 'texte' },
  { cle: 'ca_14h', titre: 'CA 14h', type: 'eur' },
  { cle: 'ca_cloture', titre: 'CA clôture', type: 'eur' },
  { cle: 'tickets_cloture', titre: 'Tickets', type: 'nb' },
  { cle: 'panier_moyen_journee', titre: 'Panier moyen', type: 'eur' },
  { cle: 'ecart_cb', titre: 'Écart CB', type: 'ecart' },
  { cle: 'ecart_especes', titre: 'Écart espèces', type: 'ecart' },
  { cle: 'ecart_encaissements', titre: 'Écart encaiss.', type: 'ecart' },
  { cle: 'commentaire', titre: 'Commentaire', type: 'texte' },
]

export default function Historique() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<Preset>('tout')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [recherche, setRecherche] = useState('')
  const [rechercheDiff, setRechercheDiff] = useState('')
  const [seulementInconnues, setSeulementInconnues] = useState(false)
  const [tri, setTri] = useState<Tri>({ colonne: 'date_jour', asc: false })
  const [lignes, setLignes] = useState<LigneExport[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [exportEnCours, setExportEnCours] = useState(false)

  // Recherche différée pour ne pas interroger la base à chaque touche
  useEffect(() => {
    const t = setTimeout(() => setRechercheDiff(recherche.trim()), 300)
    return () => clearTimeout(t)
  }, [recherche])

  function choisirPreset(p: Preset) {
    setPreset(p)
    if (p !== 'perso') { const b = bornes(p); setDu(b.du); setAu(b.au) }
  }

  // Filtrage, tri et recherche faits par Supabase
  useEffect(() => {
    let annule = false
    setChargement(true)
    let q = supabase.from('v_journees').select('*')
    if (du) q = q.gte('date_jour', du)
    if (au) q = q.lte('date_jour', au)
    if (seulementInconnues) q = q.eq('cloture_connue', false)
    if (rechercheDiff) {
      const dateSaisie = rechercheDiff.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (dateSaisie) {
        const [, j, m, a] = dateSaisie
        q = q.eq('date_jour', `${a}-${m.padStart(2, '0')}-${j.padStart(2, '0')}`)
      } else {
        const t = rechercheDiff.replace(/[,()*%\\]/g, ' ').trim()
        if (t) q = q.or(`commentaire.ilike.*${t}*,jour_semaine.ilike.*${t}*,detail_sorties.ilike.*${t}*`)
      }
    }
    q.order(tri.colonne, { ascending: tri.asc, nullsFirst: false })
      .order('date_jour', { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (annule) return
        if (error) setErreur(messageErreur(error))
        else { setErreur(null); setLignes(data ?? []) }
        setChargement(false)
      })
    return () => { annule = true }
  }, [du, au, seulementInconnues, rechercheDiff, tri])

  const trier = (colonne: keyof LigneExport) =>
    setTri((t) => (t.colonne === colonne ? { colonne, asc: !t.asc } : { colonne, asc: colonne === 'jour_semaine' || colonne === 'commentaire' }))

  const nomFichier = `recettes_${du ? dateFr(du).replace(/\//g, '-') : 'debut'}_au_${au ? dateFr(au).replace(/\//g, '-') : 'fin'}`

  async function exporter(format: 'csv' | 'xlsx') {
    setExportEnCours(true)
    try {
      if (format === 'csv') exporterCsv(lignes, nomFichier)
      else await exporterExcel(lignes, nomFichier)
    } catch (e) {
      setErreur(`Export impossible : ${(e as Error).message}`)
    } finally {
      setExportEnCours(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Historique</h1>
          <p className="text-sm text-muted">{chargement ? 'Chargement…' : `${lignes.length} journée${lignes.length > 1 ? 's' : ''}`}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Bouton variante="secondaire" disabled={!lignes.length || exportEnCours} onClick={() => exporter('xlsx')}>Exporter Excel</Bouton>
          <Bouton variante="secondaire" disabled={!lignes.length || exportEnCours} onClick={() => exporter('csv')}>Exporter CSV</Bouton>
        </div>
      </div>

      <Carte>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Période">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => choisirPreset(p.id)} aria-pressed={preset === p.id}
              className={`min-h-10 rounded-lg px-3 text-sm ${preset === p.id ? 'bg-accent-soft font-medium' : 'text-ink-2 hover:bg-surface-2'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
          <label className="text-sm"><span className="mb-1 block text-ink-2">Du</span>
            <input type="date" className="champ" value={du} onChange={(e) => { setDu(e.target.value); setPreset('perso') }} />
          </label>
          <label className="text-sm"><span className="mb-1 block text-ink-2">Au</span>
            <input type="date" className="champ" value={au} onChange={(e) => { setAu(e.target.value); setPreset('perso') }} />
          </label>
          <label className="text-sm"><span className="mb-1 block text-ink-2">Recherche</span>
            <input type="search" className="champ" placeholder="Commentaire, jour, sortie… ou JJ/MM/AAAA"
              value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
        </div>
        <label className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={seulementInconnues}
            onChange={(e) => setSeulementInconnues(e.target.checked)} />
          Seulement les clôtures inconnues
        </label>
      </Carte>

      {erreur && <Bandeau type="alerte">{erreur}</Bandeau>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm tabular">
          <thead className="bg-surface-2 text-left">
            <tr>
              {COLONNES.map((c) => (
                <th key={c.cle} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${c.type !== 'texte' && c.type !== 'date' ? 'text-right' : ''} ${c.cle === 'date_jour' ? 'sticky left-0 bg-surface-2' : ''}`}
                  aria-sort={tri.colonne === c.cle ? (tri.asc ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => trier(c.cle)} className="inline-flex items-center gap-1 hover:underline">
                    {c.titre}
                    <span aria-hidden="true" className="text-muted">{tri.colonne === c.cle ? (tri.asc ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className="cursor-pointer border-t border-line hover:bg-surface-2"
                onClick={() => navigate(`/saisie?date=${l.date_jour}`)}>
                {COLONNES.map((c) => <Cellule key={c.cle} ligne={l} col={c} />)}
              </tr>
            ))}
            {!chargement && lignes.length === 0 && (
              <tr><td colSpan={COLONNES.length} className="px-3 py-6 text-center text-muted">Aucune journée ne correspond aux filtres.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Touchez une ligne pour la modifier ou la supprimer.</p>
    </div>
  )
}

function Cellule({ ligne, col }: { ligne: LigneExport; col: (typeof COLONNES)[number] }) {
  const v = ligne[col.cle]
  const base = 'whitespace-nowrap px-3 py-2'
  switch (col.type) {
    case 'date':
      return (
        <td className={`${base} sticky left-0 bg-surface font-medium`}>
          <Link to={`/saisie?date=${ligne.date_jour}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{dateFr(String(v))}</Link>
        </td>
      )
    case 'eur':
      if (col.cle === 'ca_cloture' && v === null) return <td className={`${base} text-right text-muted`}>inconnue</td>
      return <td className={`${base} text-right`}>{eur(v)}</td>
    case 'ecart':
      return <td className={`${base} text-right`}>{v === null ? '—' : eurSigne(v)}</td>
    case 'nb':
      return <td className={`${base} text-right`}>{nombre(v)}</td>
    default:
      return <td className={`${base} ${col.cle === 'commentaire' ? 'max-w-72 truncate whitespace-normal' : ''}`} title={v ? String(v) : undefined}>{v ?? ''}</td>
  }
}
