// Export des lignes affichées (aucun recalcul : les valeurs viennent de v_journees).
import type { Database } from './database.types'
import { dateFr } from './format'

export type LigneExport = Database['public']['Views']['v_journees']['Row']

type Colonne = { titre: string; cle: keyof LigneExport; type: 'date' | 'texte' | 'montant' | 'entier' }

export const COLONNES_EXPORT: Colonne[] = [
  { titre: 'Date', cle: 'date_jour', type: 'date' },
  { titre: 'Jour', cle: 'jour_semaine', type: 'texte' },
  { titre: 'CA 14h (€)', cle: 'ca_14h', type: 'montant' },
  { titre: 'CA clôture (€)', cle: 'ca_cloture', type: 'montant' },
  { titre: 'CA après 14h (€)', cle: 'ca_apres_14h', type: 'montant' },
  { titre: 'Tickets 14h', cle: 'tickets_14h', type: 'entier' },
  { titre: 'Tickets clôture', cle: 'tickets_cloture', type: 'entier' },
  { titre: 'Panier moyen journée (€)', cle: 'panier_moyen_journee', type: 'montant' },
  { titre: 'CB caisse clôture (€)', cle: 'cb_caisse_cloture', type: 'montant' },
  { titre: 'CB TPE clôture (€)', cle: 'cb_tpe_cloture', type: 'montant' },
  { titre: 'Écart CB (€)', cle: 'ecart_cb', type: 'montant' },
  { titre: 'Espèces caisse clôture (€)', cle: 'especes_caisse_cloture', type: 'montant' },
  { titre: 'Espèces comptées journée (€)', cle: 'especes_comptees_journee', type: 'montant' },
  { titre: 'Sorties espèces (€)', cle: 'sorties_especes', type: 'montant' },
  { titre: 'Détail sorties', cle: 'detail_sorties', type: 'texte' },
  { titre: 'Écart espèces (€)', cle: 'ecart_especes', type: 'montant' },
  { titre: 'Tickets restaurant clôture (€)', cle: 'tr_cloture', type: 'montant' },
  { titre: 'Autres paiements (€)', cle: 'autres_paiements', type: 'montant' },
  { titre: 'Écart encaissements vs CA (€)', cle: 'ecart_encaissements', type: 'montant' },
  { titre: 'Commentaire', cle: 'commentaire', type: 'texte' },
]

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** CSV pour Excel français : séparateur « ; », virgule décimale, BOM UTF-8 */
export function exporterCsv(lignes: LigneExport[], nom: string) {
  const echapper = (s: string) => (/[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const cellule = (l: LigneExport, c: Colonne) => {
    const v = l[c.cle]
    if (v === null || v === undefined) return ''
    if (c.type === 'date') return dateFr(String(v))
    if (c.type === 'montant') return Number(v).toFixed(2).replace('.', ',')
    return echapper(String(v))
  }
  const contenu = [
    COLONNES_EXPORT.map((c) => echapper(c.titre)).join(';'),
    ...lignes.map((l) => COLONNES_EXPORT.map((c) => cellule(l, c)).join(';')),
  ].join('\r\n')
  telecharger(new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8' }), `${nom}.csv`)
}

/** Fichier .xlsx natif (dates et nombres typés) */
export async function exporterExcel(lignes: LigneExport[], nom: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const entete = COLONNES_EXPORT.map((c) => ({ value: c.titre, fontWeight: 'bold' as const }))
  const corps = lignes.map((l) =>
    COLONNES_EXPORT.map((c) => {
      const v = l[c.cle]
      if (v === null || v === undefined) return null
      if (c.type === 'date') {
        const [a, m, j] = String(v).split('-').map(Number)
        return { type: Date, value: new Date(Date.UTC(a, m - 1, j)), format: 'dd/mm/yyyy' }
      }
      if (c.type === 'montant') return { type: Number, value: Number(v), format: '#,##0.00 €' }
      if (c.type === 'entier') return { type: Number, value: Number(v) }
      return { type: String, value: String(v) }
    }),
  )
  const blob = await writeXlsxFile([entete, ...corps] as never, {
    columns: COLONNES_EXPORT.map((c) => ({ width: c.type === 'texte' ? 28 : 14 })),
    sheet: 'Recettes',
    stickyRowsCount: 1,
  }).toBlob()
  telecharger(blob, `${nom}.xlsx`)
}
