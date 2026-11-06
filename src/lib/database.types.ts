// Types générés depuis le schéma Supabase (npm run gen:types pour les régénérer).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' }
  public: {
    Tables: {
      categories: {
        Row: {actif: boolean; created_at: string; id: number; nom: string; ordre: number; user_id: string }
        Insert: {actif?: boolean; created_at?: string; id?: never; nom: string; ordre?: number; user_id?: string }
        Update: {actif?: boolean; created_at?: string; id?: never; nom?: string; ordre?: number; user_id?: string }
        Relationships: []
      }
      journees: {
        Row: {autres_paiements: number | null; ca_14h: number | null; ca_cloture: number | null; cb_caisse_14h: number | null; cb_caisse_cloture: number | null; cb_tpe_14h: number | null; cb_tpe_cloture: number | null; commentaire: string | null; created_at: string; date_jour: string; especes_caisse_14h: number | null; especes_caisse_cloture: number | null; especes_comptees_14h: number | null; especes_comptees_cloture: number | null; fond_caisse: number; id: number; source: string; tickets_14h: number | null; tickets_cloture: number | null; tr_14h: number | null; tr_cloture: number | null; updated_at: string; user_id: string }
        Insert: {autres_paiements?: number | null; ca_14h?: number | null; ca_cloture?: number | null; cb_caisse_14h?: number | null; cb_caisse_cloture?: number | null; cb_tpe_14h?: number | null; cb_tpe_cloture?: number | null; commentaire?: string | null; created_at?: string; date_jour: string; especes_caisse_14h?: number | null; especes_caisse_cloture?: number | null; especes_comptees_14h?: number | null; especes_comptees_cloture?: number | null; fond_caisse?: number; id?: never; source?: string; tickets_14h?: number | null; tickets_cloture?: number | null; tr_14h?: number | null; tr_cloture?: number | null; updated_at?: string; user_id?: string }
        Update: {autres_paiements?: number | null; ca_14h?: number | null; ca_cloture?: number | null; cb_caisse_14h?: number | null; cb_caisse_cloture?: number | null; cb_tpe_14h?: number | null; cb_tpe_cloture?: number | null; commentaire?: string | null; created_at?: string; date_jour?: string; especes_caisse_14h?: number | null; especes_caisse_cloture?: number | null; especes_comptees_14h?: number | null; especes_comptees_cloture?: number | null; fond_caisse?: number; id?: never; source?: string; tickets_14h?: number | null; tickets_cloture?: number | null; tr_14h?: number | null; tr_cloture?: number | null; updated_at?: string; user_id?: string }
        Relationships: []
      }
      sorties_especes: {
        Row: {created_at: string; id: number; journee_id: number; montant: number; motif: string }
        Insert: {created_at?: string; id?: never; journee_id: number; montant: number; motif: string }
        Update: {created_at?: string; id?: never; journee_id?: number; montant?: number; motif?: string }
        Relationships: []
      }
      ventes_categories: {
        Row: {categorie_id: number; journee_id: number; montant: number }
        Insert: {categorie_id: number; journee_id: number; montant: number }
        Update: {categorie_id?: number; journee_id?: number; montant?: number }
        Relationships: []
      }
    }
    Views: {
      v_ca_annee: { Row: { annee: number | null; ca: number | null; ca_moyen_jour: number | null; jours_connus: number | null; jours_sans_cloture: number | null; panier_moyen: number | null; tickets: number | null }; Relationships: [] }
      v_ca_categorie: { Row: { ca: number | null; categorie: string | null; categorie_id: number | null; mois: string | null; ordre: number | null; part_pct: number | null }; Relationships: [] }
      v_ca_jour_semaine: { Row: { ca_max: number | null; ca_min: number | null; ca_moyen: number | null; ca_total: number | null; jour_semaine: string | null; nb_jours: number | null; num_jour_semaine: number | null; panier_moyen: number | null; tickets_moyen: number | null }; Relationships: [] }
      v_ca_mois: { Row: { annee: number | null; ca: number | null; ca_moyen_jour: number | null; jours_connus: number | null; jours_sans_cloture: number | null; mois: string | null; num_mois: number | null; panier_moyen: number | null; tickets: number | null }; Relationships: [] }
      v_ca_quotidien: { Row: { ca: number | null; cloture_connue: boolean | null; date_jour: string | null; jour_semaine: string | null; num_jour_semaine: number | null; panier_moyen: number | null; tickets: number | null }; Relationships: [] }
      v_ca_semaine: { Row: { annee_iso: number | null; ca: number | null; ca_moyen_jour: number | null; debut_semaine: string | null; fin_semaine: string | null; jours_connus: number | null; jours_sans_cloture: number | null; num_semaine: number | null; panier_moyen: number | null; tickets: number | null }; Relationships: [] }
      v_journees: { Row: { autres_paiements: number | null; ca_14h: number | null; ca_apres_14h: number | null; ca_cloture: number | null; cb_caisse_14h: number | null; cb_caisse_apres_14h: number | null; cb_caisse_cloture: number | null; cb_tpe_14h: number | null; cb_tpe_apres_14h: number | null; cb_tpe_cloture: number | null; cloture_connue: boolean | null; commentaire: string | null; created_at: string | null; date_jour: string | null; detail_sorties: string | null; ecart_cb: number | null; ecart_encaissements: number | null; ecart_especes: number | null; especes_caisse_14h: number | null; especes_caisse_apres_14h: number | null; especes_caisse_cloture: number | null; especes_comptees_14h: number | null; especes_comptees_cloture: number | null; especes_comptees_journee: number | null; fond_caisse: number | null; id: number | null; jour_semaine: string | null; num_jour_semaine: number | null; panier_moyen_apres_14h: number | null; panier_moyen_journee: number | null; panier_moyen_matin: number | null; sorties_especes: number | null; source: string | null; tickets_14h: number | null; tickets_apres_14h: number | null; tickets_cloture: number | null; tr_14h: number | null; tr_apres_14h: number | null; tr_cloture: number | null; updated_at: string | null }; Relationships: [] }
    }
    Functions: {
      comparer_periodes: {
        Args: { p_date_ref?: string; p_granularite: string }
        Returns: {
          ca: number; ca_prec: number; ca_prec_complet: number; debut: string
          ecart_complet_eur: number; ecart_complet_pct: number | null; ecart_eur: number; ecart_pct: number | null
          fin: string; granularite: string; jours_connus: number; jours_prec: number
          jours_prec_complet: number; jours_sans_cloture: number
          prec_complet_debut: string; prec_complet_fin: string; prec_debut: string; prec_fin: string
        }[]
      }
      meilleur_pire_jour: {
        Args: { p_debut: string; p_fin: string }
        Returns: { ca: number; classement: string; date_jour: string; jour_semaine: string; panier_moyen: number | null; tickets: number }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
