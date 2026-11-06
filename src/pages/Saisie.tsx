import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import {
  aujourdhui, dateFr, eur, eurSigne, jourSemaine, lireEntier, lireMontant, nombre, versChamp,
} from '../lib/format'
import { messageErreur } from '../lib/erreurs'
import { Bandeau, Bouton, Carte } from '../components/ui'

type Journee = Database['public']['Tables']['journees']['Row']
type JourneeVue = Database['public']['Views']['v_journees']['Row']
type Categorie = Database['public']['Tables']['categories']['Row']
type CleNum = Exclude<{
  [K in keyof Journee]: Journee[K] extends number | null ? K : never
}[keyof Journee], 'id'>

type Champ = { cle: CleNum; label: string; entier?: boolean; requis?: boolean; aide?: string }

const MATIN: Champ[] = [
  { cle: 'ca_14h', label: 'CA cumulé', requis: true },
  { cle: 'tickets_14h', label: 'Nombre de tickets', entier: true, requis: true },
  { cle: 'cb_caisse_14h', label: 'CB (caisse)' },
  { cle: 'cb_tpe_14h', label: 'CB (TPE)' },
  { cle: 'especes_caisse_14h', label: 'Espèces (caisse)' },
  { cle: 'especes_comptees_14h', label: 'Espèces comptées', aide: 'hors fond de caisse' },
  { cle: 'tr_14h', label: 'Tickets restaurant' },
]
const SOIR: Champ[] = [
  { cle: 'ca_cloture', label: 'CA cumulé' },
  { cle: 'tickets_cloture', label: 'Nombre de tickets', entier: true },
  { cle: 'cb_caisse_cloture', label: 'CB (caisse)' },
  { cle: 'cb_tpe_cloture', label: 'CB (TPE)' },
  { cle: 'especes_caisse_cloture', label: 'Espèces (caisse)' },
  { cle: 'especes_comptees_cloture', label: 'Espèces comptées', aide: 'hors fond de caisse' },
  { cle: 'tr_cloture', label: 'Tickets restaurant' },
]
const AUTRES: Champ[] = [
  { cle: 'autres_paiements', label: 'Autres paiements (journée)' },
  { cle: 'fond_caisse', label: 'Fond de caisse' },
]
const TOUS = [...MATIN, ...SOIR, ...AUTRES]

type Valeurs = Record<CleNum, string>
type Sortie = { motif: string; montant: string }

const valeursVides = (): Valeurs => {
  const v = Object.fromEntries(TOUS.map((c) => [c.cle, ''])) as Valeurs
  v.fond_caisse = '120,00'
  return v
}

