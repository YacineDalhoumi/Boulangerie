import LignesProduits from '../components/LignesProduits'

export default function Invendus() {
  return (
    <LignesProduits cfg={{
      type: 'invendus',
      titre: 'Invendus',
      sousTitre: 'Une ligne par produit et par jour · valeur au prix de vente (pas au coût de fabrication)',
      libelleQuantite: 'Quantité invendue',
      libelleMontant: 'Valeur',
      libelleRemarque: 'Cause / remarque',
      exempleRemarque: 'Ex. fin de journée, météo, surproduction…',
    }} />
  )
}
