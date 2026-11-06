# Recettes boulangerie

Application web de suivi des recettes quotidiennes d'une boulangerie. Elle remplace le fichier Excel « Suivi quotidien boulangerie ».

- **Front** : React + Vite + TypeScript + Tailwind CSS, graphiques Recharts. Interface en français, montants en euros (1 234,56 €), dates au format JJ/MM/AAAA, pensée pour le téléphone.
- **Back** : Supabase, avec la base Postgres, l'authentification par email et mot de passe, et **toute la logique de calcul** (vues SQL et fonctions RPC). Le front ne fait qu'afficher ce que renvoie la base.

## Fonctionnalités

| Écran | Contenu |
|---|---|
| **Connexion** | Email et mot de passe (Supabase Auth). Aucune inscription depuis l'application. |
| **Saisie du jour** | La date est pré-remplie à aujourd'hui. Le relevé de **14h est obligatoire**, la **clôture de 20h30 est facultative** : laissée vide, elle est « inconnue » et pourra être complétée plus tard. On y saisit aussi les sorties d'espèces, les autres paiements, le fond de caisse (120 € par défaut), un commentaire et, en option, la répartition par catégorie. Une date déjà saisie s'ouvre en modification et peut être supprimée. Après l'enregistrement, la base affiche les résultats calculés (paniers moyens, écarts). |
| **Tableau de bord** | Le CA du jour, de la semaine, du mois et de l'année, chacun comparé à la période précédente en € et en % : <br>• le jour : avec la même date du mois précédent ; <br>• le mois : avec le **mois précédent complet** et avec la même période du mois précédent ; <br>• la semaine et l'année : avec la même portion de la période précédente et avec la période précédente complète. <br>On y trouve aussi : <br>• les courbes de CA quotidien et mensuel ; <br>• le CA moyen par jour de la semaine ; <br>• la meilleure et la pire journée du mois ; <br>• les clôtures à compléter ; <br>• la répartition par catégorie, si elle est saisie. |
| **Historique** | Tableau filtrable par période (raccourcis ou dates libres), avec tri par colonne et recherche (commentaire, jour, sortie d'espèces ou date JJ/MM/AAAA). Un filtre affiche seulement les clôtures inconnues. **Export Excel (.xlsx) et CSV** des lignes filtrées. |

## Schéma de la base (Supabase)

Les migrations se trouvent dans `supabase/migrations/`, une par changement de schéma, chacune nommée clairement. La Row Level Security est **activée sur toutes les tables** : un utilisateur connecté ne voit et ne modifie que ses propres données. Les visiteurs non connectés n'ont accès à rien, ni aux tables, ni aux vues, ni aux fonctions.

### Tables

**`journees`** : une ligne par jour.

| Colonne | Type | Description |
|---|---|---|
| `id` | bigint (identity) | Clé primaire |
| `user_id` | uuid | Propriétaire, `auth.uid()` par défaut |
| `date_jour` | date | **Unique par utilisateur** : une seule saisie par date |
| `source` | text | `saisie` ou `import` (historique Excel) |
| `ca_14h`, `tickets_14h` | numeric(10,2), integer | Relevé de 14h, cumulé depuis l'ouverture |
| `cb_caisse_14h`, `cb_tpe_14h` | numeric(10,2) | CB selon la caisse et selon le TPE |
| `especes_caisse_14h`, `especes_comptees_14h` | numeric(10,2) | Espèces selon la caisse et espèces comptées (hors fond de caisse) |
| `tr_14h` | numeric(10,2) | Tickets restaurant (terminal séparé) |
| `ca_cloture`, `tickets_cloture`, `cb_caisse_cloture`, `cb_tpe_cloture`, `especes_caisse_cloture`, `especes_comptees_cloture`, `tr_cloture` | idem | Clôture de 20h30, cumulée sur la journée. **Vide = clôture inconnue.** |
| `autres_paiements` | numeric(10,2) | Autres paiements de la journée |
| `fond_caisse` | numeric(10,2) | 120 € par défaut |
| `commentaire` | text | |
| `created_at`, `updated_at` | timestamptz | `updated_at` est mis à jour par un trigger |

Contraintes :
- tous les montants et les nombres de tickets sont **≥ 0** ;
- `journees_date_unique` : une seule saisie par date ;
- `journees_matin_obligatoire` : le CA et les tickets de 14h sont obligatoires, sauf pour les journées importées ;
- `journees_cloture_complete` : le CA et les tickets de clôture sont renseignés ensemble, ou laissés vides ensemble ;
- `journees_ca_cumule` et `journees_tickets_cumules` : la clôture ne peut pas être inférieure à 14h.

**`sorties_especes`** : sorties d'espèces justifiées, une ligne par sortie (`journee_id`, `motif`, `montant` > 0). Suppression en cascade avec la journée.

**`categories`** : catégories facultatives (`nom` unique par utilisateur, `ordre`, `actif`). Viennoiseries, Pâtisseries, Pains et Snacking sont créées à l'import.

**`ventes_categories`** : CA d'une journée par catégorie (`journee_id`, `categorie_id`, `montant` ≥ 0), avec une ligne au plus par couple journée/catégorie.

### Vues

Toutes les vues sont en `security_invoker` : elles respectent la RLS. Le CA d'une journée est le **CA de clôture**. Les clôtures inconnues sont exclues des sommes et des moyennes, et comptées à part (`jours_sans_cloture`).

| Vue | Contenu |
|---|---|
| `v_journees` | Une journée avec tous les champs calculés (détail ci-dessous). |
| `v_ca_quotidien` | Date, jour, CA, tickets et panier moyen, pour la courbe. |
| `v_ca_semaine` | Par semaine ISO (lundi → dimanche) : CA, tickets, panier moyen, CA moyen par jour, jours connus et jours sans clôture. |
| `v_ca_mois` | Les mêmes indicateurs par mois. |
| `v_ca_annee` | Les mêmes indicateurs par année. |
| `v_ca_jour_semaine` | Par jour de la semaine : nombre de journées, CA moyen, minimum, maximum et panier moyen. |
| `v_ca_categorie` | Par mois et par catégorie : CA et part en %. |

Champs calculés dans `v_journees` :

| Champ | Formule |
|---|---|
| `ca_apres_14h`, `tickets_apres_14h`, `cb_*_apres_14h` | clôture − 14h |
| `panier_moyen_matin`, `panier_moyen_apres_14h`, `panier_moyen_journee` | CA / tickets (vide si une donnée manque) |
| `ecart_cb` | CB TPE clôture − CB caisse clôture |
| `especes_comptees_journee` | espèces comptées 14h + espèces comptées clôture (la caisse est vidée à 14h, le fond de 120 € reste dans le tiroir) |
| `ecart_especes` | espèces comptées journée + sorties − espèces caisse clôture |
| `ecart_encaissements` | espèces comptées journée + sorties + CB TPE clôture + tickets restaurant clôture + autres paiements − CA clôture |

### Fonctions (RPC)

| Fonction | Rôle |
|---|---|
| `comparer_periodes(p_granularite, p_date_ref)` | `p_granularite` vaut `jour`, `semaine`, `mois` ou `annee`. Renvoie : <br>• le CA de la période en cours jusqu'à `p_date_ref`, avec le nombre de jours connus et de jours sans clôture ; <br>• l'écart en € et en % avec la même portion de la période précédente ; <br>• l'écart avec la période précédente complète. <br>Pour `jour`, la comparaison se fait avec la même date du mois précédent. |
| `meilleur_pire_jour(p_debut, p_fin)` | La meilleure et la pire journée (clôture connue) de l'intervalle. |
| `set_updated_at()` | Trigger de mise à jour de `updated_at`. |

Toutes les fonctions sont en `security invoker` avec `search_path` vide. Seul le rôle `authenticated` peut les exécuter.

## Lancer l'application en local

Il faut Node.js 20 ou plus récent.

1. Installez les dépendances :
   ```bash
   npm install
   ```
2. Créez le fichier de configuration :
   ```bash
   cp .env.example .env.local
   ```
3. Renseignez dans `.env.local` l'URL du projet et la clé **publique** : *Supabase > Project Settings > API*, `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. **Ne mettez jamais la clé `service_role`** : elle donnerait un accès total à la base depuis le navigateur.
4. Lancez le serveur :
   ```bash
   npm run dev
   ```
   L'application s'ouvre sur http://localhost:5173. Pour tester depuis votre téléphone sur le même Wi-Fi :
   ```bash
   npm run dev -- --host
   ```

Autres commandes :
- `npm run build` : vérifie les types et produit le dossier `dist/` ;
- `npm run preview` : sert le build de production en local ;
- `npm run gen:types` : régénère `src/lib/database.types.ts` après un changement de schéma (nécessite le CLI Supabase).

### Créer le compte de connexion

L'application ne propose pas d'inscription. Dans le tableau de bord Supabase :
1. **Authentication > Users > Add user** : saisissez l'email et le mot de passe, en cochant « Auto confirm user ».
2. **Authentication > Sign In / Providers** : désactivez « Allow new users to sign up », pour que personne d'autre ne puisse créer de compte.

## Déployer sur Vercel

1. Sur [vercel.com](https://vercel.com), choisissez **Add New > Project** et importez le dépôt GitHub `Boulangerie`.
2. Vercel détecte Vite tout seul : commande de build `npm run build`, dossier de sortie `dist`.
3. Dans **Environment Variables**, ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`, avec les mêmes valeurs que dans `.env.local`.
4. Cliquez sur **Deploy**. Le fichier `vercel.json` redirige toutes les routes vers `index.html`, ce qui permet de recharger `/saisie` ou `/historique` sans erreur 404.
5. Dans Supabase, **Authentication > URL Configuration**, mettez l'URL Vercel (par exemple `https://boulangerie.vercel.app`) dans **Site URL**.

Chaque push sur `main` redéploie automatiquement l'application.

Pour l'ajouter à l'écran d'accueil d'un téléphone : ouvrez l'URL Vercel, puis *Partager > Sur l'écran d'accueil* (iPhone) ou *menu ⋮ > Ajouter à l'écran d'accueil* (Android).

### Variante : Netlify

Dans **Add new site > Import an existing project**, réglez la commande de build sur `npm run build`, le dossier de publication sur `dist`, et ajoutez les deux mêmes variables d'environnement. Pour les routes, créez un fichier `public/_redirects` contenant la ligne :

```
/*  /index.html  200
```

## Import de l'historique Excel

L'historique a été importé une seule fois : 17 journées, 0 rejet. Le détail se trouve dans `docs/rapport-import.md`. Le script utilisé, `scripts/import_excel.py`, génère un SQL transactionnel à partir du fichier Excel. Une date déjà présente fait échouer l'import entier, ce qui empêche les doublons.

## Organisation du code

```
supabase/migrations/   migrations SQL (tables, vues, fonctions)
scripts/               script d'import de l'Excel
docs/                  rapport d'import
src/lib/               client Supabase, types, formatage FR, export Excel/CSV, messages d'erreur
src/pages/             Connexion, TableauDeBord, Saisie, Historique
src/components/        mise en page et composants d'interface
```