export default function Saisie() {
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || aujourdhui()

  const [journee, setJournee] = useState<Journee | null>(null)
  const [calcul, setCalcul] = useState<JourneeVue | null>(null)
  const [valeurs, setValeurs] = useState<Valeurs>(valeursVides)
  const [commentaire, setCommentaire] = useState('')
  const [sorties, setSorties] = useState<Sortie[]>([])
  const [categories, setCategories] = useState<Categorie[]>([])
  const [ventesCat, setVentesCat] = useState<Record<number, string>>({})
  const [afficherCat, setAfficherCat] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<{ type: 'alerte' | 'succes'; texte: string } | null>(null)

  const charger = useCallback(async (d: string) => {
    setChargement(true)
    const [{ data: j, error }, { data: cats }] = await Promise.all([
      supabase.from('journees').select('*').eq('date_jour', d).maybeSingle(),
      supabase.from('categories').select('*').eq('actif', true).order('ordre'),
    ])
    setCategories(cats ?? [])
    if (error) { setMessage({ type: 'alerte', texte: messageErreur(error) }); setChargement(false); return }

    setJournee(j)
    if (!j) {
      setValeurs(valeursVides()); setCommentaire(''); setSorties([]); setVentesCat({}); setCalcul(null)
      setChargement(false)
      return
    }
    const v = valeursVides()
    for (const c of TOUS) v[c.cle] = versChamp(j[c.cle], c.entier ? 0 : 2)
    setValeurs(v)
    setCommentaire(j.commentaire ?? '')

    const [{ data: s }, { data: vc }, { data: vue }] = await Promise.all([
      supabase.from('sorties_especes').select('*').eq('journee_id', j.id).order('id'),
      supabase.from('ventes_categories').select('*').eq('journee_id', j.id),
      supabase.from('v_journees').select('*').eq('id', j.id).maybeSingle(),
    ])
    setSorties((s ?? []).map((x) => ({ motif: x.motif, montant: versChamp(x.montant) })))
    const ventes = Object.fromEntries((vc ?? []).map((x) => [x.categorie_id, versChamp(x.montant)]))
    setVentesCat(ventes)
    setAfficherCat(Object.keys(ventes).length > 0)
    setCalcul(vue)
    setChargement(false)
  }, [])

  useEffect(() => { setMessage(null); charger(date) }, [date, charger])

  const changerDate = (d: string) => d && setParams({ date: d })
  const maj = (cle: CleNum, v: string) => setValeurs((x) => ({ ...x, [cle]: v }))

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    // Lecture des champs (conversion texte -> nombre ; aucune règle de calcul ici)
    const donnees: Partial<Record<CleNum, number | null>> = {}
    const invalides: string[] = []
    for (const c of TOUS) {
      const n = c.entier ? lireEntier(valeurs[c.cle]) : lireMontant(valeurs[c.cle])
      if (Number.isNaN(n)) invalides.push(`${c.label}${c.cle.endsWith('_14h') ? ' (14h)' : c.cle.endsWith('_cloture') ? ' (clôture)' : ''}`)
      donnees[c.cle] = n
    }
    if (donnees.fond_caisse === null) donnees.fond_caisse = 120
    const sortiesLues = sorties
      .filter((s) => s.motif.trim() || s.montant.trim())
      .map((s) => ({ motif: s.motif.trim(), montant: lireMontant(s.montant) }))
    if (sortiesLues.some((s) => !s.motif || s.montant === null || Number.isNaN(s.montant) || s.montant <= 0)) {
      invalides.push('Sorties d’espèces (motif et montant positif requis)')
    }
    const ventesLues = Object.entries(ventesCat)
      .map(([id, m]) => ({ categorie_id: Number(id), montant: lireMontant(m) }))
      .filter((x) => x.montant !== null)
    if (ventesLues.some((x) => Number.isNaN(x.montant))) invalides.push('Répartition par catégorie')

    if (invalides.length) {
      setMessage({ type: 'alerte', texte: `Valeur invalide : ${invalides.join(', ')}. Utilisez des chiffres, par ex. 1234,50.` })
      return
    }
    if (journee?.source !== 'import' && (donnees.ca_14h === null || donnees.tickets_14h === null)) {
      setMessage({ type: 'alerte', texte: 'Le relevé de 14h est obligatoire : renseignez au moins le CA et le nombre de tickets de 14h.' })
      return
    }

    setEnvoi(true)
    const champs = { ...donnees, fond_caisse: donnees.fond_caisse as number, commentaire: commentaire.trim() || null }
    const res = journee
      ? await supabase.from('journees').update(champs).eq('id', journee.id).select('id').single()
      : await supabase.from('journees').insert({ ...champs, date_jour: date }).select('id').single()

    if (res.error || !res.data) {
      setEnvoi(false)
      setMessage({ type: 'alerte', texte: messageErreur(res.error) })
      return
    }
    const id = res.data.id

    // Sorties d'espèces et répartition : on remplace l'existant par la saisie
    const etapes = [
      await supabase.from('sorties_especes').delete().eq('journee_id', id),
      sortiesLues.length
        ? await supabase.from('sorties_especes').insert(sortiesLues.map((s) => ({ journee_id: id, motif: s.motif, montant: s.montant as number })))
        : null,
      await supabase.from('ventes_categories').delete().eq('journee_id', id),
      ventesLues.length
        ? await supabase.from('ventes_categories').insert(ventesLues.map((v) => ({ journee_id: id, categorie_id: v.categorie_id, montant: v.montant as number })))
        : null,
    ]
    const err = etapes.find((r) => r?.error)?.error
    setEnvoi(false)
    await charger(date)
    setMessage(err
      ? { type: 'alerte', texte: `Journée enregistrée, mais erreur sur le détail : ${messageErreur(err)}` }
      : { type: 'succes', texte: `Journée du ${dateFr(date)} enregistrée.` })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function supprimer() {
    if (!journee) return
    if (!window.confirm(`Supprimer définitivement la saisie du ${dateFr(date)} ?`)) return
    setEnvoi(true)
    const { error } = await supabase.from('journees').delete().eq('id', journee.id)
    setEnvoi(false)
    if (error) { setMessage({ type: 'alerte', texte: messageErreur(error) }); return }
    await charger(date)
    setMessage({ type: 'succes', texte: `Saisie du ${dateFr(date)} supprimée.` })
  }

  const estSamedi = jourSemaine(date) === 'samedi'
  const clotureInconnue = journee !== null && journee.ca_cloture === null

  return (
    <form onSubmit={enregistrer} className="mx-auto max-w-3xl space-y-4" noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{journee ? 'Modifier la journée' : 'Saisie du jour'}</h1>
          <p className="text-sm text-muted">{jourSemaine(date)} {dateFr(date)}</p>
        </div>
        <label className="ml-auto text-sm">
          <span className="mb-1 block text-ink-2">Date</span>
          <input type="date" className="champ" value={date} max={aujourdhui()} onChange={(e) => changerDate(e.target.value)} />
        </label>
      </div>

      {message && <Bandeau type={message.type}>{message.texte}</Bandeau>}
      {estSamedi && !journee && <Bandeau type="alerte">Attention : le samedi est normalement votre jour de fermeture.</Bandeau>}
      {journee && !message && (
        <Bandeau>
          Cette date est déjà saisie{journee.source === 'import' ? ' (import Excel)' : ''} : vous modifiez la journée existante.
          {clotureInconnue && ' La clôture est « inconnue » : complétez-la quand vous retrouvez le ticket.'}
        </Bandeau>
      )}

      {chargement ? <p className="text-muted">Chargement…</p> : (
        <>
          <Carte titre="Relevé de 14h" sousTitre="Obligatoire · chiffres cumulés depuis l’ouverture">
            <Grille champs={MATIN} valeurs={valeurs} maj={maj} requisActif={journee?.source !== 'import'} />
          </Carte>

          <Carte titre="Clôture 20h30" sousTitre="Facultative · laissez vide si vous n’avez pas le ticket : la clôture sera « inconnue »">
            <Grille champs={SOIR} valeurs={valeurs} maj={maj} />
          </Carte>

          <Carte titre="Espèces et autres">
            <Grille champs={AUTRES} valeurs={valeurs} maj={maj} />
            <div className="mt-4">
              <p className="text-sm font-medium">Sorties d’espèces justifiées</p>
              <p className="text-xs text-muted">Avances, achats payés en liquide… (ex. « Sana » 40,00)</p>
              <ul className="mt-2 space-y-2">
                {sorties.map((s, i) => (
                  <li key={i} className="grid grid-cols-[1fr_7.5rem_auto] gap-2">
                    <input className="champ" placeholder="Motif / personne" aria-label="Motif" value={s.motif}
                      onChange={(e) => setSorties((l) => l.map((x, k) => (k === i ? { ...x, motif: e.target.value } : x)))} />
                    <input className="champ text-right tabular" inputMode="decimal" placeholder="0,00" aria-label="Montant" value={s.montant}
                      onChange={(e) => setSorties((l) => l.map((x, k) => (k === i ? { ...x, montant: e.target.value } : x)))} />
                    <Bouton variante="secondaire" aria-label="Retirer cette sortie" onClick={() => setSorties((l) => l.filter((_, k) => k !== i))}>✕</Bouton>
                  </li>
                ))}
              </ul>
              <Bouton variante="secondaire" className="mt-2" onClick={() => setSorties((l) => [...l, { motif: '', montant: '' }])}>
                + Ajouter une sortie
              </Bouton>
            </div>
            <label className="mt-4 block text-sm font-medium" htmlFor="commentaire">Commentaire</label>
            <textarea id="commentaire" rows={3} className="champ mt-1" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </Carte>

          {categories.length > 0 && (
            <Carte
              titre="Répartition par catégorie"
              sousTitre="Facultative · CA de la journée par famille de produits"
              action={<Bouton variante="secondaire" onClick={() => setAfficherCat((x) => !x)} aria-expanded={afficherCat}>{afficherCat ? 'Masquer' : 'Renseigner'}</Bouton>}
            >
              {afficherCat ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.map((c) => (
                    <label key={c.id} className="text-sm">
                      <span className="mb-1 block text-ink-2">{c.nom}</span>
                      <input className="champ text-right tabular" inputMode="decimal" placeholder="0,00" value={ventesCat[c.id] ?? ''}
                        onChange={(e) => setVentesCat((v) => ({ ...v, [c.id]: e.target.value }))} />
                    </label>
                  ))}
                </div>
              ) : <p className="text-sm text-muted">Non renseignée.</p>}
            </Carte>
          )}

          {calcul && <Resume v={calcul} />}

          <div className="sticky bottom-20 z-10 lg:bottom-4 flex gap-2 rounded-2xl border border-line bg-surface p-3 shadow-lg">
            <Bouton type="submit" disabled={envoi} className="flex-1 h-12">
              {envoi ? 'Enregistrement…' : journee ? 'Enregistrer les modifications' : 'Enregistrer la journée'}
            </Bouton>
            {journee && <Bouton variante="danger" disabled={envoi} onClick={supprimer} className="h-12">Supprimer</Bouton>}
          </div>
          <p className="text-center text-sm"><Link to="/historique" className="text-accent-strong underline">Voir l’historique</Link></p>
        </>
      )}
    </form>
  )
}

