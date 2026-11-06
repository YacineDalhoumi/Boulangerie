import LignesProduits from '../components/LignesProduits'

export default function VentesProduits() {
  return (
    <LignesProduits cfg={{
      type: 'ventes',
      titre: 'Ventes par produit',
      sousTitre: 'Quantités vendues par produit et par jour (si votre caisse les fournit)',
      libelleQuantite: 'Quantité vendue',
      libelleMontant: 'CA',
      libelleRemarque: 'Source / remarque',
      exempleRemarque: 'Ex. rapport caisse Z, comptage…',
    }} />
  )
}
