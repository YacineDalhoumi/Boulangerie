import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Connexion from './pages/Connexion'

// Chargement à la demande : le tableau de bord (graphiques) n'alourdit pas la saisie
const TableauDeBord = lazy(() => import('./pages/TableauDeBord'))
const Saisie = lazy(() => import('./pages/Saisie'))
const Historique = lazy(() => import('./pages/Historique'))

function Protege({ children }: { children: React.ReactNode }) {
  const { session, chargement } = useAuth()
  const location = useLocation()
  if (chargement) return <p className="p-6 text-muted">Chargement…</p>
  if (!session) return <Navigate to="/connexion" replace state={{ depuis: location.pathname + location.search }} />
  return (
    <Layout>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>{children}</Suspense>
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/" element={<Protege><TableauDeBord /></Protege>} />
      <Route path="/saisie" element={<Protege><Saisie /></Protege>} />
      <Route path="/historique" element={<Protege><Historique /></Protege>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