function Grille({ champs, valeurs, maj, requisActif = true }: {
  champs: Champ[]; valeurs: Valeurs; maj: (c: CleNum, v: string) => void; requisActif?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {champs.map((c) => (
        <label key={c.cle} className="text-sm">
          <span className="mb-1 block text-ink-2">
            {c.label}{c.requis && requisActif && <span className="text-bad"> *</span>}
            {c.aide && <span className="block text-xs text-muted">{c.aide}</span>}
          </span>
          <input
            className="champ text-right tabular"
            inputMode={c.entier ? 'numeric' : 'decimal'}
            placeholder={c.entier ? '0' : '0,00'}
            value={valeurs[c.cle]}
            onChange={(e) => maj(c.cle, e.target.value)}
            aria-required={c.requis && requisActif}
          />
        </label>
      ))}
    </div>
  )
}

/** Résultats calculés par Supabase (vue v_journees) */
function Resume({ v }: { v: JourneeVue }) {
  const lignes: [string, string][] = [
    ['CA après 14h', eur(v.ca_apres_14h)],
    ['Tickets après 14h', nombre(v.tickets_apres_14h)],
    ['Panier moyen matin', eur(v.panier_moyen_matin)],
    ['Panier moyen après 14h', eur(v.panier_moyen_apres_14h)],
    ['Panier moyen journée', eur(v.panier_moyen_journee)],
    ['Écart CB (TPE − caisse)', v.ecart_cb === null ? '—' : eurSigne(v.ecart_cb)],
    ['Espèces comptées (journée)', eur(v.especes_comptees_journee)],
    ['Sorties d’espèces', eur(v.sorties_especes)],
    ['Écart espèces (non tapées)', v.ecart_especes === null ? '—' : eurSigne(v.ecart_especes)],
    ['Écart encaissements vs CA', v.ecart_encaissements === null ? '—' : eurSigne(v.ecart_encaissements)],
  ]
  return (
    <Carte titre="Résultats de la journée" sousTitre="Calculés par la base à partir de votre saisie">
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {lignes.map(([l, val]) => (
          <div key={l} className="flex justify-between border-t border-line py-1.5 text-sm">
            <dt className="text-ink-2">{l}</dt><dd className="tabular font-medium">{val}</dd>
          </div>
        ))}
      </dl>
    </Carte>
  )
}
