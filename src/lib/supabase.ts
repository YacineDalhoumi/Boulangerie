import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim()

/** Variables manquantes au moment du build (affichées à l'écran plutôt qu'une page blanche) */
export const variablesManquantes = [
  !url && 'VITE_SUPABASE_URL',
  !key && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean) as string[]

// Clé PUBLIQUE uniquement : la sécurité repose sur la RLS côté Supabase.
// Si la configuration manque, le client n'est jamais utilisé (voir main.tsx).
export const supabase = createClient<Database>(url || 'https://configuration-manquante.invalid', key || 'manquante', {
  auth: { persistSession: true, autoRefreshToken: true },
})
