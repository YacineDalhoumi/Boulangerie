import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { aujourdhui, dateCourte, dateFr, eur, eurCompact, jourSemaine, lireEntier, lireMontant, nombre, versChamp } from '../lib/format'
import { messageErreur } from '../lib/erreurs'
import { bornes, PRESETS, type Preset } from '../lib/periodes'
import { Bandeau, Bouton, Carte, InfoBulle } from './ui'

type Produit = Database['public']['Tables']['produits']['Row']
type Categorie = Database['public']['Tables']['categories']['Row']
type Synthese = Database['public']['Functions']['synthese_produits']['Returns'][number]

export type Config = {
  type: 'invendus' | 'ventes'
  titre: string
  sousTitre: string
  libelleQuantite: string
  libelleMontant: string
  libelleRemarque: string
  exempleRemarque: string
}

/** Ligne commune aux deux vues (v_invendus / v_ventes_produits) */
type Ligne = {
  id: number; produit_id: number; produit: string; categorie: string
  quantite: number; prix_unitaire: number; montant: number; remarque: string | null
}
type Jour = { date_jour: string; montant: number; ca_cloture: number | null; part_pct: number | null; nb_produits: number }
type Form = { id: number | null; produit_id: string; quantite: string; prix: string; remarque: string }
const formVide = (): Form => ({ id: null, produit_id: '', quantite: '', prix: '', remarque: '' })

