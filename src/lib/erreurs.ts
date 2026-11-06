// Traduction en français des erreurs renvoyées par Supabase / Postgres.
type ErreurSupabase = { code?: string; message?: string; details?: string } | null | undefined

const CONTRAINTES: Record<string, string> = {
  journees_date_unique: 'Une saisie existe déjà pour cette date. Ouvrez-la pour la modifier.',
  journees_matin_obligatoire: 'Le relevé de 14h est obligatoire : renseignez au moins le CA et le nombre de tickets de 14h.',
  journees_cloture_complete: 'Pour la clôture, renseignez à la fois le CA et le nombre de tickets (ou laissez les deux vides).',
  journees_ca_cumule: 'Le CA de clôture est cumulé depuis l’ouverture : il ne peut pas être inférieur au CA de 14h.',
  journees_tickets_cumules: 'Le nombre de tickets de clôture est cumulé : il ne peut pas être inférieur à celui de 14h.',
  categories_nom_unique: 'Cette catégorie existe déjà.',
  produits_nom_unique: 'Un produit porte déjà ce nom.',
  invendus_produit_date_unique: 'Ce produit est déjà saisi en invendu pour cette date : modifiez la ligne existante.',
  ventes_produits_produit_date_unique: 'Ce produit est déjà saisi pour cette date : modifiez la ligne existante.',
  invendus_quantite_check: 'La quantité doit être un nombre entier supérieur à 0.',
  ventes_produits_quantite_check: 'La quantité doit être un nombre entier supérieur à 0.',
}

export function messageErreur(e: ErreurSupabase): string {
  if (!e) return 'Erreur inconnue.'
  const texte = `${e.message ?? ''} ${e.details ?? ''}`
  for (const [nom, msg] of Object.entries(CONTRAINTES)) if (texte.includes(nom)) return msg
  if (e.code === '23502' && texte.includes('prix_unitaire')) return 'Indiquez un prix unitaire (ce produit n’a pas de prix dans le catalogue).'
  if (e.code === '23503') return 'Élément encore utilisé ailleurs : il ne peut pas être supprimé (désactivez-le plutôt).'
  if (e.code === '22P02') return 'Valeur invalide : la quantité doit être un nombre entier.'
  if (e.code === '23514') return 'Un montant est invalide (les montants doivent être positifs).'
  if (e.code === '23505') return 'Cet enregistrement existe déjà.'
  if (e.code === '42501') return 'Accès refusé : reconnectez-vous.'
  if (/Invalid login credentials/i.test(texte)) return 'Email ou mot de passe incorrect.'
  if (/Email not confirmed/i.test(texte)) return 'Adresse email non confirmée.'
  if (/Failed to fetch|NetworkError/i.test(texte)) return 'Connexion internet indisponible. Réessayez.'
  return e.message || 'Erreur inconnue.'
}
