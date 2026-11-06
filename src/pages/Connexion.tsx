import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { messageErreur } from '../lib/erreurs'

export default function Connexion() {
  const { session } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (session) {
    const depuis = (location.state as { depuis?: string } | null)?.depuis ?? '/'
    return <Navigate to={depuis} replace />
  }

  async function connecter(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: motDePasse })
    setEnvoi(false)
    if (error) setErreur(messageErreur(error))
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={connecter} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Recettes boulangerie</h1>
        <p className="mt-1 text-sm text-ink-2">Connectez-vous pour saisir et suivre vos recettes.</p>

        <label className="mt-6 block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required className="champ mt-1"
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="mt-4 block text-sm font-medium" htmlFor="mdp">Mot de passe</label>
        <input id="mdp" type="password" autoComplete="current-password" required className="champ mt-1"
          value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />

        {erreur && <p role="alert" className="mt-4 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-ink">{erreur}</p>}

        <button type="submit" disabled={envoi}
          className="mt-6 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent disabled:opacity-60">
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
