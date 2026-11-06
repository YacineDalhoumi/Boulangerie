import type { ReactNode } from 'react'
import { eurSigne, pct } from '../lib/format'

export function Carte({ titre, sousTitre, action, children, className = '' }: {
  titre?: ReactNode; sousTitre?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>
      {(titre || action) && (
        <div className="mb-3 flex flex-wrap items-start gap-2">
          <div className="min-w-0">
            {titre && <h2 className="font-semibold">{titre}</h2>}
            {sousTitre && <p className="text-sm text-muted">{sousTitre}</p>}
          </div>
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Variation signée : flèche + texte (jamais la couleur seule) */
export function Delta({ eurValeur, pctValeur, libelle }: { eurValeur: number | null; pctValeur: number | null; libelle: ReactNode }) {
  if (eurValeur === null) return <p className="text-sm text-muted">{libelle} : pas de donnée</p>
  const n = Number(eurValeur)
  const sens = n > 0 ? 'hausse' : n < 0 ? 'baisse' : 'stable'
  const couleur = n > 0 ? 'text-good' : n < 0 ? 'text-bad' : 'text-ink-2'
  const fleche = n > 0 ? '▲' : n < 0 ? '▼' : '='
  return (
    <p className="text-sm">
      <span className={`font-medium tabular ${couleur}`}>
        <span aria-hidden="true">{fleche} </span>
        <span className="sr-only">{sens} </span>
        {pctValeur !== null ? pct(pctValeur) : ''} {pctValeur !== null ? `(${eurSigne(n)})` : eurSigne(n)}
      </span>{' '}
      <span className="text-muted">{libelle}</span>
    </p>
  )
}

export function Bandeau({ type = 'info', children }: { type?: 'info' | 'alerte' | 'succes'; children: ReactNode }) {
  const styles = {
    info: 'bg-surface-2 text-ink-2',
    alerte: 'bg-warn-bg text-warn-ink',
    succes: 'bg-accent-soft text-ink',
  }[type]
  return <div role={type === 'alerte' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm ${styles}`}>{children}</div>
}

export function Bouton({ variante = 'principal', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secondaire' | 'danger' }) {
  const styles = {
    principal: 'bg-accent text-on-accent font-semibold',
    secondaire: 'border border-line bg-surface text-ink hover:bg-surface-2',
    danger: 'border border-line bg-surface text-bad hover:bg-surface-2',
  }[variante]
  return <button type="button" {...props} className={`min-h-11 rounded-xl px-4 text-sm disabled:opacity-60 ${styles} ${className}`} />
}

/** Infobulle commune aux graphiques Recharts */
export function InfoBulle({ active, lignes }: { active?: boolean; lignes: { libelle: string; valeur: string }[] | null }) {
  if (!active || !lignes) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md">
      {lignes.map((l, i) => (
        <div key={i} className={i === 0 ? 'font-medium' : 'flex gap-3 justify-between text-ink-2'}>
          {i === 0 ? l.libelle : <><span>{l.libelle}</span><span className="tabular text-ink">{l.valeur}</span></>}
        </div>
      ))}
    </div>
  )
}
