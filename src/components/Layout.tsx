import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const LIENS = [
  { to: '/', label: 'Tableau de bord', court: 'Bord', icone: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { to: '/saisie', label: 'Saisie du jour', court: 'Saisie', icone: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' },
  { to: '/historique', label: 'Historique', court: 'Historique', icone: 'M13 3a9 9 0 0 0-9 9H1l3.9 3.9L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z' },
]

function Icone({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor"><path d={d} /></svg>
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <span className="font-semibold">Recettes boulangerie</span>
          <nav className="ml-6 hidden gap-1 md:flex" aria-label="Navigation principale">
            {LIENS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-accent-soft text-ink font-medium' : 'text-ink-2 hover:bg-surface-2'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="ml-auto rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>

      {/* Barre d'onglets en bas sur téléphone */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-line bg-surface md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navigation principale"
      >
        {LIENS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-accent font-semibold' : 'text-ink-2'}`
            }
          >
            <Icone d={l.icone} />
            {l.court}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
