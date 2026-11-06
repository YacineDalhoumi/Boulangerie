// Raccourcis de période (bornes de dates passées en paramètre aux requêtes Supabase).
import { aujourdhui, decalerJours } from './format'

export type Preset = 'mois' | 'mois_prec' | '30j' | 'annee' | 'tout' | 'perso'

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'mois', label: 'Ce mois' },
  { id: 'mois_prec', label: 'Mois dernier' },
  { id: '30j', label: '30 derniers jours' },
  { id: 'annee', label: 'Cette année' },
  { id: 'tout', label: 'Tout' },
  { id: 'perso', label: 'Personnalisée' },
]

export function bornes(p: Preset): { du: string; au: string } {
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
