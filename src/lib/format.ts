// Formatage d'affichage uniquement (aucun calcul métier : tout vient de Supabase).

const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const eurSigneFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', signDisplay: 'exceptZero' })
const nbFmt = new Intl.NumberFormat('fr-FR')
const pctFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'exceptZero' })
const compactFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)

/** 1 234,56 € — tiret si vide */
export const eur = (v: unknown, vide = '—') => {
  const n = num(v)
  return n === null || Number.isNaN(n) ? vide : eurFmt.format(n)
}
/** +1 234,56 € / −12,00 € */
export const eurSigne = (v: unknown) => {
  const n = num(v)
  return n === null ? '—' : eurSigneFmt.format(n)
}
/** +12,3 % */
export const pct = (v: unknown) => {
  const n = num(v)
  return n === null ? '—' : `${pctFmt.format(n)} %`
}
export const nombre = (v: unknown) => {
  const n = num(v)
  return n === null ? '—' : nbFmt.format(n)
}
/** Axe des graphiques : 1,5 k€ */
export const eurCompact = (v: unknown) => {
  const n = num(v)
  return n === null ? '' : `${compactFmt.format(n)} €`
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

/** '2026-11-06' -> '06/11/2026' (sans passer par les fuseaux horaires) */
export const dateFr = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const [a, m, j] = iso.slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}
/** '2026-11-06' -> '06/11' */
export const dateCourte = (iso: string) => {
  const [, m, j] = iso.slice(0, 10).split('-')
  return `${j}/${m}`
}
/** '2026-10-01' -> 'octobre 2026' */
export const moisFr = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const [a, m] = iso.split('-')
  return `${MOIS[Number(m) - 1]} ${a}`
}
export const moisCourt = (iso: string) => {
  const [a, m] = iso.split('-')
  return `${MOIS_COURT[Number(m) - 1]} ${a.slice(2)}`
}
/** Jour de la semaine d'une date ISO (affichage seulement) */
export const jourSemaine = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number)
  return JOURS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]
}

/** Date du jour à Paris au format AAAA-MM-JJ */
export const aujourdhui = () =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())

/** Décale une date ISO de n jours (paramètre de filtre) */
export const decalerJours = (iso: string, n: number) => {
  const [a, m, j] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j + n))
  return d.toISOString().slice(0, 10)
}

/** Saisie « 1 234,5 » -> 1234.5 ; '' -> null ; texte invalide -> NaN */
export const lireMontant = (s: string): number | null => {
  const t = s.replace(/[\s  €]/g, '').replace(',', '.')
  if (t === '') return null
  return /^\d+(\.\d{0,2})?$/.test(t) ? Number(t) : NaN
}
export const lireEntier = (s: string): number | null => {
  const t = s.replace(/[\s  ]/g, '')
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : NaN
}
/** 1234.5 -> '1234,50' pour pré-remplir un champ */
export const versChamp = (v: number | null | undefined, decimales = 2) =>
  v === null || v === undefined ? '' : Number(v).toFixed(decimales).replace('.', ',')
