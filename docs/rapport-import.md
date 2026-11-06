# Rapport d'import de l'historique Excel

Fichier source : `Suivi_quotidien_boulangerie_v2.xlsx`, feuille « Journal quotidien ». Import réalisé le 06/11/2026 via le serveur MCP Supabase.

## Résumé

- Journées importées : **17**
- Journées rejetées : **0** (aucun doublon de date, aucune date invalide)
- Clôtures inconnues : **2** (05/10/2026 et 08/10/2026), modifiables dans l'application
- CA total des clôtures connues : **23 333,64 €** (identique à la feuille Synthèse de l'Excel)
- Sorties d'espèces créées : **6** (245,00 €)
- Catégories créées (facultatives) : Viennoiseries, Pâtisseries, Pains, Snacking
- Fond de caisse vide dans l'Excel : valeur par défaut 120,00 € appliquée

## Journées importées

| Ligne Excel | Date | Clôture | CA clôture |
|---|---|---|---|
| 12 | 02/10/2026 | connue | 1 655,15 € |
| 13 | 04/10/2026 | connue | 1 324,25 € |
| 6 | 05/10/2026 | inconnue | — |
| 4 | 07/10/2026 | connue | 1 548,55 € |
| 2 | 08/10/2026 | inconnue | — |
| 5 | 09/10/2026 | connue | 1 652,30 € |
| 15 | 11/10/2026 | connue | 1 403,50 € |
| 14 | 12/10/2026 | connue | 1 766,58 € |
| 3 | 13/10/2026 | connue | 1 776,79 € |
| 8 | 14/10/2026 | connue | 2 165,20 € |
| 7 | 15/10/2026 | connue | 1 640,58 € |
| 10 | 16/10/2026 | connue | 1 778,89 € |
| 11 | 18/10/2026 | connue | 1 280,20 € |
| 9 | 19/10/2026 | connue | 1 443,90 € |
| 16 | 25/10/2026 | connue | 1 445,60 € |
| 17 | 01/11/2026 | connue | 1 189,35 € |
| 18 | 02/11/2026 | connue | 1 262,80 € |

## Cellules corrigées

| Ligne | Date | Champ | Valeur Excel | Traitement |
|---|---|---|---|---|
| 5 | 09/10/2026 | CA 14h | pas de ticket | laissé vide |
| 6 | 05/10/2026 | Espèces comptées clôture | (espace) | laissé vide |
| 10 | 16/10/2026 | Sorties espèces | Sana -40 / Salah -50/ Hous -50/Houcine -20 | 4 sortie(s) créée(s), total 160.00 € |
| 12 | 02/10/2026 | CA 14h | pas de ticket | laissé vide |
| 12 | 02/10/2026 | Sorties espèces | Kamel -60 | 1 sortie(s) créée(s), total 60.00 € |
| 13 | 04/10/2026 | CA 14h | pas de ticket | laissé vide |
| 13 | 04/10/2026 | CB TPE clôture | pas de ticket | laissé vide |
| 14 | 12/10/2026 | CA 14h | pas de ticket | laissé vide |
| 15 | 11/10/2026 | CA 14h | pas de ticket | laissé vide |
| 16 | 25/10/2026 | Espèces comptées clôture | (espace) | laissé vide |
| 18 | 02/11/2026 | Sorties espèces | Vitre -25 | 1 sortie(s) créée(s), total 25.00 € |

Les valeurs « pas de ticket » sont notées dans le commentaire de la journée concernée.

## Anomalies conservées telles quelles (à vérifier)

- 02/11/2026 : CB caisse clôture (1 263,80 €) supérieure au CA de clôture (1 262,80 €), faute de frappe probable.
- 07/10/2026 : environ 140 € de paiements manquants pour atteindre le CA (tickets restaurant non saisis ?).

## Rejets

Aucun.