const axe = { stroke: 'var(--axis)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false }
const PRESETS_SYNTHESE = PRESETS.filter((p) => p.id !== 'perso')

export default function LignesProduits({ cfg }: { cfg: Config }) {
  const estInvendus = cfg.type === 'invendus'
  const table = estInvendus ? 'invendus' : 'ventes_produits'
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || aujourdhui()

  const [produits, setProduits] = useState<Produit[]>([])
  const [categories, setCategories] = useState<Categorie[]>([])
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [totalJour, setTotalJour] = useState<Jour | null>(null)
  const [form, setForm] = useState<Form>(formVide)
  const [message, setMessage] = useState<{ type: 'alerte' | 'succes'; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const [preset, setPreset] = useState<Preset>('mois')
  const [regroupement, setRegroupement] = useState<'produit' | 'categorie'>('produit')
  const [synthese, setSynthese] = useState<Synthese[]>([])
  const [total, setTotal] = useState<Synthese | null>(null)
  const [jours, setJours] = useState<Jour[]>([])
  const [version, setVersion] = useState(0)

  // Catalogue
  useEffect(() => {
    Promise.all([
      supabase.from('produits').select('*').order('nom'),
      supabase.from('categories').select('*').order('ordre'),
    ]).then(([p, c]) => { setProduits(p.data ?? []); setCategories(c.data ?? []) })
  }, [])

  const lireJour = (r: Record<string, unknown>): Jour => ({
    date_jour: String(r.date_jour),
    montant: Number(estInvendus ? r.valeur : r.ca_produits),
    ca_cloture: r.ca_cloture === null ? null : Number(r.ca_cloture),
    part_pct: (estInvendus ? r.part_du_ca_pct : r.couverture_ca_pct) as number | null,
    nb_produits: Number(r.nb_produits),
  })

  // Lignes de la date choisie
  const chargerJour = useCallback(async (d: string) => {
    const vue = estInvendus ? 'v_invendus' : 'v_ventes_produits'
    const vueJour = estInvendus ? 'v_invendus_jour' : 'v_ventes_produits_jour'
    const [{ data, error }, { data: tj }] = await Promise.all([
      supabase.from(vue).select('*').eq('date_jour', d).order('ordre_categorie').order('produit'),
      supabase.from(vueJour).select('*').eq('date_jour', d).maybeSingle(),
    ])
    if (error) { setMessage({ type: 'alerte', texte: messageErreur(error) }); return }
    setLignes((data ?? []).map((r) => {
      const x = r as Record<string, unknown>
      return {
        id: Number(x.id), produit_id: Number(x.produit_id), produit: String(x.produit), categorie: String(x.categorie),
        quantite: Number(x.quantite), prix_unitaire: Number(x.prix_unitaire),
        montant: Number(estInvendus ? x.valeur : x.ca_produit),
        remarque: (estInvendus ? x.cause : x.source) as string | null,
      }
    }))
    setTotalJour(tj ? lireJour(tj as Record<string, unknown>) : null)
  }, [estInvendus])

  useEffect(() => { setForm(formVide()); chargerJour(date) }, [date, chargerJour])

  // Synthèse de la période (calculée par la fonction synthese_produits)
  useEffect(() => {
    const b = bornes(preset)
    const du = b.du || '2000-01-01'
    const au = b.au || aujourdhui()
    const vueJour = estInvendus ? 'v_invendus_jour' : 'v_ventes_produits_jour'
    Promise.all([
      supabase.rpc('synthese_produits', { p_debut: du, p_fin: au, p_regroupement: regroupement }),
      supabase.rpc('synthese_produits', { p_debut: du, p_fin: au, p_regroupement: 'total' }),
      supabase.from(vueJour).select('*').gte('date_jour', du).lte('date_jour', au).order('date_jour'),
    ]).then(([s, t, j]) => {
      const err = s.error ?? t.error ?? j.error
      if (err) { setMessage({ type: 'alerte', texte: messageErreur(err) }); return }
      const cle = estInvendus ? 'valeur_invendue' : 'ca_vendu'
      setSynthese((s.data ?? []).filter((x) => Number(x[cle]) > 0).sort((a, b) => Number(b[cle]) - Number(a[cle])))
      setTotal(t.data?.[0] ?? null)
      setJours((j.data ?? []).map((r) => lireJour(r as Record<string, unknown>)))
    })
  }, [preset, regroupement, version, estInvendus])

  const produitChoisi = produits.find((p) => String(p.id) === form.produit_id)

  function choisirProduit(id: string) {
    const p = produits.find((x) => String(x.id) === id)
    setForm((f) => ({ ...f, produit_id: id, prix: p?.prix_vente != null ? versChamp(p.prix_vente) : '' }))
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const quantite = lireEntier(form.quantite)
    const prix = lireMontant(form.prix)
    if (!form.produit_id) { setMessage({ type: 'alerte', texte: 'Choisissez un produit.' }); return }
    if (quantite === null || Number.isNaN(quantite) || quantite <= 0) {
      setMessage({ type: 'alerte', texte: 'La quantité doit être un nombre entier supérieur à 0.' }); return
    }
    if (Number.isNaN(prix)) { setMessage({ type: 'alerte', texte: 'Prix invalide : utilisez par exemple 1,20.' }); return }

    const champs: Record<string, unknown> = {
      produit_id: Number(form.produit_id), quantite, prix_unitaire: prix,
      [estInvendus ? 'cause' : 'source']: form.remarque.trim() || null,
    }
    setEnvoi(true)
    const requete = form.id
      ? supabase.from(table).update(champs as never).eq('id', form.id)
      : supabase.from(table).insert({ ...champs, date_jour: date } as never)
    const { error } = await requete
    setEnvoi(false)
    if (error) { setMessage({ type: 'alerte', texte: messageErreur(error) }); return }
    setMessage({ type: 'succes', texte: `${produitChoisi?.nom ?? 'Ligne'} enregistré.` })
    setForm(formVide())
    chargerJour(date)
    setVersion((v) => v + 1)
  }

  async function supprimer(l: Ligne) {
    if (!window.confirm(`Supprimer la ligne « ${l.produit} » du ${dateFr(date)} ?`)) return
    const { error } = await supabase.from(table).delete().eq('id', l.id)
    if (error) { setMessage({ type: 'alerte', texte: messageErreur(error) }); return }
    if (form.id === l.id) setForm(formVide())
    chargerJour(date)
    setVersion((v) => v + 1)
  }

  const actifs = produits.filter((p) => p.actif || String(p.id) === form.produit_id)
  const dejaSaisis = new Set(lignes.filter((l) => l.id !== form.id).map((l) => l.produit_id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{cfg.titre}</h1>
          <p className="text-sm text-muted">{cfg.sousTitre}</p>
        </div>
        <label className="ml-auto text-sm">
          <span className="mb-1 block text-ink-2">Date</span>
          <input type="date" className="champ" value={date} max={aujourdhui()}
            onChange={(e) => e.target.value && setParams({ date: e.target.value })} />
        </label>
      </div>

      {message && <Bandeau type={message.type}>{message.texte}</Bandeau>}

      {produits.length === 0 ? (
        <Bandeau type="alerte">
          Le catalogue est vide. <Link to="/produits" className="font-medium underline">Ajoutez vos produits</Link> pour commencer la saisie.
        </Bandeau>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <Carte titre={form.id ? 'Modifier la ligne' : `Ajouter · ${jourSemaine(date)} ${dateFr(date)}`}
            action={<Link to="/produits" className="text-sm text-accent-strong underline">Gérer les produits</Link>}>
            <form onSubmit={enregistrer} className="grid grid-cols-2 gap-3" noValidate>
              <label className="col-span-2 text-sm"><span className="mb-1 block text-ink-2">Produit</span>
                <select className="champ" value={form.produit_id} onChange={(e) => choisirProduit(e.target.value)}>
                  <option value="">Choisir…</option>
                  {categories.map((c) => {
                    const liste = actifs.filter((p) => p.categorie_id === c.id)
                    return liste.length ? (
                      <optgroup key={c.id} label={c.nom}>
                        {liste.map((p) => (
                          <option key={p.id} value={p.id} disabled={dejaSaisis.has(p.id)}>
                            {p.nom}{dejaSaisis.has(p.id) ? ' (déjà saisi)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ) : null
                  })}
                </select>
              </label>
              <label className="text-sm"><span className="mb-1 block text-ink-2">{cfg.libelleQuantite}</span>
                <input className="champ text-right tabular" inputMode="numeric" placeholder="0" value={form.quantite}
                  onChange={(e) => setForm({ ...form, quantite: e.target.value })} />
              </label>
              <label className="text-sm"><span className="mb-1 block text-ink-2">Prix unitaire</span>
                <input className="champ text-right tabular" inputMode="decimal"
                  placeholder={produitChoisi?.prix_vente != null ? versChamp(produitChoisi.prix_vente) : '0,00'}
                  value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm"><span className="mb-1 block text-ink-2">{cfg.libelleRemarque}</span>
                <input className="champ" placeholder={cfg.exempleRemarque} value={form.remarque}
                  onChange={(e) => setForm({ ...form, remarque: e.target.value })} />
              </label>
              <div className="col-span-2 flex gap-2">
                <Bouton type="submit" disabled={envoi} className="h-12 flex-1">{form.id ? 'Enregistrer' : 'Ajouter'}</Bouton>
                {form.id && <Bouton variante="secondaire" className="h-12" onClick={() => setForm(formVide())}>Annuler</Bouton>}
              </div>
            </form>
          </Carte>

          <Carte titre={`Saisie du ${dateFr(date)}`}
            sousTitre={totalJour
              ? `${nombre(totalJour.nb_produits)} produit${totalJour.nb_produits > 1 ? 's' : ''} · ${cfg.libelleMontant} ${eur(totalJour.montant)}${totalJour.part_pct !== null ? ` · ${nombre(totalJour.part_pct)} % du CA de clôture` : ''}`
              : 'Aucune ligne pour cette date'}>
            {lignes.length > 0 && (
              <ul className="divide-y divide-line">
                {lignes.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{l.produit}</p>
                      <p className="text-xs text-muted">
                        {l.categorie} · {nombre(l.quantite)} × {eur(l.prix_unitaire)}{l.remarque ? ` · ${l.remarque}` : ''}
                      </p>
                    </div>
                    <span className="tabular font-semibold">{eur(l.montant)}</span>
                    <div className="flex gap-1">
                      <Bouton variante="secondaire" onClick={() => setForm({ id: l.id, produit_id: String(l.produit_id), quantite: String(l.quantite), prix: versChamp(l.prix_unitaire), remarque: l.remarque ?? '' })}>Modifier</Bouton>
                      <Bouton variante="danger" aria-label={`Supprimer ${l.produit}`} onClick={() => supprimer(l)}>✕</Bouton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      )}

      <Carte titre="Synthèse de la période"
        action={
          <div className="flex flex-wrap gap-1" role="group" aria-label="Période">
            {PRESETS_SYNTHESE.map((p) => (
              <button key={p.id} type="button" onClick={() => setPreset(p.id)} aria-pressed={preset === p.id}
                className={`min-h-9 rounded-lg px-3 text-sm ${preset === p.id ? 'bg-accent-soft font-medium' : 'text-ink-2 hover:bg-surface-2'}`}>
                {p.label}
              </button>
            ))}
          </div>
        }>
        {!total || (estInvendus ? Number(total.valeur_invendue) === 0 : Number(total.ca_vendu) === 0) ? (
          <p className="text-sm text-muted">Aucune saisie sur cette période.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Chiffre label={estInvendus ? 'Valeur des invendus' : 'CA des produits saisis'} valeur={eur(estInvendus ? total.valeur_invendue : total.ca_vendu)} />
              <Chiffre label={estInvendus ? 'Quantité invendue' : 'Quantité vendue'} valeur={nombre(estInvendus ? total.quantite_invendue : total.quantite_vendue)} />
              <Chiffre label="Jours saisis" valeur={nombre(jours.length)} />
              <Chiffre label="Taux d’invendus" valeur={total.taux_invendus_pct === null ? '—' : `${nombre(total.taux_invendus_pct)} %`}
                aide="sur les jours où ventes et invendus sont saisis" />
            </div>

            {jours.length > 0 && (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jours} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="date_jour" tickFormatter={dateCourte} {...axe} minTickGap={16} />
                    <YAxis tickFormatter={eurCompact} {...axe} axisLine={false} width={68} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => {
                      const d = payload?.[0]?.payload as Jour | undefined
                      return <InfoBulle active={active} lignes={d ? [
                        { libelle: `${jourSemaine(d.date_jour)} ${dateFr(d.date_jour)}`, valeur: '' },
                        { libelle: cfg.libelleMontant, valeur: eur(d.montant) },
                        { libelle: 'Part du CA de clôture', valeur: d.part_pct === null ? '—' : `${nombre(d.part_pct)} %` },
                        { libelle: 'Produits', valeur: nombre(d.nb_produits) },
                      ] : null} />
                    }} />
                    <Bar dataKey="montant" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div>
              <div className="mb-2 flex gap-1" role="group" aria-label="Regroupement">
                {(['produit', 'categorie'] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setRegroupement(r)} aria-pressed={regroupement === r}
                    className={`min-h-9 rounded-lg px-3 text-sm ${regroupement === r ? 'bg-accent-soft font-medium' : 'text-ink-2 hover:bg-surface-2'}`}>
                    Par {r === 'produit' ? 'produit' : 'catégorie'}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm tabular">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-1 font-normal">{regroupement === 'produit' ? 'Produit' : 'Catégorie'}</th>
                      <th className="py-1 text-right font-normal">{estInvendus ? 'Qté invendue' : 'Qté vendue'}</th>
                      <th className="py-1 text-right font-normal">{cfg.libelleMontant}</th>
                      <th className="py-1 text-right font-normal">Part</th>
                      <th className="py-1 text-right font-normal">Taux d’invendus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {synthese.map((s) => (
                      <tr key={`${s.cle_id}-${s.libelle}`} className="border-t border-line">
                        <td className="py-1.5">
                          {s.libelle}
                          {s.categorie && <span className="block text-xs text-muted">{s.categorie}</span>}
                        </td>
                        <td className="py-1.5 text-right">{nombre(estInvendus ? s.quantite_invendue : s.quantite_vendue)}</td>
                        <td className="py-1.5 text-right">{eur(estInvendus ? s.valeur_invendue : s.ca_vendu)}</td>
                        <td className="py-1.5 text-right">{(estInvendus ? s.part_invendus_pct : s.part_ca_pct) === null ? '—' : `${nombre(estInvendus ? s.part_invendus_pct : s.part_ca_pct)} %`}</td>
                        <td className="py-1.5 text-right">{s.taux_invendus_pct === null ? '—' : `${nombre(s.taux_invendus_pct)} %`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Carte>
    </div>
  )
}

function Chiffre({ label, valeur, aide }: { label: string; valeur: string; aide?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="text-lg font-semibold tabular">{valeur}</p>
      {aide && <p className="text-xs text-muted">{aide}</p>}
    </div>
  )
}
