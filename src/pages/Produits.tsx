import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { eur, lireMontant, versChamp } from '../lib/format'
import { messageErreur } from '../lib/erreurs'
import { Bandeau, Bouton, Carte } from '../components/ui'

type Produit = Database['public']['Tables']['produits']['Row']
type Categorie = Database['public']['Tables']['categories']['Row']
type Formulaire = { id: number | null; nom: string; categorie_id: string; prix: string }

const vide = (categorie_id = ''): Formulaire => ({ id: null, nom: '', categorie_id, prix: '' })

export default function Produits() {
  const [categories, setCategories] = useState<Categorie[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [form, setForm] = useState<Formulaire>(vide())
  const [nouvelleCat, setNouvelleCat] = useState('')
  const [afficherInactifs, setAfficherInactifs] = useState(false)
  const [message, setMessage] = useState<{ type: 'alerte' | 'succes'; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(async () => {
    const [{ data: c, error: e1 }, { data: p, error: e2 }] = await Promise.all([
      supabase.from('categories').select('*').order('ordre').order('nom'),
      supabase.from('produits').select('*').order('nom'),
    ])
    if (e1 || e2) { setMessage({ type: 'alerte', texte: messageErreur(e1 ?? e2) }); return }
    setCategories(c ?? [])
    setProduits(p ?? [])
    setForm((f) => (f.categorie_id || !c?.length ? f : { ...f, categorie_id: String(c[0].id) }))
  }, [])

  useEffect(() => { charger() }, [charger])

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const prix = lireMontant(form.prix)
    if (!form.nom.trim()) { setMessage({ type: 'alerte', texte: 'Indiquez le nom du produit.' }); return }
    if (!form.categorie_id) { setMessage({ type: 'alerte', texte: 'Choisissez une catégorie.' }); return }
    if (Number.isNaN(prix)) { setMessage({ type: 'alerte', texte: 'Prix invalide : utilisez par exemple 1,20.' }); return }
    setEnvoi(true)
    const champs = { nom: form.nom.trim(), categorie_id: Number(form.categorie_id), prix_vente: prix }
    const { error } = form.id
      ? await supabase.from('produits').update(champs).eq('id', form.id)
      : await supabase.from('produits').insert(champs)
    setEnvoi(false)
    if (error) { setMessage({ type: 'alerte', texte: messageErreur(error) }); return }
    setMessage({ type: 'succes', texte: form.id ? `« ${champs.nom} » modifié.` : `« ${champs.nom} » ajouté au catalogue.` })
    setForm(vide(form.categorie_id))
    charger()
  }

  async function basculerActif(p: Produit) {
    const { error } = await supabase.from('produits').update({ actif: !p.actif }).eq('id', p.id)
    if (error) setMessage({ type: 'alerte', texte: messageErreur(error) })
    else charger()
  }

  async function supprimer(p: Produit) {
    if (!window.confirm(`Supprimer « ${p.nom} » du catalogue ?`)) return
    const { error } = await supabase.from('produits').delete().eq('id', p.id)
    if (error) {
      setMessage({ type: 'alerte', texte: error.code === '23503'
        ? `« ${p.nom} » a déjà des ventes ou des invendus enregistrés : désactivez-le plutôt pour le masquer des listes.`
        : messageErreur(error) })
      return
    }
    setMessage({ type: 'succes', texte: `« ${p.nom} » supprimé.` })
    charger()
  }

  async function ajouterCategorie(e: FormEvent) {
    e.preventDefault()
    const nom = nouvelleCat.trim()
    if (!nom) return
    const ordre = categories.length ? Math.max(...categories.map((c) => c.ordre)) + 1 : 1
    const { error } = await supabase.from('categories').insert({ nom, ordre })
    if (error) { setMessage({ type: 'alerte', texte: messageErreur(error) }); return }
    setNouvelleCat('')
    setMessage({ type: 'succes', texte: `Catégorie « ${nom} » ajoutée.` })
    charger()
  }

  const visibles = produits.filter((p) => afficherInactifs || p.actif)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Catalogue des produits</h1>
        <p className="text-sm text-muted">
          Utilisé pour saisir les <Link to="/invendus" className="underline">invendus</Link> et
          les <Link to="/ventes-produits" className="underline">ventes par produit</Link>. Le prix sert de prix par défaut.
        </p>
      </div>

      {message && <Bandeau type={message.type}>{message.texte}</Bandeau>}

      <Carte titre={form.id ? 'Modifier le produit' : 'Ajouter un produit'}>
        <form onSubmit={enregistrer} className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr]" noValidate>
          <label className="text-sm"><span className="mb-1 block text-ink-2">Nom</span>
            <input className="champ" value={form.nom} placeholder="Ex. Croissant"
              onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </label>
          <label className="text-sm"><span className="mb-1 block text-ink-2">Catégorie</span>
            <select className="champ" value={form.categorie_id} onChange={(e) => setForm({ ...form, categorie_id: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </label>
          <label className="text-sm"><span className="mb-1 block text-ink-2">Prix de vente</span>
            <input className="champ text-right tabular" inputMode="decimal" placeholder="0,00" value={form.prix}
              onChange={(e) => setForm({ ...form, prix: e.target.value })} />
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <Bouton type="submit" disabled={envoi} className="flex-1">{form.id ? 'Enregistrer' : 'Ajouter au catalogue'}</Bouton>
            {form.id && <Bouton variante="secondaire" onClick={() => setForm(vide(form.categorie_id))}>Annuler</Bouton>}
          </div>
        </form>
      </Carte>

      <Carte
        titre={`Produits (${visibles.length})`}
        action={
          <label className="inline-flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={afficherInactifs}
              onChange={(e) => setAfficherInactifs(e.target.checked)} />
            Afficher les inactifs
          </label>
        }
      >
        {produits.length === 0 ? (
          <p className="text-sm text-muted">Aucun produit pour l’instant. Ajoutez-les avec le formulaire ci-dessus.</p>
        ) : (
          <div className="space-y-4">
            {categories.map((c) => {
              const liste = visibles.filter((p) => p.categorie_id === c.id)
              if (!liste.length) return null
              return (
                <div key={c.id}>
                  <h3 className="mb-1 text-sm font-semibold text-ink-2">{c.nom}</h3>
                  <ul className="divide-y divide-line">
                    {liste.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                        <span className={`min-w-0 flex-1 ${p.actif ? '' : 'text-muted line-through'}`}>{p.nom}</span>
                        <span className="tabular w-20 text-right">{eur(p.prix_vente)}</span>
                        <div className="flex gap-1">
                          <Bouton variante="secondaire" onClick={() => { setForm({ id: p.id, nom: p.nom, categorie_id: String(p.categorie_id), prix: versChamp(p.prix_vente) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Modifier</Bouton>
                          <Bouton variante="secondaire" onClick={() => basculerActif(p)}>{p.actif ? 'Désactiver' : 'Réactiver'}</Bouton>
                          <Bouton variante="danger" aria-label={`Supprimer ${p.nom}`} onClick={() => supprimer(p)}>✕</Bouton>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </Carte>

      <Carte titre="Catégories" sousTitre={categories.map((c) => c.nom).join(' · ')}>
        <form onSubmit={ajouterCategorie} className="flex gap-2">
          <input className="champ" placeholder="Nouvelle catégorie" value={nouvelleCat} onChange={(e) => setNouvelleCat(e.target.value)} />
          <Bouton type="submit" variante="secondaire">Ajouter</Bouton>
        </form>
      </Carte>
    </div>
  )
}
