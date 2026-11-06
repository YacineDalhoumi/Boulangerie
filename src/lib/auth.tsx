import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthState = { session: Session | null; chargement: boolean }
const AuthContext = createContext<AuthState>({ session: null, chargement: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<AuthState>({ session: null, chargement: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEtat({ session: data.session, chargement: false }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setEtat({ session, chargement: false }),
    )
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={etat}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
